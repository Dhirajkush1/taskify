import { type NextRequest, NextResponse } from "next/server";
import { runAutonomousGemini, runAutonomousGroq } from "@/lib/ai/ai-service";
import { createClient } from "@/lib/supabase/server";

interface ExtractRequestBody {
  text?: string;
  file?: string; // base64 string
  mimeType?: string; // e.g. "application/pdf" or "image/png"
  provider?: "gemini" | "groq";
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractRequestBody = await request.json();
    const { text, file, mimeType, provider = "gemini" } = body;

    if (!text && !file) {
      return NextResponse.json(
        { error: "Either text or file attachment is required" },
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

    // --- SELF-HEALING DATABASE BLOCK ---
    // Check if the user profile exists in public.users. If it's missing, insert it.
    // This prevents foreign key violations (tasks_user_id_fkey) for users created before migrations were run.
    const { data: publicUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!publicUser) {
      console.log(`[Self-Healing] Public profile missing in public.users for ID ${user.id} during extraction. Creating...`);
      const { error: insertUserError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url || null,
        });

      if (insertUserError) {
        console.error("[Self-Healing] Failed to create public user profile in extract:", insertUserError.message);
      } else {
        console.log("[Self-Healing] Public user profile self-healed successfully in extract!");
        // Ensure settings record exists
        await supabase.from("settings").insert({ user_id: user.id });
      }
    }
    // -----------------------------------

    let aiOutput;

    if (provider === "groq") {
      // Groq is text-only
      if (file) {
        return NextResponse.json(
          { error: "Groq does not support file uploads. Please switch to Gemini to upload documents!" },
          { status: 400 }
        );
      }
      aiOutput = await runAutonomousGroq([
        { role: "user", content: text || "Extract tasks from my request." },
      ]);
    } else {
      // Gemini supports multimodal
      const fileAttachment =
        file && mimeType ? { base64Data: file, mimeType } : undefined;

      aiOutput = await runAutonomousGemini(
        [
          {
            role: "user",
            parts: text ? [{ text }] : [],
          },
        ],
        fileAttachment
      );
    }

    // Perform database insertion of extracted tasks & chunked subtasks
    const insertedTasks = [];
    if (aiOutput.extracted_tasks && aiOutput.extracted_tasks.length > 0) {
      for (const t of aiOutput.extracted_tasks) {
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: t.title,
            description: t.description || null,
            deadline: t.deadline || null,
            priority: (t.priority || "medium") as "critical" | "high" | "medium" | "low",
            status: "todo" as const,
            estimated_duration: t.estimated_duration || null,
            completion_percentage: 0,
            priority_score: t.priority_score || 0,
            risk_level: (t.risk_level || "low") as "low" | "medium" | "high" | "critical",
            completion_probability: t.completion_probability ?? 100,
            dependencies: t.dependencies || [],
            missing_information: t.missing_information || null,
          })
          .select()
          .single();

        if (taskError) {
          console.error("Error saving extracted task:", taskError.message);
          continue;
        }

        if (taskData) {
          insertedTasks.push(taskData);

          // Save chunked subtasks
          if (t.subtasks && t.subtasks.length > 0) {
            const subtasksPayload = t.subtasks.map((title) => ({
              task_id: taskData.id,
              title,
              is_completed: false,
            }));

            await supabase.from("subtasks").insert(subtasksPayload);
          }

          // Log activity
          await supabase.from("activity_logs").insert({
            user_id: user.id,
            action: "task_created",
            entity_type: "task",
            entity_id: taskData.id,
            metadata: {
              autonomous: true,
              source: file ? "upload" : "text",
            },
          });
        }
      }
    }

    // Save/Update the execution plan if returned
    if (aiOutput.execution_plan) {
      try {
        await supabase.from("execution_plans").upsert(
          {
            user_id: user.id,
            plan_type: "daily" as const,
            plan_data: aiOutput.execution_plan,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, plan_type" }
        );
      } catch {
        // Fallback delete/insert
        try {
          await supabase
            .from("execution_plans")
            .delete()
            .match({ user_id: user.id, plan_type: "daily" });
          
          await supabase.from("execution_plans").insert({
            user_id: user.id,
            plan_type: "daily" as const,
            plan_data: aiOutput.execution_plan,
          });
        } catch (err) {
          console.error("Failed to fallback insert execution plan:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      chat_response: aiOutput.chat_response,
      tasks: insertedTasks,
      execution_plan: aiOutput.execution_plan,
      coaching_advice: aiOutput.coaching_advice,
    });
  } catch (error: any) {
    console.error("[/api/ai/extract] Autonomous extraction failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
