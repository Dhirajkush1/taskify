import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ReminderPayload {
  title: string;
  description?: string | null;
  reminder_time?: string | null; // ISO string, relative description, or null to infer
  reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
  recurrence_pattern?: string | null;
  task_id?: string | null;
  priority?: "low" | "medium" | "high" | "critical" | null;
  notification_channels?: string[] | null;
  created_from?: "telegram" | "dashboard" | "calendar" | "ai" | "voice";
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
   * Parse relative time descriptions into absolute UTC dates using timezone offsets.
   */
  static parseReminderTime(timeInput: string, userTimezone: string = "UTC"): Date {
    const cleanInput = timeInput.toLowerCase().trim();
    const localNow = getLocalNow(userTimezone);
    const now = new Date();

    // 15 min / 30 mins
    const minMatch = cleanInput.match(/(\d+)\s*mins?/i) || cleanInput.match(/in\s*(\d+)\s*min/i);
    if (minMatch && minMatch[1]) {
      const minutes = parseInt(minMatch[1], 10);
      return new Date(now.getTime() + minutes * 60 * 1000);
    }

    // 2 hours
    const hourMatch = cleanInput.match(/(\d+)\s*hours?/i) || cleanInput.match(/in\s*(\d+)\s*hour/i);
    if (hourMatch && hourMatch[1]) {
      const hours = parseInt(hourMatch[1], 10);
      return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }

    // Days
    const dayMatch = cleanInput.match(/(\d+)\s*days?/i) || cleanInput.match(/in\s*(\d+)\s*day/i);
    if (dayMatch && dayMatch[1]) {
      const days = parseInt(dayMatch[1], 10);
      return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // "tomorrow morning" -> tomorrow at 9 AM local
    if (cleanInput.includes("tomorrow morning") || cleanInput === "tomorrow morning") {
      const targetLocal = new Date(localNow);
      targetLocal.setDate(localNow.getDate() + 1);
      targetLocal.setHours(9, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "tomorrow evening" -> tomorrow at 6 PM local
    if (cleanInput.includes("tomorrow evening") || cleanInput === "tomorrow evening") {
      const targetLocal = new Date(localNow);
      targetLocal.setDate(localNow.getDate() + 1);
      targetLocal.setHours(18, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "tomorrow at ..." or "tomorrow ..."
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
    if (cleanInput.includes("tonight") || cleanInput === "tonight") {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 20) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(20, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "after lunch" -> today at 1:30 PM local (or tomorrow if already past)
    if (cleanInput.includes("after lunch") || cleanInput === "after lunch") {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 13 && (localNow.getHours() > 13 || localNow.getMinutes() >= 30)) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(13, 30, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "before lunch" -> today at 11:30 AM local (or tomorrow if already past)
    if (cleanInput.includes("before lunch") || cleanInput === "before lunch") {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 11 && (localNow.getHours() > 11 || localNow.getMinutes() >= 30)) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(11, 30, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "after office" / "friday evening"
    if (cleanInput.includes("after office") || cleanInput === "after office") {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 18) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(18, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    if (cleanInput.includes("friday evening")) {
      const targetLocal = new Date(localNow);
      const currentDay = localNow.getDay();
      let daysToAdd = (5 - currentDay + 7) % 7;
      if (daysToAdd === 0 && localNow.getHours() >= 18) {
        daysToAdd = 7;
      }
      targetLocal.setDate(localNow.getDate() + daysToAdd);
      targetLocal.setHours(18, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "morning"
    if (cleanInput.includes("morning") || cleanInput === "morning") {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 9) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(9, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "night"
    if (cleanInput.includes("night") || cleanInput === "night") {
      const targetLocal = new Date(localNow);
      if (localNow.getHours() >= 21) {
        targetLocal.setDate(localNow.getDate() + 1);
      }
      targetLocal.setHours(21, 0, 0, 0);
      return getUtcDate(targetLocal, userTimezone);
    }

    // "next week" -> next Monday at 9 AM local
    if (cleanInput.includes("next week") || cleanInput === "next week") {
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
   * Intelligently infers reminder schedule when users omit exact times.
   */
  static inferReminderSettings(
    title: string
  ): { reminder_time: string; priority: "low" | "medium" | "high" | "critical"; recurrence_pattern?: string | null; ask_followup?: string } {
    const cleanTitle = title.toLowerCase().trim();

    if (cleanTitle.includes("drink water") || cleanTitle.includes("hydrate")) {
      return {
        reminder_time: "in 1 hour",
        priority: "low",
        recurrence_pattern: "every 2 hours"
      };
    }

    if (cleanTitle.includes("walk") || cleanTitle.includes("stretch")) {
      return {
        reminder_time: "in 1 hour",
        priority: "low",
        recurrence_pattern: "daily"
      };
    }

    if (cleanTitle.includes("workout") || cleanTitle.includes("gym") || cleanTitle.includes("exercise")) {
      return {
        reminder_time: "6 PM",
        priority: "medium",
        recurrence_pattern: "daily"
      };
    }

    if (cleanTitle.includes("study") || cleanTitle.includes("read book") || cleanTitle.includes("homework")) {
      return {
        reminder_time: "7 PM", // Inferred available focus slot
        priority: "medium"
      };
    }

    if (cleanTitle.includes("call mom") || cleanTitle.includes("call dad") || cleanTitle.includes("call family")) {
      return {
        reminder_time: "8 PM",
        priority: "medium"
      };
    }

    if (cleanTitle.includes("pay rent") || cleanTitle.includes("rent")) {
      return {
        reminder_time: "tomorrow 10 AM",
        priority: "critical",
        ask_followup: "What date is your rent due?"
      };
    }

    if (cleanTitle.includes("pay bill") || cleanTitle.includes("electricity bill") || cleanTitle.includes("internet bill")) {
      return {
        reminder_time: "tomorrow 10 AM",
        priority: "high",
        ask_followup: "When is the bill due?"
      };
    }

    // Default inference: Tomorrow at 10 AM local
    return {
      reminder_time: "tomorrow 10 AM",
      priority: "medium"
    };
  }

  /**
   * Inserts a new reminder, routing through the centralized engine.
   */
  static async createReminder(
    userId: string,
    payload: ReminderPayload,
    supabase: SupabaseClient<Database>
  ) {
    // 1. Fetch user settings for Timezone preferences
    const { data: settings } = await supabase
      .from("settings")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    const userTimezone = settings?.timezone || "UTC";

    let timeString = payload.reminder_time;
    let inferredPriority: any = payload.priority || null;
    let inferredRecurrence = payload.recurrence_pattern || null;
    let followUpPrompt: string | undefined = undefined;

    // 2. Apply AI Intelligent Time Heuristics if no time is provided
    if (!timeString) {
      const inference = this.inferReminderSettings(payload.title);
      timeString = inference.reminder_time;
      if (!inferredPriority) inferredPriority = inference.priority;
       if (!inferredRecurrence) inferredRecurrence = inference.recurrence_pattern || null;
       if (inference.ask_followup) followUpPrompt = inference.ask_followup;
    }

    // 3. Resolve to absolute UTC Date
    let resolvedTime: Date;
    if (timeString.includes("-") || timeString.includes("T") || !isNaN(Date.parse(timeString))) {
      resolvedTime = new Date(timeString);
      if (isNaN(resolvedTime.getTime())) {
        resolvedTime = this.parseReminderTime(timeString, userTimezone);
      }
    } else {
      resolvedTime = this.parseReminderTime(timeString, userTimezone);
    }

    const reminderData = {
      user_id: userId,
      task_id: payload.task_id || null,
      title: payload.title,
      description: payload.description || null,
      due_at: resolvedTime.toISOString(),
      reminder_time: resolvedTime.toISOString(), // compatibility mapping
      timezone: userTimezone,
      reminder_type: (payload.reminder_type || "specific_time"),
      recurrence_pattern: inferredRecurrence,
      status: "pending",
      priority: inferredPriority || "medium",
      notification_channels: payload.notification_channels || ["telegram", "web"],
      created_from: payload.created_from || "dashboard",
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

    console.log(`[ReminderEngine] Created reminder "${payload.title}" for user ${userId} scheduled at ${reminderData.due_at}`);

    // If an AI clarification question was generated, append it to the chat thread
    if (followUpPrompt) {
      const { data: latestConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestConv) {
        await supabase.from("messages").insert({
          conversation_id: latestConv.id,
          role: "assistant",
          content: followUpPrompt,
          metadata: { type: "clarification", reminder_id: data.id }
        });
      }
    }

    return data;
  }

  /**
   * Fetches active/pending reminders for a user.
   */
  static async getPendingReminders(userId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from("reminders")
      .select("*, task:tasks(title)")
      .eq("user_id", userId)
      .in("status", ["pending", "scheduled"])
      .order("due_at", { ascending: true });

    if (error) {
      console.error("[ReminderService] Error fetching reminders:", error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Background execution daemon (runs via cron).
   */
  static async dispatchPendingReminders(supabase: any) {
    try {
      const nowIso = new Date().toISOString();
      console.log(`[ReminderEngine] Scanning for due reminders at ${nowIso}...`);

      // Fetch pending or scheduled reminders past due
      const { data: reminders, error } = await supabase
        .from("reminders")
        .select("*, task:tasks(*)")
        .in("status", ["pending", "scheduled"])
        .lte("due_at", nowIso)
        .lt("delivery_attempts", 5);

      if (error) {
        console.error("[ReminderEngine] Error loading due reminders:", error.message);
        return;
      }

      if (!reminders || reminders.length === 0) {
        console.log("[ReminderEngine] No reminders are currently due.");
        return;
      }

      console.log(`[ReminderEngine] Found ${reminders.length} due reminders to dispatch.`);

      for (const r of reminders) {
        let deliverySuccess = false;
        let errMessage = "";

        try {
          // Lock state to scheduled to prevent double delivery
          const currentAttempts = (r.delivery_attempts || 0) + 1;
          await supabase
            .from("reminders")
            .update({
              status: "scheduled" as any,
              delivery_attempts: currentAttempts,
              last_attempt: nowIso,
              updated_at: nowIso
            } as any)
            .eq("id", r.id);

          // Get channels
          const channels = r.notification_channels || ["telegram", "web"];

          // 1. Deliver to Telegram channel
          if (channels.includes("telegram")) {
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

            const telegramEnabled = account && account.chat_id && (prefs?.telegram_enabled !== false);

            if (telegramEnabled) {
              const { TelegramBotService } = await import("@/lib/telegram/bot-service");
              const dateStr = new Date(r.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              const messageText = `⏰ <b>Reminder Alert</b>\n\n<b>${r.title}</b>\n${r.description || "Due now."}\n\n<i>Scheduled: ${dateStr}</i>`;
              
              const replyMarkup = {
                inline_keyboard: [
                  [
                    { text: "✅ Completed", callback_data: `reminder:complete:${r.id}` },
                    { text: "⏳ Snooze 10 min", callback_data: `reminder:snooze:${r.id}` }
                  ],
                  [
                    { text: "📅 Reschedule", callback_data: `reminder:busy:${r.id}` },
                    { text: "❌ Dismiss", callback_data: `reminder:skip:${r.id}` }
                  ]
                ]
              };

              const success = await TelegramBotService.sendMessage(account.chat_id, messageText, {
                reply_markup: replyMarkup
              });

              if (!success) throw new Error("Telegram API returned failure.");
              
              // Log to telegram_notifications
              await supabase.from("telegram_notifications").insert({
                user_id: r.user_id,
                telegram_account_id: account.id,
                notification_type: "reminder",
                title: "Task Focus Reminder",
                body: r.title,
                status: "sent"
              });
              deliverySuccess = true;
            }
          }

          // 2. Deliver to Web UI Notification center channel
          if (channels.includes("web")) {
            await supabase.from("notifications").insert({
              user_id: r.user_id,
              title: "Clutch Reminder ⏰",
              message: `${r.title} is due now.`,
              type: "reminder",
              read: false,
              task_id: r.task_id || null
            });
            deliverySuccess = true;
          }

        } catch (dispatchErr: any) {
          console.error(`[ReminderEngine] Failed to deliver reminder ${r.id}:`, dispatchErr);
          errMessage = dispatchErr.message || "Unknown error";
        }

        // 3. Update database state on outcome
        if (deliverySuccess) {
          await supabase
            .from("reminders")
            .update({
              status: "delivered" as any,
              delivered_at: nowIso,
              failure_reason: null,
              next_retry_at: null,
              updated_at: nowIso
            } as any)
            .eq("id", r.id);

          await supabase.from("activity_logs").insert({
            user_id: r.user_id,
            action: "reminder_delivered",
            entity_type: "reminder",
            entity_id: r.id
          });
        } else {
          // Retry logic (1 min, 5 min, 15 min, 30 min)
          const attempts = (r.delivery_attempts || 0);
          const retryIntervals = [1, 5, 15, 30];
          const minutes = retryIntervals[attempts - 1] || 30;
          const nextRetry = new Date(Date.now() + minutes * 60 * 1000).toISOString();

          await supabase
            .from("reminders")
            .update({
              status: (attempts >= 5 ? "expired" : "pending") as any,
              failure_reason: errMessage,
              next_retry_at: attempts >= 5 ? null : nextRetry,
              updated_at: nowIso
            } as any)
            .eq("id", r.id);
        }
      }
    } catch (err) {
      console.error("[ReminderEngine] Critical error in dispatchPendingReminders:", err);
    }
  }

  /**
   * Ignored reminders check and follow-up prompt logs.
   */
  static async checkAndTriggerFollowUps(supabase: any) {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data: reminders, error } = await supabase
        .from("reminders")
        .select("*, task:tasks(*)")
        .eq("status", "delivered")
        .eq("follow_up_sent", false)
        .lte("delivered_at", tenMinutesAgo);

      if (error) {
        console.error("[ReminderEngine] Error loading reminders for follow-up:", error.message);
        return;
      }

      if (!reminders || reminders.length === 0) return;

      for (const r of reminders) {
        try {
          const { data: account } = await supabase
            .from("telegram_accounts")
            .select("*")
            .eq("user_id", r.user_id)
            .eq("is_active", true)
            .maybeSingle();

          if (account && account.chat_id) {
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
                ]
              ]
            };

            await TelegramBotService.sendMessage(
              account.chat_id,
              `🤔 <b>Clutch Follow-up</b>\n\nI noticed you haven't checked off: "${r.title}". Did something come up?`,
              { reply_markup: replyMarkup }
            );
          }

          // Trigger follow-up notification in database
          await supabase.from("notifications").insert({
            user_id: r.user_id,
            title: "Clutch Follow-up 🤔",
            message: `I noticed you haven't checked off: "${r.title}". Did something come up?`,
            type: "follow_up",
            read: false,
            task_id: r.task_id || null
          });

          await supabase
            .from("reminders")
            .update({ follow_up_sent: true, updated_at: new Date().toISOString() } as any)
            .eq("id", r.id);

        } catch (err) {
          console.error(`[ReminderEngine] Follow-up delivery failed for reminder ${r.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[ReminderEngine] Error in follow-up sweeps:", err);
    }
  }

  /**
   * Action button click processor (for snooze, reschedule, complete, or dismiss).
   */
  static async handleReminderAction(
    userId: string,
    action: string,
    reminderId: string,
    supabase: any
  ): Promise<{ success: boolean; message: string }> {
    const nowIso = new Date().toISOString();

    const { data: reminder, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("id", reminderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !reminder) {
      return { success: false, message: "Reminder not found." };
    }

    // Dismiss notifications linked
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("task_id", reminder.task_id || "00000000-0000-0000-0000-000000000000");

    switch (action) {
      case "complete":
      case "started": {
        await supabase
          .from("reminders")
          .update({ status: "completed" as any, completed_at: nowIso, updated_at: nowIso } as any)
          .eq("id", reminderId);

        if (reminder.task_id) {
          await supabase
            .from("tasks")
            .update({ status: "done", completion_percentage: 100, updated_at: nowIso })
            .eq("id", reminder.task_id);

          await supabase.from("activity_logs").insert({
            user_id: userId,
            action: "task_completed",
            entity_type: "task",
            entity_id: reminder.task_id
          });
        }
        return { success: true, message: "Reminder completed." };
      }

      case "snooze": {
        const snoozeTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase
          .from("reminders")
          .update({
            status: "pending" as any,
            due_at: snoozeTime,
            reminder_time: snoozeTime,
            delivery_attempts: 0,
            follow_up_sent: false,
            updated_at: nowIso
          } as any)
          .eq("id", reminderId);

        return { success: true, message: "Snoozed for 10 minutes." };
      }

      case "busy": {
        const busyTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabase
          .from("reminders")
          .update({
            status: "pending" as any,
            due_at: busyTime,
            reminder_time: busyTime,
            delivery_attempts: 0,
            follow_up_sent: false,
            updated_at: nowIso
          } as any)
          .eq("id", reminderId);

        return { success: true, message: "Rescheduled for 30 minutes later." };
      }

      case "later":
      case "followup_busy": {
        const laterTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await supabase
          .from("reminders")
          .update({
            status: "pending" as any,
            due_at: laterTime,
            reminder_time: laterTime,
            delivery_attempts: 0,
            follow_up_sent: false,
            updated_at: nowIso
          } as any)
          .eq("id", reminderId);

        return { success: true, message: "Postponed by 1 hour." };
      }

      case "skip": {
        await supabase
          .from("reminders")
          .update({ status: "dismissed" as any, updated_at: nowIso } as any)
          .eq("id", reminderId);

        return { success: true, message: "Reminder dismissed." };
      }

      case "help": {
        await supabase
          .from("reminders")
          .update({ status: "completed" as any, updated_at: nowIso } as any)
          .eq("id", reminderId);

        if (reminder.task_id) {
          const { data: latestConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestConv) {
            await supabase.from("messages").insert({
              conversation_id: latestConv.id,
              role: "user",
              content: `I need help with this task: "${reminder.title}". Please guide me.`,
              metadata: { source: "telegram" }
            });

            const { ActionOrchestrator } = await import("./action-orchestrator");
            ActionOrchestrator.processMessage(
              userId,
              `I need help with this task: "${reminder.title}". Please guide me.`,
              supabase,
              { conversationId: latestConv.id, source: "telegram" }
            ).catch(() => {});
          }
        }
        return { success: true, message: "AI Assistant alerted to help you." };
      }

      default:
        return { success: false, message: `Action "${action}" unknown.` };
    }
  }
}
