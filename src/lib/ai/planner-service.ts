import { createClient } from "@/lib/supabase/server";
import { AIClient } from "./providers";
import { ContextBuilder } from "./context-builder";
import type { Task } from "@/types/app.types";

export interface TimeBlock {
  time: string; // e.g. "09:00 - 10:30"
  task_title: string;
  duration_minutes: number;
}

export interface NextBestAction {
  title: string;
  estimated_time: number;
  reason: string;
}

export class PlannerService {
  /**
   * Generates a dynamic Next Best Action based on tasks queue.
   * Considers priority score, dependencies, effort, and deadlines.
   */
  static getNextBestAction(tasks: Task[]): NextBestAction | null {
    const pending = tasks.filter((t) => t.status !== "done" && t.status !== "archived");
    if (pending.length === 0) return null;

    // Sort by priority_score descending, and ensure parent dependencies are satisfied
    const sorted = [...pending].sort((a, b) => {
      const scoreA = Number(a.priority_score) || 0;
      const scoreB = Number(b.priority_score) || 0;
      return scoreB - scoreA;
    });

    // Find the first task that has NO active blocking dependencies
    const nextTask = sorted.find((task) => {
      const deps = (task.dependencies as string[]) || [];
      if (deps.length === 0) return true;

      // Check if all dependencies are marked completed (or not in the pending queue)
      const hasActiveBlockingDeps = deps.some((depTitle) => {
        const parent = pending.find((p) => p.title.toLowerCase().trim() === depTitle.toLowerCase().trim());
        return parent && parent.status !== "done";
      });
      return !hasActiveBlockingDeps;
    });

    // Fallback to the highest priority task if all are blocked
    const selectedTask = nextTask || sorted[0];

    // Build the reasoning string
    let reason = "This is your highest priority task with the closest deadline.";
    const deps = (selectedTask.dependencies as string[]) || [];
    if (deps.length > 0) {
      reason = `Important foundation. It depends on [${deps.join(", ")}], let's unlock these!`;
    } else if (Number(selectedTask.priority_score) > 80) {
      reason = "Urgent: High risk of missing deadline. Highly recommended deep work focus.";
    } else if (selectedTask.estimated_duration && selectedTask.estimated_duration < 20) {
      reason = "Quick Win: Low effort task. Finish this now to clear cognitive load.";
    }

    return {
      title: selectedTask.title,
      estimated_time: selectedTask.estimated_duration || 30,
      reason,
    };
  }

  /**
   * Uses Gemini to perform Adaptive Rescheduling and Hour-Blocked Time Slot planning.
   * Triggered when tasks are overdue or skipped.
   */
  static async regenerateTimeBlockPlan(userId: string): Promise<any> {
    // 1. Build rich context containing memories, current plan, and tasks
    const context = await ContextBuilder.buildContext(userId, "regenerate my schedule, reschedule overdue items");

    const systemInstruction = `
You are Clutch AI's Planner Engine. Your goal is to map out a precise, hour-blocked schedule (Time Blocks) and execution plans.
Analyze the user's unfinished tasks, preferences (memories), active schedule, and deadlines.
Whenever tasks are overdue, redistribute the workload evenly to keep it balanced. DO NOT simply slide the deadlines forward; create an optimized time-blocked route.

Your response MUST be a single, strictly valid JSON object.

JSON SCHEMA:
{
  "today": [
    "09:00 AM - 10:30 AM: Deep work on [Task Title]",
    "11:00 AM - 11:30 AM: Review [Task Title]"
  ],
  "tomorrow": [
    "10:00 AM - 11:30 AM: Code [Task Title]"
  ],
  "weekly": [
    "Focus on completing [Task Title] before Friday"
  ],
  "estimated_finish_time": "Estimated completion date",
  "recommended_work_blocks": "Focus guidelines (e.g. 45-min pomodoros)"
}

Ensure all time slots match the user's preferred work hours or study times if specified in the context memories.
`;

    const prompt = `
${context.promptContextString}

Please regenerate my daily and weekly execution plans now. 
Some tasks might be overdue or skipped. 
Optimize my workload and map out specific hour-blocked time blocks for today and tomorrow.
`;

    const text = await AIClient.generateText(
      [
        { role: "user" as const, content: prompt }
      ],
      {
        provider: "gemini",
        model: "gemini-1.5-flash",
        systemPrompt: systemInstruction,
        responseMimeType: "application/json"
      }
    );

    try {
      const planData = JSON.parse(text);
      
      // Save plan back to Supabase
      const supabase = await createClient();
      const { error: upsertError } = await supabase.from("execution_plans").upsert(
        {
          user_id: userId,
          plan_type: "daily",
          plan_data: planData as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, plan_type" }
      );

      if (upsertError) {
        console.warn("[PlannerService] Upsert failed, running fallback delete & insert:", upsertError.message);
        // Fallback delete/insert
        await supabase
          .from("execution_plans")
          .delete()
          .match({ user_id: userId, plan_type: "daily" });

        const { error: insertError } = await supabase.from("execution_plans").insert({
          user_id: userId,
          plan_type: "daily",
          plan_data: planData as any,
        });

        if (insertError) {
          console.error("[PlannerService] Fallback insert failed:", insertError.message);
        }
      }

      return planData;
    } catch (err) {
      console.error("[PlannerService] Failed to parse regenerated schedule JSON:", text);
      throw new Error("Failed to generate plan");
    }
  }
}
