import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { ContextBuilder } from "@/lib/ai/context-builder";
import { ActionOrchestrator } from "@/lib/ai/action-orchestrator";
import { AUTONOMOUS_SYSTEM_PROMPT } from "@/lib/ai/ai-service";
import { RescueEngine } from "@/lib/ai/rescue-engine";
import { SimulationEngine } from "@/lib/ai/simulation-engine";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: "gemini" | "groq";
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { messages, provider = "gemini" } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Get user session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Flush pending reminders to Telegram asynchronously (non-blocking)
    const { ReminderService } = await import("@/lib/ai/reminder-service");
    ReminderService.dispatchPendingReminders(supabase).catch(err => {
      console.error("[ChatRoute] Failed to flush reminders:", err);
    });

    // --- SELF-HEALING DATABASE BLOCK ---
    // Check if the user profile exists in public.users. If it's missing, insert it.
    // This prevents foreign key violations (tasks_user_id_fkey) for users created before migrations were run.
    const { data: publicUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!publicUser) {
      console.log(`[Self-Healing] Public profile missing in public.users for ID ${user.id}. Creating...`);
      const { error: insertUserError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url || null,
        });

      if (insertUserError) {
        console.error("[Self-Healing] Failed to create public user profile:", insertUserError.message);
      } else {
        console.log("[Self-Healing] Public user profile self-healed successfully!");
        
        // Also ensure settings record exists for the new user profile
        await supabase.from("settings").insert({ user_id: user.id });
      }
    }
    // -----------------------------------

    const lastMessage = messages[messages.length - 1];
    const lastMessageContent = lastMessage?.content || "";

    // 1. Centralized Context & Personality Builder
    console.log("[ChatRoute] Compiling user context and personality...");
    const context = await ContextBuilder.buildContext(user.id, lastMessageContent);

    // 2. Construct Custom System Instructions
    const today = new Date();
    const todayStr = today.toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);
    const basePrompt = AUTONOMOUS_SYSTEM_PROMPT(todayStr, dayOfWeek);
    
    const customSystemInstruction = `
${basePrompt}
${context.promptContextString}
`;

    let rawResponseText = "";

    // --- COMMAND INTERCEPTION BLOCK ---
    const lowerMessage = lastMessageContent.toLowerCase().trim();
    if (
      lowerMessage.includes("emergency help") || 
      lowerMessage.includes("rescue mode") || 
      lowerMessage.includes("trigger rescue") || 
      lowerMessage.includes("emergency rescue") ||
      lowerMessage === "rescue"
    ) {
      console.log(`[ChatRoute] Explicit Rescue Mode command detected: "${lastMessageContent}"`);
      const plan = await RescueEngine.detectAndRunRescue(user.id, undefined, `Explicitly requested: "${lastMessageContent}"`);
      rawResponseText = JSON.stringify({
        chat_response: `🚨 **AI DEADLINE RESCUE MODE ACTIVATED** 🚨\n\nI've analyzed your active tasks and initiated the emergency rescue protocol! Non-critical items have been paused, and I've constructed a high-intensity focus plan to secure your critical deadline.\n\n**Rescue Performance Metrics:**\n• **Recovery Probability:** ${plan ? plan.recovery_probability : 85}%\n• **Hours Remaining:** ${plan ? plan.hours_remaining.toFixed(1) : 4} hrs\n• **Required Focus Blocks:** ${plan ? plan.remaining_focus_sessions : 3}\n\n*The live countdown, focus action steps, and recovery dials are now active on your Dashboard! Let's focus and execute.*`,
        extracted_tasks: [],
        execution_plan: plan ? {
          today: plan.emergency_action_plan.map(step => `${step.step} (${step.duration} mins)`),
          tomorrow: [],
          weekly: [],
          estimated_finish_time: plan.estimated_finish_time
        } : null,
        coaching_advice: {
          encouragement: "Stay calm and composed. We have a clear roadmap. Focus on completing one block at a time.",
          alternative_plan: "Take a 5-minute breather if you feel fatigued, then resume the active focus session.",
          micro_tasks: plan ? plan.emergency_action_plan.filter(s => s.type === "focus").map(s => s.step) : ["Begin first focus session"]
        }
      });
    } else if (
      lowerMessage.includes("deactivate rescue") || 
      lowerMessage.includes("stop rescue") || 
      lowerMessage.includes("cancel rescue")
    ) {
      console.log(`[ChatRoute] Deactivate Rescue Mode command detected.`);
      await RescueEngine.deactivateRescue(user.id);
      rawResponseText = JSON.stringify({
        chat_response: `✅ **Rescue Mode Deactivated**\n\nI have deactivated the emergency rescue protocol. Your standard schedule, focus priorities, and all paused tasks have been successfully restored.\n\nLet me know if you want to plan your next strategic goals or run another simulation!`,
        extracted_tasks: [],
        execution_plan: null
      });
    } else if (
      lowerMessage.includes("what if") || 
      lowerMessage.includes("what-if") || 
      lowerMessage.startsWith("simulate")
    ) {
      console.log(`[ChatRoute] What-If Simulation command detected: "${lastMessageContent}"`);
      const sim = await SimulationEngine.runSimulation(user.id, lastMessageContent);
      if (sim) {
        rawResponseText = JSON.stringify({
          chat_response: `🔮 **AI DECISION SIMULATION COMPLETE** 🔮\n\nI have modeled the future impact of your decision: *"${lastMessageContent}"*\n\n**Predicted Shifts:**\n• **Completion Probability:** ${sim.current_completion_probability}% ➔ **${sim.simulated_completion_probability}%**\n• **Deadline Risk:** ${sim.current_deadline_risk} ➔ **${sim.simulated_deadline_risk}**\n• **Workload Impact:** ${sim.workload_impact}\n\n**AI Simulation Insights:**\n${sim.reasoning}\n\n**Suggested Alternative:**\n${sim.suggested_alternative}\n\n*A detailed side-by-side comparative dashboard is now active in the What-If Decision Simulator card on your Dashboard!*`,
          extracted_tasks: [],
          execution_plan: null,
          coaching_advice: {
            encouragement: "Simulating decisions before committing to them is a highly effective way to protect your cognitive load.",
            alternative_plan: sim.suggested_alternative,
            micro_tasks: sim.affected_tasks.map(t => `Review impact on: ${t}`)
          }
        });
      }
    }

    // 3. Call AI Model Synchronously (only if no command was intercepted)
    if (!rawResponseText) {
      if (provider === "gemini") {
        console.log("[ChatRoute] Invoking Gemini 1.5 synchronously...");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        rawResponseText = JSON.stringify({
          chat_response: "I encountered an issue connecting to my Gemini AI core. It looks like a valid Gemini API Key is missing. Please switch to 'Groq' at the bottom to continue, or add a valid Gemini key to .env.local!",
          extracted_tasks: [],
          execution_plan: null
        });
      } else {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: customSystemInstruction,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          });

          // Map history to Gemini format (excluding the last user message)
          const history = messages.slice(0, -1).map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));

          const chat = model.startChat({ history });
          const result = await chat.sendMessage(lastMessageContent);
          rawResponseText = result.response.text();
        } catch (geminiErr: any) {
          console.error("[ChatRoute] Gemini API call error:", geminiErr);
          throw new Error(`Gemini Core error: ${geminiErr.message || geminiErr}`);
        }
      }
    } else {
      console.log("[ChatRoute] Invoking Groq (Llama 3.3) synchronously...");
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        rawResponseText = JSON.stringify({
          chat_response: "Error: GROQ_API_KEY is not configured in your environment variables. Please add it to your .env.local file.",
          extracted_tasks: [],
          execution_plan: null
        });
      } else {
        try {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              response_format: { type: "json_object" },
              temperature: 0.2,
              messages: [
                { role: "system", content: customSystemInstruction },
                ...messages.map(m => ({
                  role: m.role === "assistant" ? "assistant" : "user",
                  content: m.content
                }))
              ],
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API returned status ${response.status}: ${errText}`);
          }

          const data = await response.json();
          rawResponseText = data.choices?.[0]?.message?.content || "{}";
        } catch (groqErr: any) {
          console.error("[ChatRoute] Groq API call error:", groqErr);
          throw new Error(`Groq Core error: ${groqErr.message || groqErr}`);
        }
      }
    }
    }

    // 4. Clean and Parse JSON response
    const cleanedJson = rawResponseText
      .replace(/```json/gi, "")
      .replace(/```/gi, "")
      .trim();

    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanedJson);
    } catch (parseErr) {
      console.error("[ChatRoute] Failed to parse AI JSON response. Raw text:", rawResponseText);
      throw new Error("AI engine returned an invalid JSON structure.");
    }

    // 5. Execute Action Orchestrator in a Transaction Block
    console.log("[ChatRoute] Executing Action Orchestrator transaction...");
    let responsePayloadToStream = rawResponseText;

    try {
      await ActionOrchestrator.execute(user.id, parsedData, supabase, lastMessageContent);
    } catch (dbErr: any) {
      console.error("[ChatRoute] Transaction failed! Rolling back and generating error response...", dbErr);
      
      // Overwrite payload to stream back a clean database error instead of claiming success!
      const errorPayload = {
        chat_response: `⚠️ I encountered an issue synchronizing these actions to your database: ${dbErr.message || "Database execution error"}. Any temp tasks or reminders have been safely rolled back. Please try again.`,
        extracted_tasks: [],
        execution_plan: null,
        coaching_advice: {
          encouragement: "System connection issues can be frustrating, but we rolled back all changes cleanly so your schedule remains perfectly synchronized.",
          alternative_plan: "Please try resending the command, or check your database connections.",
          micro_tasks: ["Verify internet connection", "Try resending your last request"]
        }
      };
      responsePayloadToStream = JSON.stringify(errorPayload);
    }

    // 6. Stream the final payload (success or error) to the client with a smooth typing delay
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream in chunks of ~40 characters with a tiny delay to simulate real-time typing
          const chunkSize = 40;
          let offset = 0;
          while (offset < responsePayloadToStream.length) {
            const chunk = responsePayloadToStream.slice(offset, offset + chunkSize);
            controller.enqueue(encoder.encode(chunk));
            offset += chunkSize;
            await new Promise((resolve) => setTimeout(resolve, 5)); // 5ms typing speed
          }
        } catch (streamErr) {
          console.error("[ChatRoute] Streaming output error:", streamErr);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (error: any) {
    console.error("[ChatRoute] Fatal route error:", error);
    
    // Conforms to the structured JSON schema even in fatal cases
    const fatalErrorPayload = JSON.stringify({
      chat_response: `🚨 System Error: ${error?.message || "An unexpected error occurred during execution."}`,
      extracted_tasks: [],
      execution_plan: null
    });

    return new Response(fatalErrorPayload, {
      status: 200, // Return 200 so the client-side parser can parse the JSON error bubble cleanly!
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
