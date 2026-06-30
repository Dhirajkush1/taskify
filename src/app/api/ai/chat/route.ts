import { type NextRequest, NextResponse } from "next/server";
import { AIClient, AIConfig } from "@/lib/ai/providers";
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

    // 1. Run Unified processMessage Pipeline
    let parsedData: any;
    let responsePayloadToStream = "";
    try {
      parsedData = await ActionOrchestrator.processMessage(user.id, lastMessageContent, supabase, {
        source: "web"
      });
      responsePayloadToStream = JSON.stringify(parsedData);
    } catch (err: any) {
      console.error("[ChatRoute] ActionOrchestrator.processMessage failed:", err);
      
      const errorPayload = {
        chat_response: `⚠️ I encountered an issue: ${err.message || "Execution error"}. Please try again.`,
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
