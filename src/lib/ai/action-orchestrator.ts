import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { ReminderService } from "./reminder-service";
import { MemoryService } from "./memory-service";
import { ProbabilityEngine } from "./probability-engine";

export type OrchestratorActionPayload = {
  chat_response: string;
  extracted_tasks?: Array<{
    title: string;
    description?: string | null;
    deadline?: string | null;
    priority?: "critical" | "high" | "medium" | "low";
    estimated_duration?: number | null;
    priority_score?: number;
    risk_level?: "low" | "medium" | "high" | "critical";
    completion_probability?: number;
    subtasks?: string[];
    dependencies?: string[];
    missing_information?: string | null;
  }>;
  extracted_reminders?: Array<{
    title: string;
    reminder_time: string; // relative or absolute
    reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
    recurrence_pattern?: string | null;
  }>;
  extracted_goals?: Array<{
    title: string;
    description?: string | null;
    target_date?: string | null;
    milestones?: string[];
  }>;
  execution_plan?: {
    today: string[];
    tomorrow: string[];
    weekly: string[];
    estimated_finish_time?: string | null;
    recommended_work_blocks?: string | null;
  } | null;
  memory_updates?: Array<{
    key: string;
    value: string;
    importance?: number;
  }>;
};

export class ActionOrchestrator {
  /**
   * Main orchestrator execution method. Runs all inserts and updates.
   * If any database operation fails, it executes a logical rollback (deleting created entities)
   * to guarantee transactional database consistency.
   */
  static async execute(
    userId: string,
    payload: OrchestratorActionPayload,
    supabase: SupabaseClient<Database>,
    userMessageContent: string
  ) {
    console.log(`[ActionOrchestrator] Starting transaction for user ${userId}...`);

    // Keep track of all created record IDs to support logical rollbacks
    const createdTasks: string[] = [];
    const createdReminders: string[] = [];
    const createdGoals: string[] = [];
    const createdMemories: string[] = [];

    try {
      // 1. Process Memories (Long Term AI Memory)
      if (payload.memory_updates && payload.memory_updates.length > 0) {
        console.log(`[ActionOrchestrator] Saving ${payload.memory_updates.length} memories...`);
        for (const mem of payload.memory_updates) {
          const { data, error } = await supabase
            .from("user_memories")
            .upsert(
              {
                user_id: userId,
                memory_key: mem.key,
                memory_value: mem.value,
                importance: mem.importance || 3,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id, memory_key" }
            )
            .select()
            .single();

          if (error) throw new Error(`Memory upsert failed: ${error.message}`);
          if (data) createdMemories.push(data.id);
        }
      } else {
        // Fallback to extract memory statements directly from the message text
        await MemoryService.extractAndSaveMemory(userId, userMessageContent).catch((err) => {
          console.warn("[ActionOrchestrator] Non-blocking memory extraction issue:", err);
        });
      }

      // 2. Process Extracted Goals & Milestones
      if (payload.extracted_goals && payload.extracted_goals.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_goals.length} strategic goals...`);
        for (const g of payload.extracted_goals) {
          const { data: goalData, error: goalError } = await supabase
            .from("goals")
            .insert({
              user_id: userId,
              title: g.title,
              description: g.description || null,
              target_date: g.target_date || null,
              status: "active" as const,
            })
            .select()
            .single();

          if (goalError) throw new Error(`Goal creation failed: ${goalError.message}`);
          if (goalData) {
            createdGoals.push(goalData.id);

            // Create sub-milestones
            if (g.milestones && g.milestones.length > 0) {
              const milestonePayload = g.milestones.map((mTitle) => ({
                goal_id: goalData.id,
                title: mTitle,
                status: "todo" as const,
              }));

              const { error: mileError } = await supabase
                .from("milestones")
                .insert(milestonePayload);

              if (mileError) throw new Error(`Milestones insertion failed: ${mileError.message}`);
            }

            // Log activity
            await supabase.from("activity_logs").insert({
              user_id: userId,
              action: "goal_created",
              entity_type: "goal",
              entity_id: goalData.id,
            });
          }
        }
      }

      // 3. Process Extracted Tasks & Subtasks (Persistent Task Engine)
      const taskMap = new Map<string, string>(); // maps task title -> created UUID for dependency linking
      if (payload.extracted_tasks && payload.extracted_tasks.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_tasks.length} tasks...`);
        
        for (const t of payload.extracted_tasks) {
          const { data: taskData, error: taskError } = await supabase
            .from("tasks")
            .insert({
              user_id: userId,
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

          if (taskError) throw new Error(`Task creation failed: ${taskError.message}`);
          if (taskData) {
            createdTasks.push(taskData.id);
            taskMap.set(t.title.toLowerCase(), taskData.id);

            // Insert subtasks (3-10 automatically chunked)
            if (t.subtasks && t.subtasks.length > 0) {
              const subtaskPayload = t.subtasks.map((subTitle) => ({
                task_id: taskData.id,
                title: subTitle,
                is_completed: false,
              }));

              const { error: subtaskError } = await supabase
                .from("subtasks")
                .insert(subtaskPayload);

              if (subtaskError) throw new Error(`Subtasks creation failed: ${subtaskError.message}`);
            }

            // Log activity
            await supabase.from("activity_logs").insert({
              user_id: userId,
              action: "task_created",
              entity_type: "task",
              entity_id: taskData.id,
              metadata: {
                priority_score: t.priority_score,
                risk_level: t.risk_level,
                autonomous: true,
              },
            });
          }
        }

        // Link dependencies using the created IDs instead of string titles
        for (const taskId of createdTasks) {
          const { data: task } = await supabase
            .from("tasks")
            .select("dependencies")
            .eq("id", taskId)
            .single();

          if (task && Array.isArray(task.dependencies) && task.dependencies.length > 0) {
            const resolvedIds = (task.dependencies as string[])
              .map((depName) => taskMap.get(depName.toLowerCase()))
              .filter((id): id is string => !!id);

            if (resolvedIds.length > 0) {
              await supabase
                .from("tasks")
                .update({ dependencies: resolvedIds })
                .eq("id", taskId);
            }
          }
        }
      }

      // 4. Process Reminders (Persistent Reminder Engine)
      if (payload.extracted_reminders && payload.extracted_reminders.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_reminders.length} reminders...`);
        for (const rem of payload.extracted_reminders) {
          // Attempt to link the reminder to a newly created task or existing task if the title matches
          let associatedTaskId: string | null = null;
          const matchTitle = rem.title.toLowerCase();
          if (taskMap.has(matchTitle)) {
            associatedTaskId = taskMap.get(matchTitle) || null;
          } else {
            // Check existing tasks
            const { data: existingTask } = await supabase
              .from("tasks")
              .select("id")
              .eq("user_id", userId)
              .ilike("title", rem.title)
              .limit(1)
              .maybeSingle();

            if (existingTask) {
              associatedTaskId = existingTask.id;
            }
          }

          const reminderData = await ReminderService.createReminder(
            userId,
            {
              title: rem.title,
              reminder_time: rem.reminder_time,
              reminder_type: rem.reminder_type || "specific_time",
              recurrence_pattern: rem.recurrence_pattern || null,
              task_id: associatedTaskId,
            },
            supabase
          );

          if (reminderData) {
            createdReminders.push(reminderData.id);
            
            // Log activity
            await supabase.from("activity_logs").insert({
              user_id: userId,
              action: "reminder_created",
              entity_type: "reminder",
              entity_id: reminderData.id,
            });
          }
        }
      }

      if (payload.execution_plan) {
        console.log(`[ActionOrchestrator] Saving execution plan...`);
        const { error: planError } = await supabase
          .from("execution_plans")
          .upsert(
            {
              user_id: userId,
              plan_type: "daily" as const,
              plan_data: payload.execution_plan,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id, plan_type" }
          );

        if (planError) {
          // Fallback to delete and insert if upsert fails
          await supabase
            .from("execution_plans")
            .delete()
            .match({ user_id: userId, plan_type: "daily" });

          const { error: insertError } = await supabase.from("execution_plans").insert({
            user_id: userId,
            plan_type: "daily" as const,
            plan_data: payload.execution_plan,
          });

          if (insertError) throw new Error(`Execution plan save failed: ${insertError.message}`);
        }
      }

      // 6. Recalculate Probabilities & Streaks
      await ProbabilityEngine.updateAllProbabilitiesAndSaveHistory(userId).catch((err) => {
        console.warn("[ActionOrchestrator] Non-blocking analytics update issue:", err);
      });

      console.log("[ActionOrchestrator] Transaction committed successfully!");
      return {
        success: true,
        createdTasks,
        createdReminders,
        createdGoals,
      };

    } catch (err: any) {
      console.error("[ActionOrchestrator] Transaction failed. Executing logical rollback...", err.message);

      // Logical Rollback Loop: Delete all inserted rows in reverse order to preserve integrity
      try {
        if (createdReminders.length > 0) {
          console.log(`[ActionOrchestrator Rollback] Deleting ${createdReminders.length} reminders...`);
          await supabase.from("reminders").delete().in("id", createdReminders);
        }
        if (createdTasks.length > 0) {
          console.log(`[ActionOrchestrator Rollback] Deleting ${createdTasks.length} tasks...`);
          await supabase.from("tasks").delete().in("id", createdTasks);
        }
        if (createdGoals.length > 0) {
          console.log(`[ActionOrchestrator Rollback] Deleting ${createdGoals.length} goals...`);
          await supabase.from("goals").delete().in("id", createdGoals);
        }
        if (createdMemories.length > 0) {
          console.log(`[ActionOrchestrator Rollback] Deleting ${createdMemories.length} memories...`);
          await supabase.from("user_memories").delete().in("id", createdMemories);
        }
      } catch (rollbackErr: any) {
        console.error("[ActionOrchestrator Rollback] Secondary rollback error:", rollbackErr.message);
      }

      throw err; // rethrow to handle in the main route handler
    }
  }
}
