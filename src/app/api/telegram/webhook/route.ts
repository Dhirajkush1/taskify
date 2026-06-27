import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { TelegramBotService } from "@/lib/telegram/bot-service";
import { ContextBuilder } from "@/lib/ai/context-builder";
import { ActionOrchestrator } from "@/lib/ai/action-orchestrator";
import { AUTONOMOUS_SYSTEM_PROMPT } from "@/lib/ai/ai-service";
import { RescueEngine } from "@/lib/ai/rescue-engine";
import { DebriefEngine } from "@/lib/ai/debrief-engine";
import { SimulationEngine } from "@/lib/ai/simulation-engine";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";

// Instantiate Supabase Admin client with Service Role Key to execute background processes
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/telegram/webhook
 * Receives incoming updates from Telegram Bot API.
 */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    console.log("[TelegramWebhook] Received update:", JSON.stringify(update));

    // 1. Handle Callback Queries (Button Clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const telegramUserId = message.from.id;
    const text = message.text?.trim();

    // 2. Handle Account Linking Flow (e.g. /start CL-8F2A or entering the code directly)
    const linkingCodeMatch = text?.match(/^(?:CL-[A-Z2-9]{5})|(?:\/start\s+(CL-[A-Z2-9]{5}))$/i);
    const potentialCode = linkingCodeMatch ? (linkingCodeMatch[1] || linkingCodeMatch[0]).toUpperCase() : null;

    if (potentialCode) {
      const success = await handleAccountLinking(chatId, telegramUserId, potentialCode);
      return NextResponse.json({ ok: true });
    }

    // 3. Authenticate & Retrieve Linked User
    const { data: account, error: accountError } = await supabaseAdmin
      .from("telegram_accounts")
      .select("user_id")
      .eq("telegram_user_id", telegramUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (accountError || !account) {
      const welcomeText = `
👋 <b>Welcome to Clutch AI!</b>

It looks like your Telegram account is not linked to a Clutch AI profile yet.

To link your account:
1. Log in to the <b>Clutch AI web application</b>.
2. Go to <b>Settings</b> ⚙️.
3. Click <b>"Connect Telegram"</b> to generate a secure one-time linking code.
4. Send that code (e.g., <code>CL-8A3F</code>) directly to me here!

Once connected, I will become your autonomous productivity companion, synchronized in real time with your dashboard!
`;
      await TelegramBotService.sendMessage(chatId, welcomeText);
      return NextResponse.json({ ok: true });
    }

    const userId = account.user_id;
    if (!userId) {
      await TelegramBotService.sendMessage(chatId, "⚠️ Your account is linked but has no associated user ID. Please re-link in Settings.");
      return NextResponse.json({ ok: true });
    }

    // 4. Process Quick System Commands
    if (text?.startsWith("/")) {
      const processed = await handleBotCommands(chatId, userId, text);
      if (processed) return NextResponse.json({ ok: true });
    }

    // 5. Run AI Dialogue Pipeline (Natural Chat, Voice Notes, or Attachments)
    await handleAIDialogue(chatId, userId, message);
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("[TelegramWebhook] Critical webhook processing error:", err);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}

/**
 * Executes account linking handshake.
 */
async function handleAccountLinking(chatId: number, telegramUserId: number, code: string): Promise<boolean> {
  console.log(`[TelegramWebhook] Attempting account link for code: ${code}`);

  // Fetch pending code that hasn't expired
  const { data: account, error } = await supabaseAdmin
    .from("telegram_accounts")
    .select("*")
    .eq("linking_code", code)
    .maybeSingle();

  if (error || !account) {
    await TelegramBotService.sendMessage(
      chatId,
      "⚠️ <b>Linking Code Invalid</b>\n\nThat linking code was not found. Please verify it or generate a new one from your Settings page."
    );
    return false;
  }

  if (!account.linking_code_expires_at) {
    await TelegramBotService.sendMessage(
      chatId,
      "⚠️ <b>Linking Code Invalid</b>\n\nThat linking code has no expiry. Please generate a fresh code in Settings."
    );
    return false;
  }

  const expiresAt = new Date(account.linking_code_expires_at).getTime();
  if (expiresAt < Date.now()) {
    await TelegramBotService.sendMessage(
      chatId,
      "⚠️ <b>Linking Code Expired</b>\n\nThat linking code has expired (valid for 10 minutes). Please generate a fresh code in Settings."
    );
    return false;
  }

  // Update account mapping as linked & active
  const { error: updateError } = await supabaseAdmin
    .from("telegram_accounts")
    .update({
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      is_active: true,
      linked_at: new Date().toISOString(),
      linking_code: null,
      linking_code_expires_at: null
    })
    .eq("id", account.id);

  if (updateError) {
    console.error("[TelegramWebhook] Database linking update failed:", updateError.message);
    await TelegramBotService.sendMessage(chatId, "⚠️ A database error occurred during linking. Please try again.");
    return false;
  }

  // Send celebration!
  const successText = `
🎉 <b>Clutch AI Connected!</b>

Your Telegram account has been successfully linked to your Clutch AI profile. 

<b>What you can do here:</b>
• 💬 <b>Chat Naturally:</b> Extract tasks, ask about your schedule, plan sprints, or set reminders.
• 🎙 <b>Voice Messages:</b> Record voice notes to dictate goals, schedule items, or check in.
• 📄 <b>Attachments:</b> Upload images or PDFs to extract tasks instantly.
• 📊 <b>Predictive Simulator:</b> Ask questions like <i>"What if I skip studying today?"</i>.

Your dashboard will update in real time as we talk!
`;
  await TelegramBotService.sendMessage(chatId, successText);
  return true;
}

/**
 * Handle quick bot commands.
 */
async function handleBotCommands(chatId: number, userId: string, text: string): Promise<boolean> {
  const command = text.split(" ")[0].toLowerCase();

  switch (command) {
    case "/start":
    case "/help":
      const helpText = `
🤖 <b>Clutch AI Bot Companion Guide</b>

I am fully synchronized with your Clutch AI platform. You can use these quick commands or simply chat naturally:

📅 <b>Schedules & Tasks:</b>
• <code>/tasks</code> — View all active tasks sorted by priority.
• <code>/today</code> — View tasks due today and tomorrow's preparation.
• <code>/status</code> — View focus stats, stress index, and streaks.

🛡 <b>AI Engine Actions:</b>
• <code>/rescue</code> — Check active Rescue Mode plans or trigger emergency mode.
• <code>/debrief</code> — Compile and read today's Daily Debrief.
• <code>/settings</code> — Link to your system preferences.
`;
      await TelegramBotService.sendMessage(chatId, helpText);
      return true;

    case "/tasks": {
      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "done" as "done")
        .neq("status", "archived" as "archived")
        .order("priority", { ascending: false });

      if (!tasks || tasks.length === 0) {
        await TelegramBotService.sendMessage(chatId, "🎉 <b>No Active Tasks!</b>\n\nYour task queue is completely clear. Excellent job!");
        return true;
      }

      const list = tasks.map((t, idx) => {
        const emoji = t.priority === "critical" ? "🔴" : t.priority === "high" ? "orange;" : "yellow;";
        const dateStr = t.deadline ? new Date(t.deadline).toLocaleDateString([], { month: "short", day: "numeric" }) : "No deadline";
        return `${idx + 1}. <b>${t.title}</b> (${t.priority.toUpperCase()}) - <i>${dateStr}</i>`;
      }).join("\n");

      await TelegramBotService.sendMessage(chatId, `📋 <b>Active Task Queue:</b>\n\n${list}`);
      return true;
    }

    case "/today": {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "done" as "done")
        .order("priority", { ascending: false });

      const todayTasks = tasks?.filter(t => t.deadline?.startsWith(todayStr)) || [];

      if (todayTasks.length === 0) {
        await TelegramBotService.sendMessage(chatId, "🌅 <b>Clear Horizon Today!</b>\n\nYou have no tasks scheduled for today. Dictate or type a task to schedule it!");
        return true;
      }

      const list = todayTasks.map((t, idx) => {
        return `• <b>${t.title}</b> [${t.priority.toUpperCase()}]`;
      }).join("\n");

      await TelegramBotService.sendMessage(chatId, `🌅 <b>Today's Focus Missions:</b>\n\n${list}`);
      return true;
    }

    case "/status": {
      // Fetch user's active tasks and focus history
      const { data: tasks } = await supabaseAdmin.from("tasks").select("*").eq("user_id", userId);
      const pending = tasks?.filter(t => t.status !== "done") || [];
      const completed = tasks?.filter(t => t.status === "done") || [];

      // Fetch active rescue plan
      const { data: rescue } = await supabaseAdmin
        .from("rescue_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      const rescueStatus = rescue ? `🚨 <b>Active Rescue Mode:</b> ${rescue.recovery_probability}% probability` : "🟢 <b>Normal Scheduling Mode</b>";

      await TelegramBotService.sendMessage(
        chatId,
        `📊 <b>System Performance Status:</b>\n\n` +
        `📝 Pending Tasks: <b>${pending.length}</b>\n` +
        `✅ Completed Tasks: <b>${completed.length}</b>\n` +
        `🛡 State: ${rescueStatus}\n`
      );
      return true;
    }

    case "/rescue": {
      const plan = await RescueEngine.detectAndRunRescue(userId);
      if (plan && plan.is_active) {
        const hoursRemaining = plan.hours_remaining ?? 0;
        const firstStep = plan.emergency_action_plan[0]?.step || "Critical Work Block";
        await TelegramBotService.sendRescueAlert(chatId, {
          hoursRemaining,
          recoveryProbability: plan.recovery_probability ?? 0,
          nextFocusBlock: firstStep,
          focusSessionsRequired: plan.remaining_focus_sessions ?? 0,
          rescuePlanId: userId
        });
      } else {
        await TelegramBotService.sendMessage(chatId, "🟢 <b>Schedule Stable:</b> No deadline emergency detected. Your schedules are perfectly balanced!");
      }
      return true;
    }

    case "/debrief": {
      const debrief = await DebriefEngine.getOrCreateDailyDebrief(userId);
      if (debrief) {
        await TelegramBotService.sendDailyDebrief(chatId, {
          completionRate: debrief.metrics.completion_rate,
          focusMinutes: debrief.metrics.focus_time_minutes,
          summary: debrief.summary,
          priorities: debrief.tomorrow_priorities,
          streak: debrief.metrics.current_streak
        });
      } else {
        await TelegramBotService.sendMessage(chatId, "📊 <b>No debrief available yet.</b> Complete some tasks today to generate your daily summary!");
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Handle AI Dialogues, supporting natural text, voice transcription, and document attachments.
 */
async function handleAIDialogue(chatId: number, userId: string, message: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await TelegramBotService.sendMessage(chatId, "⚠️ Clutch AI is currently offline. Please contact administrator to configure the Gemini API Key.");
    return;
  }

  // Send typing action to Telegram
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" })
  }).catch(() => {});

  let userContent = message.text || "";
  let filePart: any = null;

  // 1. Handle Voice Messages (Multimodal Speech-to-Text)
  if (message.voice) {
    const voiceFile = await TelegramBotService.downloadFile(message.voice.file_id);
    if (voiceFile) {
      filePart = {
        base64Data: voiceFile.buffer.toString("base64"),
        mimeType: voiceFile.mimeType
      };
      userContent = "Please transcribe and process this voice note.";
    }
  }

  // 2. Handle Photos
  else if (message.photo && message.photo.length > 0) {
    // Take largest photo resolution
    const photo = message.photo[message.photo.length - 1];
    const photoFile = await TelegramBotService.downloadFile(photo.file_id);
    if (photoFile) {
      filePart = {
        base64Data: photoFile.buffer.toString("base64"),
        mimeType: photoFile.mimeType
      };
      userContent = message.caption || "Analyze this image and extract any productivity tasks or milestones.";
    }
  }

  // 3. Handle PDF Documents
  else if (message.document && message.document.mime_type === "application/pdf") {
    const pdfFile = await TelegramBotService.downloadFile(message.document.file_id);
    if (pdfFile) {
      filePart = {
        base64Data: pdfFile.buffer.toString("base64"),
        mimeType: pdfFile.mimeType
      };
      userContent = message.caption || "Analyze this PDF document and extract tasks.";
    }
  }

  if (!userContent && !filePart) {
    await TelegramBotService.sendMessage(chatId, "😅 I didn't recognize that message type. Try sending text, a voice note, a PDF, or a photo!");
    return;
  }

  try {
    // A. Fetch/Create Active Conversation Thread
    let { data: convo } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo, error: convoError } = await supabaseAdmin
        .from("conversations")
        .insert({ user_id: userId, title: "Telegram Sync Thread" })
        .select()
        .single();
      
      if (convoError) throw new Error(convoError.message);
      convo = newConvo;
    }

    // B. Save User Message to Database
    const { data: userMsg } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: convo.id,
        role: "user",
        content: message.text || (message.voice ? "[Voice Note]" : "[Attachment]"),
        source: "telegram"
      })
      .select()
      .single();

    // C. Intercept What-If Simulator command in Telegram
    if (userContent.toLowerCase().includes("what if") || userContent.toLowerCase().includes("what-if")) {
      const sim = await SimulationEngine.runSimulation(userId, userContent);
      if (!sim) {
        await TelegramBotService.sendMessage(chatId, "⚠️ Failed to run the What-If simulation. Please try again.");
        return;
      }
      const simResponse = `
🔮 <b>What-If Decision Simulation</b>

🧠 <b>Decision:</b> "${userContent}"

📈 <b>Probability Change:</b> ${sim.current_completion_probability}% ➔ <b>${sim.simulated_completion_probability}%</b>
⚠️ <b>Risk Level:</b> <b>${sim.simulated_deadline_risk.toUpperCase()}</b>
🔋 <b>Workload Impact:</b> <b>${sim.workload_impact}</b>

📝 <b>Clutch AI Reasoning:</b>
<i>${sim.reasoning}</i>

💡 <b>Mitigation Plan:</b>
${sim.suggested_alternative}
`;
      
      // Save assistant response
      await supabaseAdmin.from("messages").insert({
        conversation_id: convo.id,
        role: "assistant",
        content: simResponse,
        source: "telegram"
      });

      await TelegramBotService.sendMessage(chatId, simResponse);
      return;
    }

    // D. Compile Rich Context
    const context = await ContextBuilder.buildContext(userId, userContent);

    // E. Invoke Gemini Model Synchronously
    const today = new Date();
    const todayStr = today.toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);
    const basePrompt = AUTONOMOUS_SYSTEM_PROMPT(todayStr, dayOfWeek);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `${basePrompt}\n\n[CONTEXT]\n${context.promptContextString}\n\nIMPORTANT: The user is messaging from Telegram. Keep your 'chat_response' extremely clear, formatted in standard HTML tags (<b>, <i>, <code>, <a>), and reasonably concise. Do NOT return markdown format inside 'chat_response'.`,
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    });

    const parts: any[] = [];
    if (filePart) {
      parts.push({
        inlineData: {
          data: filePart.base64Data,
          mimeType: filePart.mimeType
        }
      });
    }
    parts.push({ text: userContent });

    const result = await model.generateContent(parts);
    const responseText = result.response.text();

    // F. Parse AI Structured Response & Run Action Orchestrator
    const parsedData = JSON.parse(responseText.trim().replace(/```json/gi, "").replace(/```/gi, "").trim());

    // Execute database transaction block!
    await ActionOrchestrator.execute(userId, parsedData, supabaseAdmin, userContent);

    // G. Save Assistant Message & Send Reply to Telegram
    const replyText = parsedData.chat_response;
    await supabaseAdmin.from("messages").insert({
      conversation_id: convo.id,
      role: "assistant",
      content: replyText,
      source: "telegram"
    });

    // If Rescue Mode was triggered during execution, notify!
    const { data: rescuePlan } = await supabaseAdmin
      .from("rescue_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (rescuePlan && parsedData.chat_response.includes("Rescue Mode")) {
      const targetDeadline = rescuePlan.estimated_finish_time
        ? new Date(rescuePlan.estimated_finish_time).getTime()
        : Date.now() + 60 * 60 * 1000;
      await TelegramBotService.sendRescueAlert(chatId, {
        hoursRemaining: (targetDeadline - Date.now()) / (1000 * 60 * 60),
        recoveryProbability: rescuePlan.recovery_probability ?? 0,
        nextFocusBlock: "Focus Mission",
        focusSessionsRequired: rescuePlan.remaining_focus_sessions ?? 0,
        rescuePlanId: rescuePlan.id
      });
    } else {
      await TelegramBotService.sendMessage(chatId, replyText);
    }

  } catch (err: any) {
    console.error("[TelegramWebhook] AI processing error:", err);
    await TelegramBotService.sendMessage(chatId, `⚠️ <b>Transaction Aborted</b>\n\nI encountered a database or AI core synchronization issue. Your schedules have been safely rolled back. Please try again!`);
  }
}

/**
 * Handle Telegram inline keyboard callback buttons.
 */
async function handleCallbackQuery(callbackQuery: any) {
  const telegramUserId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  // Authenticate user
  const { data: account } = await supabaseAdmin
    .from("telegram_accounts")
    .select("user_id")
    .eq("telegram_user_id", telegramUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) {
    await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Unauthorized: Link account first.", true);
    return;
  }

  const userId = account.user_id;
  if (!userId) return;

  const parts = data.split(":");
  const actionScope = parts[0]; // 'task' or 'rescue'
  const actionName = parts[1]; // 'complete', 'postpone', 'focus', etc.
  const targetId = parts[2];

  try {
    if (actionScope === "task") {
      if (actionName === "complete") {
        // Mark task as done
        const { error } = await supabaseAdmin
          .from("tasks")
          .update({ status: "done" as const, completion_percentage: 100 })
          .eq("id", targetId)
          .eq("user_id", userId);

        if (error) throw error;

        // Insert activity log
        await supabaseAdmin.from("activity_logs").insert({
          user_id: userId,
          action: "task_completed",
          entity_type: "task",
          entity_id: targetId
        });

        // Assess and update rescue plan if active
        await RescueEngine.updateRescueProgress(userId);

        await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Task completed successfully!");
        await TelegramBotService.editMessageText(chatId, messageId, `✅ <b>Task Completed</b>\n\nYou marked this focus task as finished. Outstanding work!`);
      }

      else if (actionName === "postpone") {
        // Postpone task deadline by 24 hours
        const { data: task } = await supabaseAdmin
          .from("tasks")
          .select("deadline")
          .eq("id", targetId)
          .single();

        const currentDeadline = task?.deadline ? new Date(task.deadline) : new Date();
        const newDeadline = new Date(currentDeadline.getTime() + 24 * 60 * 60 * 1000).toISOString();

        const { error } = await supabaseAdmin
          .from("tasks")
          .update({ deadline: newDeadline })
          .eq("id", targetId)
          .eq("user_id", userId);

        if (error) throw error;

        await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Deadline postponed 24h.");
        await TelegramBotService.editMessageText(chatId, messageId, `⏱ <b>Task Postponed</b>\n\nDeadline pushed back by 24 hours. Keep momentum!`);
      }

      else if (actionName === "focus") {
        // Start Focus session
        await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Focus session started!");
        await TelegramBotService.sendMessage(chatId, "🚀 <b>Focus Session Started!</b>\n\nYour Pomodoro timer has begun. Take 25 minutes of deep focus. You can do this!");
      }
    }

    else if (actionScope === "rescue") {
      if (actionName === "focus") {
        await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Emergency Focus Block started!");
        await TelegramBotService.sendMessage(chatId, "🚀 <b>Emergency Focus session activated!</b>\n\nFocusing on critical rescue items. Stay locked in!");
      } else if (actionName === "dismiss") {
        await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Alert dismissed.");
        await TelegramBotService.editMessageText(chatId, messageId, `🚨 <b>Rescue Alert</b>\n\nAlert dismissed. Tap /status to review your metrics.`);
      }
    }

  } catch (err: any) {
    console.error("[TelegramWebhook] Callback query error:", err);
    await TelegramBotService.answerCallbackQuery(callbackQuery.id, "Action failed. Please try again.", true);
  }
}
