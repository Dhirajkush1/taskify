import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ReminderPayload {
  title: string;
  reminder_time: string; // ISO string or relative description
  reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
  recurrence_pattern?: string | null;
  task_id?: string | null;
}

// ── Timezone Utility Helpers ─────────────────────────────────────
function getLocalNow(timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const map: Record<string, string> = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );
}

function getUtcDate(localDate: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false
  });
  const dateUtc = new Date(localDate.getTime());
  const localParts = formatter.formatToParts(dateUtc);
  const map: Record<string, string> = {};
  localParts.forEach(p => { map[p.type] = p.value; });
  const localRepresentation = new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );
  const diff = localRepresentation.getTime() - localDate.getTime();
  return new Date(dateUtc.getTime() - diff);
}

export class ReminderService {
  /**
   * Parse a relative time description (e.g., "in 15 minutes") or a specific time string
   * into a proper ISO timestamp.
   */
  static parseReminderTime(timeInput: string, userTimezone: string = "UTC"): Date {
    const cleanInput = timeInput.toLowerCase().trim();
    const localNow = getLocalNow(userTimezone);
    const now = new Date();

    // Handle relative minutes
    const minMatch = cleanInput.match(/in\s+(\d+)\s+min/i) || cleanInput.match(/(\d+)\s+minute/i);
    if (minMatch && minMatch[1]) {
      const minutes = parseInt(minMatch[1], 10);
      return new Date(now.getTime() + minutes * 60 * 1000);
    }

    // Handle relative hours
    const hourMatch = cleanInput.match(/in\s+(\d+)\s+hour/i) || cleanInput.match(/(\d+)\s+hour/i);
    if (hourMatch && hourMatch[1]) {
      const hours = parseInt(hourMatch[1], 10);
      return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }

    // Handle relative days
    const dayMatch = cleanInput.match(/in\s+(\d+)\s+day/i) || cleanInput.match(/(\d+)\s+day/i);
    if (dayMatch && dayMatch[1]) {
      const days = parseInt(dayMatch[1], 10);
      return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // "tomorrow morning" -> tomorrow at 9 AM local
    if (cleanInput.includes("tomorrow morning")) {
      const targetLocal = new Date(localNow);
      targetLocal.setDate(localNow.getDate() + 1);
      targetLocal.setHours(9, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "tomorrow evening" -> tomorrow at 6 PM local
    if (cleanInput.includes("tomorrow evening")) {
      const targetLocal = new Date(localNow);
      targetLocal.setDate(localNow.getDate() + 1);
      targetLocal.setHours(18, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "tomorrow" or "tomorrow at ..."
    if (cleanInput.startsWith("tomorrow")) {
      const targetLocal = new Date(localNow);
      targetLocal.setDate(localNow.getDate() + 1);
      const timeMatch = cleanInput.match(/tomorrow\s+(?:at\s+)?(\d+)(?::(\d+))?\s*(am|pm)?/i);
      if (timeMatch && timeMatch[1]) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3];
        if (ampm) {
          if (ampm.toLowerCase() === "pm" && hour < 12) hour += 12;
          if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
        }
        targetLocal.setHours(hour, minute, 0, 0);
      } else {
        targetLocal.setHours(9, 0, 0, 0); // default to 9 AM
      }
      return getUtcDate(targetLocal, userTimezone);
    }

    // "tonight" -> today at 8 PM local (or tomorrow if already past 8 PM)
    if (cleanInput.includes("tonight")) {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 20) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(20, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "after lunch" -> today at 1:30 PM local (or tomorrow if already past)
    if (cleanInput.includes("after lunch")) {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 13 && (localNow.getHours() > 13 || localNow.getMinutes() >= 30)) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(13, 30, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "next monday" -> next Monday at 9 AM local
    if (cleanInput.includes("next monday")) {
      const targetLocal = new Date(localNow);
      const currentDay = localNow.getDay();
      const daysToAdd = (8 - currentDay) % 7 || 7;
      targetLocal.setDate(localNow.getDate() + daysToAdd);
      targetLocal.setHours(9, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // Attempt direct date parsing
    const parsedDate = new Date(timeInput);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }

    // Default to 15 minutes from now if unparseable
    console.warn(`[ReminderService] Unparseable time input: "${timeInput}". Defaulting to +15m.`);
    return new Date(now.getTime() + 15 * 60 * 1000);
  }

  /**
   * Inserts a new reminder into Supabase.
   */
  static async createReminder(
    userId: string,
    payload: ReminderPayload,
    supabase: SupabaseClient<Database>
  ) {
    // Fetch user's timezone from settings
    const { data: settings } = await supabase
      .from("settings")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    const userTimezone = settings?.timezone || "UTC";

    let resolvedTime: Date;
    if (payload.reminder_time.includes("-") || payload.reminder_time.includes("T") || !isNaN(Date.parse(payload.reminder_time))) {
      resolvedTime = new Date(payload.reminder_time);
      if (isNaN(resolvedTime.getTime())) {
        resolvedTime = this.parseReminderTime(payload.reminder_time, userTimezone);
      }
    } else {
      resolvedTime = this.parseReminderTime(payload.reminder_time, userTimezone);
    }

    const reminderData = {
      user_id: userId,
      task_id: payload.task_id || null,
      title: payload.title,
      reminder_time: resolvedTime.toISOString(),
      reminder_type: (payload.reminder_type || "specific_time") as "specific_time" | "relative_time" | "recurring" | "deadline" | "smart",
      recurrence_pattern: payload.recurrence_pattern || null,
      status: "pending" as any,
      delivery_attempts: 0,
      follow_up_sent: false
    };

    const { data, error } = await supabase
      .from("reminders")
      .insert(reminderData as any)
      .select()
      .single();

    if (error) {
      console.error("[ReminderService] Error inserting reminder:", error.message);
      throw new Error(`Failed to create reminder: ${error.message}`);
    }

    console.log(`[ReminderService] Successfully created reminder "${payload.title}" for ${reminderData.reminder_time}`);
    return data;
  }

  /**
   * Fetches all active/pending reminders for a user.
   */
  static async getPendingReminders(userId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from("reminders")
      .select("*, task:tasks(title)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("reminder_time", { ascending: true });

    if (error) {
      console.error("[ReminderService] Error fetching reminders:", error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Cancels a pending reminder.
   */
  static async cancelReminder(userId: string, reminderId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from("reminders")
      .update({ status: "cancelled" as const, updated_at: new Date().toISOString() })
      .eq("id", reminderId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[ReminderService] Error cancelling reminder:", error.message);
      throw new Error(`Failed to cancel reminder: ${error.message}`);
    }
    return data;
  }

  /**
   * Dispatches all pending reminders that are past due.
   * Runs automatically every minute via cron.
   */
  static async dispatchPendingReminders(supabase: any) {
    try {
      const nowIso = new Date().toISOString();
      console.log(`[ReminderEngine] Scanning for due reminders at ${nowIso}...`);
      
      // Fetch reminders past due
      const { data: reminders, error } = await supabase
        .from("reminders")
        .select("*, task:tasks(*)")
        .in("status", ["pending", "scheduled", "failed", "sending"])
        .lte("reminder_time", nowIso)
        .lt("delivery_attempts", 5);

      if (error) {
        console.error("[ReminderEngine] Error loading due reminders:", error.message);
        return;
      }

      if (!reminders || reminders.length === 0) {
        console.log("[ReminderEngine] No pending reminders are currently due.");
        return;
      }

      // Filter by next_retry_at in memory
      const dueReminders = reminders.filter((r: any) => {
        if (!r.next_retry_at) return true;
        return new Date(r.next_retry_at).getTime() <= Date.now();
      });

      console.log(`[ReminderEngine] Found ${dueReminders.length} due reminders to dispatch.`);

      for (const r of dueReminders) {
        let deliverySuccess = false;
        let errMessage = "";
        
        try {
          // Increment delivery attempts and lock status to 'sending'
          const currentAttempts = (r.delivery_attempts || 0) + 1;
          await supabase
            .from("reminders")
            .update({ 
              status: "sending" as any, 
              delivery_attempts: currentAttempts,
              last_attempt: nowIso,
              updated_at: nowIso
            } as any)
            .eq("id", r.id);

          // 1. Check if user has active Telegram account
          const { data: account } = await supabase
            .from("telegram_accounts")
            .select("*")
            .eq("user_id", r.user_id)
            .eq("is_active", true)
            .maybeSingle();

          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", r.user_id)
            .maybeSingle();

          const telegramEnabled = account && account.chat_id && (prefs?.telegram_enabled !== false) && (prefs?.reminders_enabled !== false);

          if (telegramEnabled) {
            console.log(`[ReminderEngine] Sending Telegram reminder to user ${r.user_id} (chat ID ${account.chat_id})`);
            const { TelegramBotService } = await import("@/lib/telegram/bot-service");
            const dateStr = r.reminder_time ? new Date(r.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now";
            
            const messageText = `🔔 <b>Reminder</b>\n\n${r.title}\n\n<b>Scheduled:</b> ${dateStr}`;
            
            const replyMarkup = {
              inline_keyboard: [
                [
                  { text: "✅ Done", callback_data: `reminder:complete:${r.id}` },
                  { text: "⏰ 10 min later", callback_data: `reminder:snooze:${r.id}` }
                ],
                [
                  { text: "🤕 Busy", callback_data: `reminder:busy:${r.id}` },
                  { text: "❌ Skip", callback_data: `reminder:skip:${r.id}` }
                ]
              ]
            };

            const success = await TelegramBotService.sendMessage(account.chat_id, messageText, {
              reply_markup: replyMarkup
            });

            if (!success) {
              throw new Error("Telegram API returned failure status.");
            }

            // Log sent notification in telegram_notifications
            await supabase.from("telegram_notifications").insert({
              user_id: r.user_id,
              telegram_account_id: account.id,
              notification_type: "reminder",
              title: "Task Focus Reminder",
              body: r.title,
              status: "sent"
            });
          } else {
            console.log(`[ReminderEngine] Telegram not connected or disabled for user ${r.user_id}, falling back to Web Notification only.`);
          }

          // 2. Create Web Notification in Notifications table
          await supabase.from("notifications").insert({
            user_id: r.user_id,
            title: "Clutch Reminder 🔔",
            message: r.title,
            type: "reminder",
            read: false,
            task_id: r.task_id || null
          });

          deliverySuccess = true;
        } catch (dispatchErr: any) {
          console.error(`[ReminderEngine] Failed to deliver reminder ${r.id}:`, dispatchErr);
          errMessage = dispatchErr.message || "Unknown error";
        }

        // Update database with outcome
        if (deliverySuccess) {
          await supabase
            .from("reminders")
            .update({ 
              status: "sent" as any, 
              sent_at: nowIso,
              failure_reason: null,
              next_retry_at: null,
              updated_at: nowIso
            } as any)
            .eq("id", r.id);
          
          await supabase.from("activity_logs").insert({
            user_id: r.user_id,
            action: "reminder_sent",
            entity_type: "reminder",
            entity_id: r.id
          });
          
          console.log(`[ReminderEngine] Successfully dispatched reminder ${r.id}`);
        } else {
          // Retry queue logic (1 min, 5 min, 15 min, 30 min)
          const attempts = (r.delivery_attempts || 0) + 1;
          const retryIntervals = [1, 5, 15, 30]; // in minutes
          const minutes = retryIntervals[attempts - 1] || 30;
          const nextRetry = new Date(Date.now() + minutes * 60 * 1000).toISOString();
          
          const newStatus = attempts >= 5 ? "failed" : "failed"; // Let it state as failed but next_retry_at will check it
          
          await supabase
            .from("reminders")
            .update({ 
              status: (attempts >= 5 ? "failed" : "failed") as any,
              failure_reason: errMessage,
              next_retry_at: attempts >= 5 ? null : nextRetry,
              updated_at: nowIso
            } as any)
            .eq("id", r.id);

          await supabase.from("activity_logs").insert({
            user_id: r.user_id,
            action: "reminder_delivery_failed",
            entity_type: "reminder",
            entity_id: r.id,
            metadata: { error: errMessage, attempt: attempts }
          });
        }
      }
    } catch (err) {
      console.error("[ReminderEngine] Critical error in dispatchPendingReminders:", err);
    }
  }

  /**
   * Scans for ignored reminders and dispatches the AI follow-up dialogue prompts.
   */
  static async checkAndTriggerFollowUps(supabase: any) {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      console.log(`[ReminderEngine] Scanning for ignored reminders sent before ${tenMinutesAgo}...`);

      // Fetch sent reminders that have been ignored for 10 minutes and don't have follow-ups sent
      const { data: reminders, error } = await supabase
        .from("reminders")
        .select("*, task:tasks(*)")
        .eq("status", "sent")
        .eq("follow_up_sent", false)
        .lte("sent_at", tenMinutesAgo);

      if (error) {
        console.error("[ReminderEngine] Error loading reminders for follow-up:", error.message);
        return;
      }

      if (!reminders || reminders.length === 0) {
        console.log("[ReminderEngine] No reminders require follow-up alerts at this time.");
        return;
      }

      for (const r of reminders) {
        try {
          console.log(`[ReminderEngine] Triggering AI follow-up for reminder ${r.id}`);

          // Fetch Telegram profile
          const { data: account } = await supabase
            .from("telegram_accounts")
            .select("*")
            .eq("user_id", r.user_id)
            .eq("is_active", true)
            .maybeSingle();

          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", r.user_id)
            .maybeSingle();

          const telegramEnabled = account && account.chat_id && (prefs?.telegram_enabled !== false) && (prefs?.reminders_enabled !== false);

          // 1. Send Telegram Follow-Up message if enabled
          if (telegramEnabled) {
            const { TelegramBotService } = await import("@/lib/telegram/bot-service");
            const replyMarkup = {
              inline_keyboard: [
                [
                  { text: "🚀 Started", callback_data: `reminder:started:${r.id}` },
                  { text: "🤕 Busy", callback_data: `reminder:followup_busy:${r.id}` }
                ],
                [
                  { text: "🤝 Need Help", callback_data: `reminder:help:${r.id}` },
                  { text: "⏰ Later", callback_data: `reminder:later:${r.id}` }
                ],
                [
                  { text: "❌ Skip", callback_data: `reminder:skip:${r.id}` }
                ]
              ]
            };

            await TelegramBotService.sendMessage(
              account.chat_id,
              `🤔 <b>Clutch Follow-up</b>\n\nI noticed you haven't started yet on: "${r.title}".\n\nDid something come up?`,
              { reply_markup: replyMarkup }
            );
          }

          // 2. Create Web Notification in notifications table
          await supabase.from("notifications").insert({
            user_id: r.user_id,
            title: "Clutch Follow-up 🤔",
            message: `I noticed you haven't started yet on: "${r.title}". Did something come up?`,
            type: "follow_up",
            read: false,
            task_id: r.task_id || null
          });

          // 3. Insert message card into active chat conversation
          const { data: latestConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", r.user_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestConv) {
            await supabase.from("messages").insert({
              conversation_id: latestConv.id,
              role: "assistant",
              content: `I noticed you haven't started yet on: "${r.title}". Did something come up?`,
              metadata: { 
                type: "follow_up", 
                reminder_id: r.id, 
                task_id: r.task_id || null,
                title: r.title 
              }
            });
            
            // Touch conversation updated_at
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", latestConv.id);
          }

          // 4. Update reminder follow_up_sent state
          await supabase
            .from("reminders")
            .update({ follow_up_sent: true, updated_at: new Date().toISOString() } as any)
            .eq("id", r.id);

          await supabase.from("activity_logs").insert({
            user_id: r.user_id,
            action: "reminder_follow_up_triggered",
            entity_type: "reminder",
            entity_id: r.id
          });

          console.log(`[ReminderEngine] Follow-up successfully sent for reminder ${r.id}`);
        } catch (err: any) {
          console.error(`[ReminderEngine] Failed to dispatch follow-up for reminder ${r.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[ReminderEngine] Critical error in checkAndTriggerFollowUps:", err);
    }
  }

  /**
   * Executes a reminder or follow-up action.
   * Single source of truth for both Telegram and Web app interactions.
   */
  static async handleReminderAction(
    userId: string,
    action: string,
    reminderId: string,
    supabase: any
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[ReminderEngine] Executing action "${action}" for reminder ${reminderId} and user ${userId}`);
    const nowIso = new Date().toISOString();

    // 1. Fetch target reminder
    const { data: reminder, error: fetchErr } = await supabase
      .from("reminders")
      .select("*")
      .eq("id", reminderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !reminder) {
      console.error(`[ReminderEngine] Action failed: Reminder ${reminderId} not found.`);
      return { success: false, message: "Reminder not found." };
    }

    // Mark corresponding notification as read if any
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("task_id", reminder.task_id || "00000000-0000-0000-0000-000000000000");

    switch (action) {
      case "complete":
      case "started": {
        // Mark reminder as completed
        await supabase
          .from("reminders")
            .update({ status: "completed" as any, updated_at: nowIso } as any)
          .eq("id", reminderId);

        // If it has an associated task, mark task as done
        if (reminder.task_id) {
          const { data: task } = await supabase
            .from("tasks")
            .select("category")
            .eq("id", reminder.task_id)
            .maybeSingle();

          const finalStatus = (task as any)?.category === "Emergency" ? "archived" : "done";

          await supabase
            .from("tasks")
            .update({ status: finalStatus as any, completion_percentage: 100, updated_at: nowIso } as any)
            .eq("id", reminder.task_id);

          await supabase.from("activity_logs").insert({
            user_id: userId,
            action: "task_completed",
            entity_type: "task",
            entity_id: reminder.task_id,
            metadata: { via_reminder_action: action }
          });
        }

        return { success: true, message: "Task and reminder successfully marked as complete!" };
      }

      case "snooze": {
        // Postpone reminder by 10 minutes
        const newTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase
          .from("reminders")
          .update({ 
            status: "pending" as any,
            reminder_time: newTime,
            delivery_attempts: 0,
            next_retry_at: null,
            follow_up_sent: false,
            updated_at: nowIso
          } as any)
          .eq("id", reminderId);

        return { success: true, message: "Reminder snoozed for 10 minutes." };
      }

      case "busy": {
        // Postpone reminder by 30 minutes
        const newTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabase
          .from("reminders")
          .update({ 
            status: "pending" as any,
            reminder_time: newTime,
            delivery_attempts: 0,
            next_retry_at: null,
            follow_up_sent: false,
            updated_at: nowIso
          } as any)
          .eq("id", reminderId);

        return { success: true, message: "Reminder rescheduled for 30 minutes later." };
      }

      case "later":
      case "followup_busy": {
        // Postpone by 1 hour
        const newTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await supabase
          .from("reminders")
          .update({ 
            status: "pending" as any,
            reminder_time: newTime,
            delivery_attempts: 0,
            next_retry_at: null,
            follow_up_sent: false,
            updated_at: nowIso
          } as any)
          .eq("id", reminderId);

        // Update task deadline as well if task_id exists
        if (reminder.task_id) {
          const { data: task } = await supabase
            .from("tasks")
            .select("deadline")
            .eq("id", reminder.task_id)
            .single();

          const currentDeadline = task?.deadline ? new Date(task.deadline) : new Date();
          const newDeadline = new Date(currentDeadline.getTime() + 60 * 60 * 1000).toISOString();

          await supabase
            .from("tasks")
            .update({ deadline: newDeadline, updated_at: nowIso })
            .eq("id", reminder.task_id);
        }

        return { success: true, message: "Postponed task and reminder by 1 hour." };
      }

      case "skip": {
        // Cancel/skip reminder
        await supabase
          .from("reminders")
          .update({ status: "cancelled" as any, updated_at: nowIso } as any)
          .eq("id", reminderId);

        return { success: true, message: "Reminder skipped successfully." };
      }

      case "help": {
        // Archive reminder so it stops notifying
        await supabase
          .from("reminders")
          .update({ status: "completed" as any, updated_at: nowIso } as any)
          .eq("id", reminderId);

        if (reminder.task_id) {
          // Fetch user's latest conversation
          const { data: latestConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestConv) {
            // Insert user query
            await supabase.from("messages").insert({
              conversation_id: latestConv.id,
              role: "user",
              content: `I need help with this task: "${reminder.title}". Can you give me coaching advice or alternative steps?`,
              metadata: { source: "telegram" }
            });

            // Run action orchestrator asynchronously
            const { ActionOrchestrator } = await import("./action-orchestrator");
            ActionOrchestrator.processMessage(
              userId, 
              `I need help with this task: "${reminder.title}". Can you give me coaching advice or alternative steps?`,
              supabase,
              { conversationId: latestConv.id, source: "telegram" }
            ).catch(err => {
              console.error("[ReminderEngine] ActionOrchestrator async assistance call failed:", err);
            });
          }
        }

        return { success: true, message: "AI assistant prompted to guide you. Tap /status in chat to check." };
      }

      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
  }
}
