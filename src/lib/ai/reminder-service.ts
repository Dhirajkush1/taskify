import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ReminderPayload {
  title: string;
  reminder_time: string; // ISO string or relative description
  reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
  recurrence_pattern?: string | null;
  task_id?: string | null;
}

export class ReminderService {
  /**
   * Parse a relative time description (e.g., "in 15 minutes") or a specific time string
   * into a proper ISO timestamp.
   */
  static parseReminderTime(timeInput: string): Date {
    const cleanInput = timeInput.toLowerCase().trim();
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
    let resolvedTime: Date;
    if (payload.reminder_time.includes("-") || payload.reminder_time.includes("T") || !isNaN(Date.parse(payload.reminder_time))) {
      resolvedTime = new Date(payload.reminder_time);
      if (isNaN(resolvedTime.getTime())) {
        resolvedTime = this.parseReminderTime(payload.reminder_time);
      }
    } else {
      resolvedTime = this.parseReminderTime(payload.reminder_time);
    }

    const reminderData = {
      user_id: userId,
      task_id: payload.task_id || null,
      title: payload.title,
      reminder_time: resolvedTime.toISOString(),
      reminder_type: (payload.reminder_type || "specific_time") as "specific_time" | "relative_time" | "recurring" | "deadline" | "smart",
      recurrence_pattern: payload.recurrence_pattern || null,
      status: "pending" as const,
    };

    const { data, error } = await supabase
      .from("reminders")
      .insert(reminderData)
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
   * Flushes them serverlessly on active platform requests.
   */
  static async dispatchPendingReminders(supabase: any) {
    try {
      const nowIso = new Date().toISOString();
      
      // Fetch reminders past due
      const { data: reminders, error } = await supabase
        .from("reminders")
        .select("*, task:tasks(*)")
        .in("status", ["pending", "scheduled"])
        .lte("reminder_time", nowIso);

      if (error || !reminders || reminders.length === 0) return;

      for (const r of reminders) {
        try {
          // 1. Check if user has active Telegram account and reminders enabled
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
            // Lazy import to avoid circular dependency issues
            const { TelegramBotService } = await import("@/lib/telegram/bot-service");
            
            await TelegramBotService.sendTaskReminder(account.chat_id, {
              id: r.task_id || r.id,
              title: r.title,
              deadline: r.reminder_time,
              priority: r.task?.priority || "medium"
            });

            // Log sent notification
            await supabase.from("telegram_notifications").insert({
              user_id: r.user_id,
              telegram_account_id: account.id,
              notification_type: "reminder",
              title: "Task Focus Reminder",
              body: r.title,
              status: "sent"
            });
          }

          // 2. Mark reminder as triggered
          await supabase
            .from("reminders")
            .update({ status: "triggered" as const, updated_at: new Date().toISOString() })
            .eq("id", r.id);

        } catch (dispatchErr) {
          console.error(`[ReminderService] Failed to dispatch reminder ${r.id}:`, dispatchErr);
        }
      }
    } catch (err) {
      console.error("[ReminderService] Critical error in dispatchPendingReminders:", err);
    }
  }
}
