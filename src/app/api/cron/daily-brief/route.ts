import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AIClient } from "@/lib/ai/providers";
import { TelegramBotService } from "@/lib/telegram/bot-service";
import { format, startOfDay, endOfDay } from "date-fns";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");

    const supabase = createServiceClient() as any;
    
    // 1. Fetch target users (either a specific user or all connected users)
    let usersToProcess: string[] = [];
    if (queryUserId) {
      usersToProcess.push(queryUserId);
    } else {
      const { data: accounts } = await supabase
        .from("google_accounts")
        .select("user_id");
      usersToProcess = (accounts || []).map((a: any) => a.user_id);
    }

    const results = [];

    for (const userId of usersToProcess) {
      try {
        console.log(`[DailyBrief] Generating morning briefing for user ${userId}`);

        // Fetch user's settings, calendar events, and tasks
        const [settingsRes, eventsRes, tasksRes] = await Promise.all([
          supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("calendar_events").select("*").eq("user_id", userId).gte("start_time", startOfDay(new Date()).toISOString()).lte("start_time", endOfDay(new Date()).toISOString()),
          supabase.from("tasks").select("*").eq("user_id", userId).neq("status", "done").neq("status", "archived")
        ]);

        const settings = settingsRes.data;
        const events = eventsRes.data || [];
        const tasks = tasksRes.data || [];

        if (!settings) continue;

        const timezone = settings.timezone || "UTC";

        // Formulate user local time context
        const localDateStr = format(new Date(), "yyyy-MM-dd");

        // Format calendar events and tasks into text context
        const eventsText = events.map((e: any) => 
          `- "${e.title}" (${e.event_type}) starting at ${format(new Date(e.start_time), "hh:mm a")} to ${format(new Date(e.end_time), "hh:mm a")} ${e.location ? `at ${e.location}` : ""}`
        ).join("\n") || "No calendar commitments scheduled today.";

        const tasksText = tasks.map((t: any) => 
          `- Task: "${t.title}" (Priority: ${t.priority}, Due: ${t.deadline || "No deadline"})`
        ).join("\n") || "No pending tasks in queue.";

        const systemPrompt = `You are Clutch AI's Daily Planner.
Generate a structured, high-energy, and encouraging Morning Briefing based on the user's schedule and pending tasks for today.
Your output MUST be a valid JSON object matching the schema below.

JSON SCHEMA:
{
  "html_brief": "A warm, high-impact conversational morning summary. Include emojis and formatted HTML tags (<b>, <i>, <code>). Maximum 3 paragraphs. Highlight priorities.",
  "meetings": ["Important meeting summary with times"],
  "focus_blocks": ["Suggested focus blocks based on free times"],
  "breaks": ["Break advice (e.g. stretch after the 11 AM sync)"]
}

Respond ONLY with this JSON. No explanation, no backticks.`;

        const userContext = `Today's Date: ${localDateStr}
User timezone: ${timezone}

CALENDAR COMMITMENTS TODAY:
${eventsText}

PENDING TASKS QUEUE:
${tasksText}`;

        const responseText = await AIClient.generateText(
          [{ role: "user" as const, content: userContext }],
          {
            provider: "gemini",
            model: "gemini-1.5-flash",
            systemPrompt,
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        );

        const cleaned = responseText.replace(/```json/gi, "").replace(/```/gi, "").trim();
        const briefData = JSON.parse(cleaned);

        // Save brief to user's activity logs / notifications so they see it on the Dashboard
        await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "DailyBriefGenerated",
          entity_type: "system",
          metadata: {
            date: localDateStr,
            brief: briefData
          }
        });

        // 2. Dispatch to Telegram if connected & preferences allow
        const { data: telegramAccount } = await supabase
          .from("telegram_accounts")
          .select("chat_id, is_active")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("telegram_enabled, daily_debrief_enabled")
          .eq("user_id", userId)
          .maybeSingle();

        if (telegramAccount?.chat_id && prefs?.telegram_enabled !== false && prefs?.daily_debrief_enabled !== false) {
          const telegramMessage = `☀️ <b>GOOD MORNING BRIEFING</b> ☀️\n\n${briefData.html_brief}\n\n<b>Today's Focus blocks:</b>\n${briefData.focus_blocks.map((b: string) => `• ${b}`).join("\n") || "• Clear path! Schedule deep-work blocks."}\n\n🍀 <i>Let's make today productive and focused!</i>`;
          
          await TelegramBotService.sendMessage(telegramAccount.chat_id, telegramMessage);
          console.log(`[DailyBrief] Sent Telegram morning brief to user ${userId}`);
        }

        results.push({ userId, success: true });
      } catch (err: any) {
        console.error(`[DailyBrief] Failed to process brief for user ${userId}:`, err);
        results.push({ userId, success: false, error: err.message });
      }
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (err: any) {
    console.error("[DailyBrief] Fatal route error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
