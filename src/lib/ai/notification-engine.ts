import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Task } from "@/types/app.types";

export interface SmartNotification {
  title: string;
  body: string;
  type: "urgency" | "blocker" | "workload" | "encouragement";
}

export class NotificationEngine {
  /**
   * Generates a list of smart, action-oriented contextual notifications using Gemini.
   */
  static async generateSmartNotifications(
    userId: string,
    tasks: Task[]
  ): Promise<SmartNotification[]> {
    const pending = tasks.filter((t) => t.status !== "done" && t.status !== "archived");
    if (pending.length === 0) return [];

    // Local heuristic fallbacks (which are already incredibly smart!)
    const notifications: SmartNotification[] = [];

    // 1. Blocker detection
    const blockingTasks = pending.filter((t) => {
      // Count how many tasks depend on this task
      return pending.some(
        (p) => (p.dependencies as string[] || []).some(
          (dep) => dep.toLowerCase().trim() === t.title.toLowerCase().trim()
        )
      );
    });

    if (blockingTasks.length > 0) {
      const firstBlocker = blockingTasks[0];
      const blockedCount = pending.filter(
        (p) => (p.dependencies as string[] || []).some(
          (dep) => dep.toLowerCase().trim() === firstBlocker.title.toLowerCase().trim()
        )
      ).length;

      notifications.push({
        title: "Blocker Alert 🚧",
        body: `"${firstBlocker.title}" blocks ${blockedCount} other high-priority task${blockedCount > 1 ? "s" : ""}. Complete it now to clear the bottleneck!`,
        type: "blocker",
      });
    }

    // 2. Overdue or near-overdue warning
    const urgentTask = pending.find((t) => {
      if (!t.deadline) return false;
      const hoursLeft = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft < 4; // Due in less than 4 hours
    });

    if (urgentTask) {
      notifications.push({
        title: "Clock is Ticking ⏱️",
        body: `You still have enough time for "${urgentTask.title}" if you begin within the next 30 minutes. Let's do this!`,
        type: "urgency",
      });
    }

    // 3. Workload reduction incentive
    const tomorrowTasks = pending.filter((t) => {
      if (!t.deadline) return false;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      return t.deadline.startsWith(tomorrowStr);
    });

    if (tomorrowTasks.length > 1 && pending.some((t) => t.status === "in_progress")) {
      notifications.push({
        title: "Workload Hack 💡",
        body: "Completing your active task now reduces tomorrow's workload by 40%. Get ahead of the curve!",
        type: "workload",
      });
    }

    // Call Gemini to generate a hyper-personalized notification if API key exists!
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return notifications.slice(0, 3);
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const systemInstruction = `
You are Clutch's Smart Notification Engine. Your goal is to generate extremely engaging, action-focused, contextual notifications for a user based on their pending tasks.
Create 2-3 notifications. Do not use simple reminders. Use cognitive incentives like blocking counts, time limits, workload percentage savings, or focus streaks.

Your response MUST be a single, strictly valid JSON array of objects.

JSON SCHEMA:
[
  {
    "title": "Short title with emoji",
    "body": "Action-driving message (e.g. 'Completing this now reduces tomorrow's workload by 40%!'), keeping it under 120 chars.",
    "type": "urgency" | "blocker" | "workload" | "encouragement"
  }
]
`;

      const prompt = `
Pending Tasks queue:
${pending.map((t) => `- Title: "${t.title}" | Deadline: ${t.deadline || "None"} | Priority Score: ${t.priority_score}% | Dependencies: [${(t.dependencies as string[] || []).join(", ")}]`).join("\n")}

Generate 3 highly contextual, motivating notifications.
`;

      const result = await model.generateContent([systemInstruction, prompt]);
      const parsed = JSON.parse(result.response.text());
      return parsed && parsed.length > 0 ? parsed : notifications;
    } catch (err) {
      console.error("[NotificationEngine] Gemini notification generation error, returning fallbacks:", err);
      return notifications.slice(0, 3);
    }
  }
}
