import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ReminderService } from "./reminder-service";
import { MemoryService } from "./memory-service";
import { ProbabilityEngine } from "./probability-engine";
import { AIClient, AIMessage } from "./providers";
import { AUTONOMOUS_SYSTEM_PROMPT } from "./ai-service";
import { ContextBuilder } from "./context-builder";
import { RescueEngine } from "./rescue-engine";
import { SimulationEngine } from "./simulation-engine";

export type OrchestratorActionPayload = {
  chat_response: string;
  logId?: string;
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
    description?: string | null;
    reminder_time?: string | null;
    reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
    recurrence_pattern?: string | null;
    priority?: "low" | "medium" | "high" | "critical" | null;
  }>;
  extracted_goals?: Array<{
    title: string;
    description?: string | null;
    target_date?: string | null;
    milestones?: string[];
  }>;
  extracted_habits?: Array<{
    title: string;
    description?: string | null;
    frequency?: "daily" | "weekly" | "weekdays" | "weekends";
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
  coaching_advice?: {
    encouragement: string;
    alternative_plan: string;
    micro_tasks: string[];
  };
};

export class ActionOrchestrator {
  /**
   * Unified message processing pipeline.
   * Every interface (Web Chat, Telegram, Voice, Files) routes through this function.
   */
  static async processMessage(
    userId: string,
    messageContent: string,
    supabase: SupabaseClient<Database>,
    options: {
      fileAttachment?: { base64Data: string; mimeType: string };
      source: "web" | "telegram";
      conversationId?: string;
    }
  ): Promise<OrchestratorActionPayload> {
    const lowerMessage = messageContent.toLowerCase().trim();

    // 1. COMMAND INTERCEPTION BLOCK: Rescue Mode
    if (
      lowerMessage.includes("emergency help") ||
      lowerMessage.includes("rescue mode") ||
      lowerMessage.includes("trigger rescue") ||
      lowerMessage.includes("emergency rescue") ||
      lowerMessage === "rescue"
    ) {
      console.log(`[ActionOrchestrator] Explicit Rescue Mode command detected: "${messageContent}"`);
      const plan = await RescueEngine.detectAndRunRescue(userId, undefined, `Explicitly requested: "${messageContent}"`);

      const chat_response =
        options.source === "telegram"
          ? `🚨 <b>AI DEADLINE RESCUE MODE ACTIVATED</b> 🚨\n\nI've analyzed your active tasks and initiated the emergency rescue protocol!\n\n<b>Rescue Performance Metrics:</b>\n• <b>Recovery Probability:</b> ${plan ? plan.recovery_probability : 85}%\n• <b>Hours Remaining:</b> ${plan ? plan.hours_remaining.toFixed(1) : 4} hrs\n• <b>Required Focus Blocks:</b> ${plan ? plan.remaining_focus_sessions : 3}\n\n<i>The live countdown and recovery dials are now active on your Dashboard!</i>`
          : `🚨 **AI DEADLINE RESCUE MODE ACTIVATED** 🚨\n\nI've analyzed your active tasks and initiated the emergency rescue protocol!\n\n**Recovery Probability:** ${plan ? plan.recovery_probability : 85}%\n**Hours Remaining:** ${plan ? plan.hours_remaining.toFixed(1) : 4} hrs\n**Required Focus Blocks:** ${plan ? plan.remaining_focus_sessions : 3}`;

      const responsePayload: OrchestratorActionPayload = {
        chat_response,
        extracted_tasks: [],
        execution_plan: plan
          ? {
              today: plan.emergency_action_plan.map((step) => `${step.step} (${step.duration} mins)`),
              tomorrow: [],
              weekly: [],
              estimated_finish_time: plan.estimated_finish_time,
            }
          : null,
        coaching_advice: {
          encouragement: "Stay calm and composed. We have a clear roadmap. Focus on completing one block at a time.",
          alternative_plan: "Take a 5-minute breather if you feel fatigued, then resume the active focus session.",
          micro_tasks: plan
            ? plan.emergency_action_plan.filter((s) => s.type === "focus").map((s) => s.step)
            : ["Begin first focus session"],
        },
      };

      if (options.conversationId) {
        await supabase.from("messages").insert({ conversation_id: options.conversationId, role: "user", content: messageContent, metadata: { source: options.source } as any });
        await supabase.from("messages").insert({ conversation_id: options.conversationId, role: "assistant", content: responsePayload.chat_response, metadata: { source: options.source } as any });
      }

      return responsePayload;
    }

    // 2. COMMAND INTERCEPTION BLOCK: Deactivate Rescue Mode
    if (
      lowerMessage.includes("deactivate rescue") ||
      lowerMessage.includes("stop rescue") ||
      lowerMessage.includes("cancel rescue")
    ) {
      console.log(`[ActionOrchestrator] Deactivate Rescue Mode command detected.`);
      await RescueEngine.deactivateRescue(userId);

      const chat_response =
        options.source === "telegram"
          ? `✅ <b>Rescue Mode Deactivated</b>\n\nYour standard schedule, focus priorities, and all paused tasks have been successfully restored.`
          : `✅ **Rescue Mode Deactivated**\n\nYour standard schedule, focus priorities, and all paused tasks have been successfully restored.`;

      const responsePayload: OrchestratorActionPayload = { chat_response, extracted_tasks: [], execution_plan: null };

      if (options.conversationId) {
        await supabase.from("messages").insert({ conversation_id: options.conversationId, role: "user", content: messageContent, metadata: { source: options.source } as any });
        await supabase.from("messages").insert({ conversation_id: options.conversationId, role: "assistant", content: responsePayload.chat_response, metadata: { source: options.source } as any });
      }

      return responsePayload;
    }

    // 3. COMMAND INTERCEPTION BLOCK: What-If Decision Simulation
    if (
      lowerMessage.includes("what if") ||
      lowerMessage.includes("what-if") ||
      lowerMessage.startsWith("simulate")
    ) {
      console.log(`[ActionOrchestrator] What-If Simulation command detected: "${messageContent}"`);
      const sim = await SimulationEngine.runSimulation(userId, messageContent);
      if (sim) {
        const chat_response =
          options.source === "telegram"
            ? `🔮 <b>AI DECISION SIMULATION COMPLETE</b> 🔮\n\n<b>Predicted Shifts:</b>\n• <b>Completion Probability:</b> ${sim.current_completion_probability}% ➔ <b>${sim.simulated_completion_probability}%</b>\n• <b>Deadline Risk:</b> <b>${sim.simulated_deadline_risk.toUpperCase()}</b>\n• <b>Workload Impact:</b> <b>${sim.workload_impact}</b>\n\n<b>AI Simulation Insights:</b>\n<i>${sim.reasoning}</i>\n\n<b>Suggested Alternative:</b>\n${sim.suggested_alternative}`
            : `🔮 **AI DECISION SIMULATION COMPLETE** 🔮\n\n**Predicted Shifts:**\n• **Completion Probability:** ${sim.current_completion_probability}% ➔ **${sim.simulated_completion_probability}%**\n• **Deadline Risk:** ${sim.current_deadline_risk} ➔ **${sim.simulated_deadline_risk}**\n• **Workload Impact:** ${sim.workload_impact}\n\n**AI Simulation Insights:**\n${sim.reasoning}\n\n**Suggested Alternative:**\n${sim.suggested_alternative}`;

        const responsePayload: OrchestratorActionPayload = {
          chat_response,
          extracted_tasks: [],
          execution_plan: null,
          coaching_advice: {
            encouragement: "Simulating decisions before committing to them is a highly effective way to protect your cognitive load.",
            alternative_plan: sim.suggested_alternative,
            micro_tasks: sim.affected_tasks.map((t) => `Review impact on: ${t}`),
          },
        };

        if (options.conversationId) {
          await supabase.from("messages").insert({ conversation_id: options.conversationId, role: "user", content: messageContent, metadata: { source: options.source } as any });
          await supabase.from("messages").insert({ conversation_id: options.conversationId, role: "assistant", content: responsePayload.chat_response, metadata: { source: options.source } as any });
        }

        return responsePayload;
      }
    }

    // 4. PIPELINE STEP: CONTEXT BUILDER
    console.log(`[ActionOrchestrator] Running Context Builder for ${userId}...`);
    const context = await ContextBuilder.buildContext(userId, messageContent, supabase);

    // 5. PIPELINE STEP: PROMPT ASSEMBLY
    const today = new Date();
    const todayStr = today.toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);

    let basePrompt = AUTONOMOUS_SYSTEM_PROMPT(todayStr, dayOfWeek);

    if (!basePrompt.includes("extracted_habits")) {
      basePrompt += `\n\n6. Habit Extraction: If the user indicates they want to build a habit, extract it into:\n"extracted_habits": [{ "title": "...", "description": "...", "frequency": "daily"|"weekly"|"weekdays"|"weekends" }]`;
    }

    if (options.source === "telegram") {
      basePrompt += "\n\nIMPORTANT: The user is messaging from Telegram. Keep your 'chat_response' formatted in standard HTML tags (<b>, <i>, <code>, <a>). Do NOT use markdown in 'chat_response'.";
    }

    const systemPrompt = `${basePrompt}\n${context.promptContextString}`;

    const activeMessages: AIMessage[] = [];
    if (options.fileAttachment) {
      activeMessages.push({
        role: "user",
        content: [
          { inlineData: { data: options.fileAttachment.base64Data, mimeType: options.fileAttachment.mimeType } },
          { text: messageContent || "Transcribe and analyze this attachment." },
        ],
      });
    } else {
      activeMessages.push({ role: "user", content: messageContent });
    }

    // 6. DIAGNOSTIC SYNC LOG INITIALISATION
    const startTime = Date.now();
    const syncLog: any = {
      user_id: userId,
      telegram_message: messageContent,
      extracted_json: null,
      task_status: "not_attempted",
      reminder_status: "not_attempted",
      calendar_status: "not_attempted",
      scheduler_status: "not_attempted",
      telegram_delivery_status: "not_attempted",
      created_tasks: [],
      created_reminders: [],
      created_events: [],
      execution_time_ms: 0,
    };

    let parsedData: OrchestratorActionPayload = { chat_response: "" };

    try {
      // 7. PIPELINE STEP: GEMINI INVOCATION
      console.log("[ActionOrchestrator] Invoking Gemini model for decision processing...");
      const rawResponseText = await AIClient.generateText(activeMessages, {
        provider: "gemini",
        systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json",
      });

      // 8. PIPELINE STEP: CLEAN AND PARSE RESPONSE (Stage 2)
      const cleanedJson = rawResponseText.replace(/```json/gi, "").replace(/```/gi, "").trim();

      try {
        parsedData = JSON.parse(cleanedJson);
      } catch (parseErr) {
        console.error("[ActionOrchestrator] Failed to parse AI JSON response:", rawResponseText);
        throw new Error("AI engine returned an invalid JSON structure.");
      }

      if (!parsedData || typeof parsedData !== "object") {
        throw new Error("Invalid JSON structure: Response is not an object.");
      }
      if (!parsedData.chat_response) {
        throw new Error("Missing required field: chat_response");
      }

      syncLog.extracted_json = parsedData;
      console.log("[ActionOrchestrator] Stage 2 ✅ — Gemini JSON parsed successfully.");

      // STAGE 2 GUARD: Verify reminder intent vs extraction to prevent hallucinations
      const hasReminderIntent =
        lowerMessage.includes("remind") ||
        lowerMessage.includes("reminder") ||
        lowerMessage.includes("in 2 minutes") ||
        lowerMessage.includes("in 5 minutes") ||
        lowerMessage.includes("in 15 minutes") ||
        lowerMessage.includes("in 30 minutes") ||
        lowerMessage.includes("in 1 hour");

      if (hasReminderIntent && (!parsedData.extracted_reminders || parsedData.extracted_reminders.length === 0)) {
        console.warn("[ActionOrchestrator] Reminder intent detected, but Gemini failed to extract it. Automatically creating fallback reminder.");
        parsedData.extracted_reminders = [{
          title: messageContent.replace(/remind me to/i, "").replace(/remind me/i, "").replace(/set a reminder to/i, "").replace(/set a reminder/i, "").trim() || "Task Reminder",
          reminder_time: null,
          reminder_type: "smart",
          recurrence_pattern: null
        }];
      }

      // 9. PIPELINE STEP: EXECUTE DATABASE TRANSACTION (Stage 3)
      console.log("[ActionOrchestrator] Executing database transactions...");
      const execResult = await ActionOrchestrator.execute(userId, parsedData, supabase, messageContent, options.source);

      // Propagate created IDs into syncLog for diagnostics
      syncLog.created_tasks = execResult.createdTasks;
      syncLog.created_reminders = execResult.createdReminders;
      syncLog.task_status = execResult.createdTasks.length > 0 ? "success" : "not_attempted";
      syncLog.reminder_status = execResult.createdReminders.length > 0 ? "success" : "not_attempted";
      syncLog.calendar_status = "not_attempted";

      console.log(`[ActionOrchestrator] Stage 3 ✅ — DB transaction complete. Tasks: ${execResult.createdTasks.length}, Reminders: ${execResult.createdReminders.length}`);

      // 10. PIPELINE STEP: SCHEDULER REGISTRATION VERIFICATION (Stage 4)
      if (execResult.createdReminders.length > 0) {
        console.log(`[ActionOrchestrator] Verifying scheduler registration for reminders:`, execResult.createdReminders);
        for (const remId of execResult.createdReminders) {
          const { data: rem, error: remError } = await supabase
            .from("reminders")
            .select("id, status, reminder_time")
            .eq("id", remId)
            .single();

          if (remError || !rem) {
            console.error(`[ActionOrchestrator] Stage 4 ❌ — Reminder ${remId} not found post-insert.`);
            syncLog.scheduler_status = "failed";
          } else if (rem.status !== "pending") {
            console.error(`[ActionOrchestrator] Stage 4 ❌ — Reminder ${remId} has unexpected status: "${rem.status}"`);
            syncLog.scheduler_status = "failed";
          } else {
            console.log(`[ActionOrchestrator] Stage 4 ✅ — Reminder ${remId} confirmed pending at ${rem.reminder_time}`);
            syncLog.scheduler_status = "success";
          }
        }
      }

      // 11. PIPELINE STEP: CHAT MESSAGE LOGGING (Stage 9)
      if (options.conversationId) {
        await supabase.from("messages").insert({
          conversation_id: options.conversationId,
          role: "user",
          content: messageContent || (options.fileAttachment?.mimeType?.startsWith("image") ? "[Image]" : "[Document]"),
          metadata: { source: options.source } as any,
        });
        await supabase.from("messages").insert({
          conversation_id: options.conversationId,
          role: "assistant",
          content: parsedData.chat_response,
          metadata: { source: options.source } as any,
        });
      }

      syncLog.telegram_delivery_status = "success";

    } catch (err: any) {
      console.error("[ActionOrchestrator] processMessage failure:", err.message);

      // Mark all un-set statuses as failed
      if (syncLog.task_status === "not_attempted") syncLog.task_status = "failed";
      if (syncLog.reminder_status === "not_attempted") syncLog.reminder_status = "failed";
      if (syncLog.calendar_status === "not_attempted") syncLog.calendar_status = "failed";
      syncLog.scheduler_status = "failed";
      syncLog.telegram_delivery_status = "failed";

      throw err;
    } finally {
      // Save diagnostic sync log to database (non-blocking)
      try {
        syncLog.execution_time_ms = Date.now() - startTime;
        const { data: insertedLog } = await (supabase as any)
          .from("telegram_sync_logs")
          .insert(syncLog)
          .select("id")
          .single();

        if ((insertedLog as any)?.id) {
          parsedData.logId = (insertedLog as any).id;
          console.log(`[ActionOrchestrator] Diagnostic log saved: ${(insertedLog as any).id}`);
        }
      } catch (logErr) {
        // Non-blocking — don't let log failures break the pipeline
        console.warn("[ActionOrchestrator] Failed to insert diagnostic sync log:", logErr);
      }
    }

    return parsedData;
  }

  /**
   * Main orchestrator execution method. Runs all DB inserts atomically.
   * If any critical operation fails, it executes a logical rollback.
   */
  static async execute(
    userId: string,
    payload: OrchestratorActionPayload,
    supabase: SupabaseClient<Database>,
    userMessageContent: string,
    source: "web" | "telegram" = "web"
  ): Promise<{ success: boolean; createdTasks: string[]; createdReminders: string[]; createdGoals: string[]; createdHabits: string[] }> {
    console.log(`[ActionOrchestrator] Starting transaction for user ${userId}...`);

    const createdTasks: string[] = [];
    const createdReminders: string[] = [];
    const createdGoals: string[] = [];
    const createdMemories: string[] = [];
    const createdHabits: string[] = [];

    try {
      // 1. Process Memories
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
        await MemoryService.extractAndSaveMemory(userId, userMessageContent, supabase).catch((err) => {
          console.warn("[ActionOrchestrator] Non-blocking memory extraction issue:", err);
        });
      }

      // 2. Process Extracted Goals & Milestones
      if (payload.extracted_goals && payload.extracted_goals.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_goals.length} goals...`);
        for (const g of payload.extracted_goals) {
          const { data: goalData, error: goalError } = await supabase
            .from("goals")
            .insert({
              user_id: userId,
              title: g.title,
              description: g.description || null,
              status: "active" as const,
            })
            .select()
            .single();

          if (goalError) throw new Error(`Goal creation failed: ${goalError.message}`);
          if (goalData) {
            createdGoals.push(goalData.id);

            if (g.milestones && g.milestones.length > 0) {
              const milestonePayload = g.milestones.map((mTitle) => ({
                goal_id: goalData.id,
                title: mTitle,
                status: "todo" as const,
              }));
              const { error: mileError } = await supabase.from("milestones").insert(milestonePayload);
              if (mileError) throw new Error(`Milestones insertion failed: ${mileError.message}`);
            }

            await supabase.from("activity_logs").insert({
              user_id: userId,
              action: "goal_created",
              entity_type: "goal",
              entity_id: goalData.id,
            });
          }
        }
      }

      // 3. Process Extracted Tasks & Subtasks
      const taskMap = new Map<string, string>();
      if (payload.extracted_tasks && payload.extracted_tasks.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_tasks.length} tasks...`);

        for (const t of payload.extracted_tasks) {
          // Deduplication: Check for existing uncompleted task with same title
          const { data: existingTasks } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", userId)
            .ilike("title", t.title.trim())
            .eq("status", "todo")
            .limit(1);

          let taskData: any = null;
          let taskError: any = null;

          if (existingTasks && existingTasks.length > 0) {
            console.log(`[ActionOrchestrator] Duplicate task found: "${t.title}". Updating existing.`);
            const existing = existingTasks[0];
            const { data: updatedData, error: updateErr } = await supabase
              .from("tasks")
              .update({
                description: t.description || existing.description,
                deadline: t.deadline || existing.deadline,
                priority: (t.priority || existing.priority) as any,
                estimated_duration: t.estimated_duration || existing.estimated_duration,
                priority_score: t.priority_score || existing.priority_score,
                risk_level: (t.risk_level || existing.risk_level) as any,
                completion_probability: t.completion_probability ?? existing.completion_probability,
                dependencies: t.dependencies || existing.dependencies,
                missing_information: t.missing_information || existing.missing_information,
              } as any)
              .eq("id", existing.id)
              .select()
              .single();

            taskData = updatedData;
            taskError = updateErr;
          } else {
            const { data: insertedData, error: insertErr } = await supabase
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
              } as any)
              .select()
              .single();

            taskData = insertedData;
            taskError = insertErr;
          }

          if (taskError) throw new Error(`Task creation failed: ${taskError.message}`);
          if (taskData) {
            createdTasks.push(taskData.id);
            taskMap.set(t.title.toLowerCase(), taskData.id);

            if (t.subtasks && t.subtasks.length > 0) {
              const subtaskPayload = t.subtasks.map((subTitle) => ({
                task_id: taskData.id,
                title: subTitle,
                is_completed: false,
              }));
              const { error: subtaskError } = await supabase.from("subtasks").insert(subtaskPayload);
              if (subtaskError) throw new Error(`Subtasks creation failed: ${subtaskError.message}`);
            }

            await supabase.from("activity_logs").insert({
              user_id: userId,
              action: "task_created",
              entity_type: "task",
              entity_id: taskData.id,
              metadata: { priority_score: t.priority_score, risk_level: t.risk_level, autonomous: true } as any,
            });
          }
        }

        // Link dependencies
        for (const taskId of createdTasks) {
          const { data: task } = await supabase.from("tasks").select("dependencies").eq("id", taskId).single();
          if (task && Array.isArray(task.dependencies) && task.dependencies.length > 0) {
            const resolvedIds = (task.dependencies as string[])
              .map((depName) => taskMap.get(depName.toLowerCase()))
              .filter((id): id is string => !!id);
            if (resolvedIds.length > 0) {
              await supabase.from("tasks").update({ dependencies: resolvedIds }).eq("id", taskId);
            }
          }
        }

        // Trigger AI Focus Time Blocking for new tasks
        for (const taskId of createdTasks) {
          try {
            const { CalendarAiService } = await import("@/lib/ai/calendar-ai-service");
            CalendarAiService.scheduleFocusBlocks(userId, taskId, supabase).catch((err) => {
              console.error(`[ActionOrchestrator] Non-blocking focus scheduling fail for task ${taskId}:`, err);
            });
          } catch (importErr) {
            console.error("[ActionOrchestrator] Failed to import CalendarAiService:", importErr);
          }
        }
      }

      // 4. Process Extracted Reminders
      if (payload.extracted_reminders && payload.extracted_reminders.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_reminders.length} reminders...`);
        for (const rem of payload.extracted_reminders) {
          let associatedTaskId: string | null = null;
          const matchTitle = rem.title.toLowerCase();

          if (taskMap.has(matchTitle)) {
            associatedTaskId = taskMap.get(matchTitle) || null;
          } else {
            const { data: existingTask } = await supabase
              .from("tasks")
              .select("id")
              .eq("user_id", userId)
              .ilike("title", rem.title)
              .limit(1)
              .maybeSingle();
            if (existingTask) associatedTaskId = existingTask.id;
          }

          const reminderData = await ReminderService.createReminder(
            userId,
            {
              title: rem.title,
              description: rem.description || null,
              reminder_time: rem.reminder_time,
              reminder_type: rem.reminder_type || "specific_time",
              recurrence_pattern: rem.recurrence_pattern || null,
              task_id: associatedTaskId,
              priority: rem.priority || null,
              created_from: source === "telegram" ? "telegram" : "ai",
            },
            supabase
          );

          if (reminderData) {
            createdReminders.push(reminderData.id);
            await supabase.from("activity_logs").insert({
              user_id: userId,
              action: "reminder_created",
              entity_type: "reminder",
              entity_id: reminderData.id,
            });
          }
        }
      }

      // 5. Process Extracted Habits
      if (payload.extracted_habits && payload.extracted_habits.length > 0) {
        console.log(`[ActionOrchestrator] Processing ${payload.extracted_habits.length} habits...`);
        for (const h of payload.extracted_habits) {
          const { data: existingHabit } = await supabase
            .from("habits")
            .select("id")
            .eq("user_id", userId)
            .ilike("title", h.title)
            .maybeSingle();

          if (!existingHabit) {
            const { data: habitData, error: habitError } = await supabase
              .from("habits")
              .insert({
                user_id: userId,
                title: h.title,
                description: h.description || null,
                frequency: h.frequency || "daily",
                streak: 0,
              })
              .select()
              .single();

            if (habitError) throw new Error(`Habit creation failed: ${habitError.message}`);
            if (habitData) {
              createdHabits.push(habitData.id);
              await supabase.from("activity_logs").insert({
                user_id: userId,
                action: "habit_created",
                entity_type: "habit",
                entity_id: habitData.id,
              });
            }
          }
        }
      }

      // 6. Process Execution Plan
      if (payload.execution_plan) {
        console.log(`[ActionOrchestrator] Saving execution plan...`);
        const { error: planError } = await supabase
          .from("execution_plans")
          .upsert(
            {
              user_id: userId,
              plan_type: "daily" as const,
              plan_data: payload.execution_plan as any,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id, plan_type" }
          );

        if (planError) {
          await supabase.from("execution_plans").delete().match({ user_id: userId, plan_type: "daily" });
          const { error: insertError } = await supabase.from("execution_plans").insert({
            user_id: userId,
            plan_type: "daily" as const,
            plan_data: payload.execution_plan as any,
          });
          if (insertError) throw new Error(`Execution plan save failed: ${insertError.message}`);
        }
      }

      // 7. Recalculate Probabilities & Streaks (non-blocking)
      await ProbabilityEngine.updateAllProbabilitiesAndSaveHistory(userId).catch((err) => {
        console.warn("[ActionOrchestrator] Non-blocking analytics update issue:", err);
      });

      console.log("[ActionOrchestrator] Transaction committed successfully!");
      return { success: true, createdTasks, createdReminders, createdGoals, createdHabits };
    } catch (err: any) {
      console.error("[ActionOrchestrator] Transaction failed. Executing logical rollback...", err.message);

      try {
        if (createdHabits.length > 0) await supabase.from("habits").delete().in("id", createdHabits);
        if (createdReminders.length > 0) await supabase.from("reminders").delete().in("id", createdReminders);
        if (createdTasks.length > 0) await supabase.from("tasks").delete().in("id", createdTasks);
        if (createdGoals.length > 0) await supabase.from("goals").delete().in("id", createdGoals);
        if (createdMemories.length > 0) await supabase.from("user_memories").delete().in("id", createdMemories);
      } catch (rollbackErr: any) {
        console.error("[ActionOrchestrator] Secondary rollback error:", rollbackErr.message);
      }

      throw err;
    }
  }
}
