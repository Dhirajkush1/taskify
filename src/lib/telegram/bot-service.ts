

export interface TelegramKeyboardBtn {
  text: string;
  callback_data: string;
}

export class TelegramBotService {
  private static get token(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn("[TelegramBotService] WARNING: TELEGRAM_BOT_TOKEN is not configured in .env.local!");
    }
    return token || "";
  }

  /**
   * Send a standard text message or HTML-formatted message to a specific chat ID.
   */
  static async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: {
        inline_keyboard?: TelegramKeyboardBtn[][];
        keyboard?: { text: string }[][];
        resize_keyboard?: boolean;
        one_time_keyboard?: boolean;
      };
    }
  ): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || "HTML",
          reply_markup: options?.reply_markup,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelegramBotService] Failed to send message to ${chatId}. Status: ${response.status}. Error: ${errorText}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error("[TelegramBotService] Network error sending message:", err);
      return false;
    }
  }

  /**
   * Edit an existing message (e.g. to update buttons after a click).
   */
  static async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: {
        inline_keyboard?: TelegramKeyboardBtn[][];
      };
    }
  ): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: options?.parse_mode || "HTML",
          reply_markup: options?.reply_markup,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelegramBotService] Failed to edit message ${messageId} in chat ${chatId}. Error: ${errorText}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error("[TelegramBotService] Network error editing message:", err);
      return false;
    }
  }

  /**
   * Answer callback query to stop the loading spinner on Telegram buttons.
   */
  static async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert: boolean = false
  ): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert,
        }),
      });

      return response.ok;
    } catch (err) {
      console.error("[TelegramBotService] Error answering callback query:", err);
      return false;
    }
  }

  /**
   * Retrieve file path details from Telegram based on a file ID.
   */
  static async getFilePath(fileId: string): Promise<string | null> {
    if (!this.token) return null;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/getFile?file_id=${fileId}`);
      if (!response.ok) return null;

      const data = await response.json();
      return data.result?.file_path || null;
    } catch (err) {
      console.error("[TelegramBotService] Error fetching file details:", err);
      return null;
    }
  }

  /**
   * Download a file from Telegram and return its buffer and mimeType.
   */
  static async downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const filePath = await this.getFilePath(fileId);
    if (!filePath || !this.token) return null;

    try {
      const fileUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
      const response = await fetch(fileUrl);
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine mimeType based on extension
      let mimeType = "application/octet-stream";
      if (filePath.endsWith(".ogg") || filePath.endsWith(".oga")) {
        mimeType = "audio/ogg";
      } else if (filePath.endsWith(".pdf")) {
        mimeType = "application/pdf";
      } else if (filePath.endsWith(".png")) {
        mimeType = "image/png";
      } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
        mimeType = "image/jpeg";
      }

      return { buffer, mimeType };
    } catch (err) {
      console.error("[TelegramBotService] Error downloading file:", err);
      return null;
    }
  }

  /**
   * Format and send a Rescue Mode alert.
   */
  static async sendRescueAlert(
    chatId: number | string,
    plan: {
      hoursRemaining: number;
      recoveryProbability: number;
      nextFocusBlock: string;
      focusSessionsRequired: number;
      rescuePlanId: string;
    }
  ): Promise<boolean> {
    const text = `
🚨 <b>Deadline Rescue Mode Activated</b>

A critical deadline is approaching, and Clutch has entered <b>Emergency Rescue Mode</b> to protect your schedule!

⏱ <b>Time Remaining:</b> ${plan.hoursRemaining.toFixed(1)} hrs
📈 <b>Recovery Probability:</b> <b>${plan.recoveryProbability}%</b>
🎯 <b>Focus Sessions Needed:</b> ${plan.focusSessionsRequired} sessions (25m each)
🔥 <b>Next Focus Milestone:</b> "${plan.nextFocusBlock}"

Let's focus up and crush this work!
`;

    return this.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🚀 Start Focus Session", callback_data: `rescue:focus:${plan.rescuePlanId}` },
            { text: "🛡 Dismiss Alert", callback_data: "rescue:dismiss" }
          ]
        ]
      }
    });
  }

  /**
   * Format and send a Task Reminder.
   */
  static async sendTaskReminder(
    chatId: number | string,
    task: { id: string; title: string; deadline: string | null; priority: string }
  ): Promise<boolean> {
    const priorityEmoji = task.priority === "critical" ? "🔴" : task.priority === "high" ? "🟠" : "🟡";
    const dateStr = task.deadline ? new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Soon";

    const text = `
⏰ <b>Clutch Focus Reminder</b>

${priorityEmoji} <b>Task:</b> "${task.title}"
⏱ <b>Scheduled:</b> ${dateStr}
🔥 <b>Priority:</b> <b>${task.priority.toUpperCase()}</b>

Would you like to tackle this task right now?
`;

    return this.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✓ Complete Task", callback_data: `task:complete:${task.id}` },
            { text: "⏱ Postpone 24h", callback_data: `task:postpone:${task.id}` }
          ],
          [
            { text: "🚀 Start Focus", callback_data: `task:focus:${task.id}` }
          ]
        ]
      }
    });
  }

  /**
   * Format and send a Daily Debrief.
   */
  static async sendDailyDebrief(
    chatId: number | string,
    debrief: {
      completionRate: number;
      focusMinutes: number;
      summary: string;
      priorities: string[];
      streak: number;
    }
  ): Promise<boolean> {
    const priorityList = debrief.priorities.map((p, idx) => `${idx + 1}. ${p}`).join("\n");
    const text = `
🌅 <b>Clutch AI Daily Debrief</b>

Here is your productivity brief and tactical gameplan:

📊 <b>Completion Rate:</b> <b>${debrief.completionRate}%</b>
⏱ <b>Focus Duration:</b> <b>${debrief.focusMinutes} minutes</b>
🔥 <b>Focus Streak:</b> <b>${debrief.streak} days</b>

📝 <b>Autonomous Coaching Summary:</b>
<i>${debrief.summary}</i>

🎯 <b>Tomorrow's Top Priorities:</b>
${priorityList || "No major tasks scheduled. Enjoy your focus breathing room!"}

Let's maintain this momentum!
`;

    return this.sendMessage(chatId, text);
  }

  /**
   * Format and send a Weekly Reflection.
   */
  static async sendWeeklyReflection(
    chatId: number | string,
    reflection: {
      avgCompletionRate: number;
      peakHours: string;
      coachingTip: string;
      wins: string[];
    }
  ): Promise<boolean> {
    const winsList = reflection.wins.map(w => `• ${w}`).join("\n");
    const text = `
👑 <b>Clutch Weekly reflection</b>

Outstanding work completing another week! Here is your weekly wellness and productivity report:

📈 <b>Average Completion:</b> <b>${reflection.avgCompletionRate}%</b>
⚡ <b>Peak Work Window:</b> <b>${reflection.peakHours}</b>

🏆 <b>Weekly Wins:</b>
${winsList || "• Consistent effort across focus blocks."}

💡 <b>Coaching & Habits Advice:</b>
<i>${reflection.coachingTip}</i>
`;

    return this.sendMessage(chatId, text);
  }

  /**
   * Fetch webhook registration information from Telegram API.
   */
  static async getWebhookInfo(): Promise<{ url: string; pending_update_count: number } | null> {
    if (!this.token) return null;
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/getWebhookInfo`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.result || null;
    } catch (err) {
      console.error("[TelegramBotService] Error getting webhook info:", err);
      return null;
    }
  }

  /**
   * Register a webhook URL for the Telegram bot.
   */
  static async setWebhook(url: string): Promise<boolean> {
    if (!this.token) return false;
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelegramBotService] setWebhook failed: ${response.status} - ${errorText}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[TelegramBotService] Error setting webhook:", err);
      return false;
    }
  }

  /**
   * Fetch bot info (to verify credentials and get correct bot username).
   */
  static async getMe(): Promise<{ username: string } | null> {
    if (!this.token) return null;
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.result || null;
    } catch (err) {
      console.error("[TelegramBotService] Error in getMe:", err);
      return null;
    }
  }
}
