import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/types/app.types";

export class ProbabilityEngine {
  /**
   * Dynamically calculates the completion probability of a task.
   * Considers urgency, complexity (estimated duration), completed subtasks ratio, and dependency chain.
   */
  static calculateTaskProbability(
    task: Task,
    subtasks: Array<{ is_completed: boolean }>,
    allTasks: Task[]
  ): number {
    if (task.status === "done") return 100;
    if (task.status === "archived") return 0;

    // 1. Urgency factor
    let urgencyPenalty = 0;
    if (task.deadline) {
      const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft < 0) {
        urgencyPenalty = 80; // Extremely low probability if overdue
      } else if (hoursLeft < 3) {
        urgencyPenalty = 50;
      } else if (hoursLeft < 12) {
        urgencyPenalty = 30;
      } else if (hoursLeft < 24) {
        urgencyPenalty = 15;
      }
    }

    // 2. Effort complexity factor (longer tasks are harder to finish)
    const duration = task.estimated_duration || 60;
    const complexityPenalty = Math.min(25, Math.round((duration / 60) * 5));

    // 3. Subtask completion bonus
    let subtaskBonus = 0;
    if (subtasks && subtasks.length > 0) {
      const completed = subtasks.filter((s) => s.is_completed).length;
      subtaskBonus = Math.round((completed / subtasks.length) * 30); // Up to 30% bonus for finishing subtasks
    }

    // 4. Dependency penalty
    let dependencyPenalty = 0;
    const deps = (task.dependencies as string[]) || [];
    if (deps.length > 0) {
      const activeDeps = deps.filter((depTitle) => {
        const parent = allTasks.find((t) => t.title.toLowerCase().trim() === depTitle.toLowerCase().trim());
        return parent && parent.status !== "done";
      });
      dependencyPenalty = activeDeps.length * 15; // 15% penalty for each incomplete blocking task
    }

    const baseProbability = 90; // Start at 90%
    const probability = baseProbability - urgencyPenalty - complexityPenalty + subtaskBonus - dependencyPenalty;

    return Math.min(100, Math.max(10, Math.round(probability)));
  }

  /**
   * Recalculates and updates the completion probability for all pending tasks,
   * and saves the overall average to historical analytics.
   */
  static async updateAllProbabilitiesAndSaveHistory(userId: string): Promise<void> {
    const supabase = await createClient();

    // 1. Fetch tasks and subtasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "archived");

    if (!tasks || tasks.length === 0) return;

    let totalProb = 0;
    let pendingCount = 0;

    for (const task of tasks) {
      const { data: subtasks } = await supabase
        .from("subtasks")
        .select("is_completed")
        .eq("task_id", task.id);

      const probability = this.calculateTaskProbability(task, subtasks || [], tasks);
      
      // Save probability back to task row
      await supabase
        .from("tasks")
        .update({ completion_probability: probability })
        .eq("id", task.id);

      if (task.status !== "done") {
        totalProb += probability;
        pendingCount++;
      }
    }

    // 2. Calculate average and save historical log
    const avgProbability = pendingCount > 0 ? Math.round(totalProb / pendingCount) : 100;
    const completedCount = tasks.filter((t) => t.status === "done").length;

    // Fetch total focus time today
    const todayDate = new Date().toISOString().split("T")[0];
    const { data: focusTimeToday } = await supabase
      .from("focus_sessions")
      .select("completed_minutes")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", todayDate + "T00:00:00Z");

    const totalFocusMinutes = (focusTimeToday || []).reduce((acc, f) => acc + (f.completed_minutes || 0), 0);

    // Upsert to productivity analytics history
    await supabase.from("productivity_analytics_history").upsert(
      {
        user_id: userId,
        recorded_date: todayDate,
        focus_time_minutes: totalFocusMinutes,
        tasks_completed_count: completedCount,
        completion_probability_average: avgProbability,
        details: {
          total_tasks: tasks.length,
          pending_tasks: pendingCount,
          updated_at: new Date().toISOString()
        }
      },
      { onConflict: "user_id, recorded_date" }
    );
  }
}
