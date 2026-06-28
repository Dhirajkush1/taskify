import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { AIClient } from "@/lib/ai/providers";
import type { Task } from "@/types/app.types";

export type EmergencyStep = {
  step: string;
  duration: number;
  type: "focus" | "break" | "review";
};

export type RescuePlanData = {
  is_active: boolean;
  emergency_task_id: string | null;
  hours_remaining: number;
  completion_probability: number;
  recovery_probability: number;
  current_risk: string;
  estimated_finish_time: string | null;
  emergency_action_plan: EmergencyStep[];
  remaining_focus_sessions: number;
};

export class RescueEngine {

  /**
   * Evaluates the user's tasks and determines if Rescue Mode should be triggered.
   * If triggered or forced, it calls Gemini to formulate the rescue plan and saves it.
   */
  static async detectAndRunRescue(
    userId: string,
    forceTaskTitle?: string,
    forceReason?: string
  ): Promise<RescuePlanData | null> {
    const supabase = await createClient();

    // 1. Fetch user's pending tasks and active focus sessions
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "done");

    const pendingTasks = tasks || [];

    // 2. Evaluate trigger conditions
    let shouldTrigger = false;
    let criticalTask: Task | null = null;
    let triggerReason = "";

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Condition A: Urgent task due within 24 hours
    for (const t of pendingTasks) {
      if (t.deadline) {
        const dueTime = new Date(t.deadline).getTime();
        const diff = dueTime - now;
        if (diff > 0 && diff <= oneDayMs) {
          shouldTrigger = true;
          criticalTask = t;
          triggerReason = `Task "${t.title}" is due in less than 24 hours.`;
          break;
        }
      }
    }

    // Condition B: Multiple overdue tasks (>= 2)
    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.deadline) return false;
      return new Date(t.deadline).getTime() < now;
    });

    if (!shouldTrigger && overdueTasks.length >= 2) {
      shouldTrigger = true;
      criticalTask = overdueTasks[0];
      triggerReason = `You have ${overdueTasks.length} overdue tasks blocking your flow.`;
    }

    // Condition C: Explicitly requested or forced
    if (forceTaskTitle) {
      shouldTrigger = true;
      criticalTask = pendingTasks.find((t) => t.title.toLowerCase().includes(forceTaskTitle.toLowerCase())) || pendingTasks[0] || null;
      triggerReason = forceReason || "Urgent deadline rescue requested by user.";
    }

    // If no rescue conditions met, ensure the rescue plan is marked inactive
    if (!shouldTrigger) {
      await supabase
        .from("rescue_plans")
        .upsert({
          user_id: userId,
          is_active: false,
          emergency_action_plan: []
        }, { onConflict: "user_id" });
      return null;
    }

    try {
      const tasksContext = pendingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        deadline: t.deadline,
        duration: t.estimated_duration || 30,
        is_overdue: t.deadline ? new Date(t.deadline).getTime() < now : false
      }));

      const prompt = `You are the Clutch AI Emergency Rescue Engine. 
The user is facing a critical productivity deadline emergency: "${triggerReason}".
Target Task: ${criticalTask ? `"${criticalTask.title}" (Priority: ${criticalTask.priority}, Due: ${criticalTask.deadline})` : "General workload overload"}

All active pending tasks:
${JSON.stringify(tasksContext, null, 2)}

You MUST formulate an Emergency Rescue Plan. 
1. Pauses/de-prioritizes non-critical tasks.
2. Breaks the remaining work into tight 25-45 minute focus sessions, interspersed with short 5-minute recovery breaks.
3. Calculates the "recovery_probability" (0 to 100) based on remaining hours versus estimated work duration.
4. Estimates the finish time (ISO string).
5. Lists the step-by-step action plan.

Respond ONLY with a valid JSON object matching this schema:
{
  "completion_probability": integer (0-100, current probability of finishing everything),
  "recovery_probability": integer (0-100, probability of recovering with this plan),
  "current_risk": "low" | "medium" | "high" | "critical",
  "hours_remaining": float (hours until the critical deadline, or 8 if no deadline),
  "estimated_finish_time": "ISO 8601 string",
  "remaining_focus_sessions": integer (number of focus blocks required),
  "emergency_action_plan": [
    { "step": "Actionable focus/break step description", "duration": minutes (integer), "type": "focus" | "break" | "review" }
  ]
}

Do not wrap in markdown tags or include any explanation. Output pure JSON.`;

      const responseText = await AIClient.generateText(
        [
          { role: "user" as const, content: prompt }
        ],
        {
          provider: "gemini",
          model: "gemini-1.5-flash",
          responseMimeType: "application/json"
        }
      );
      const cleaned = responseText.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const parsed = JSON.parse(cleaned);

      const planData: RescuePlanData = {
        is_active: true,
        emergency_task_id: criticalTask ? criticalTask.id : null,
        hours_remaining: Number(parsed.hours_remaining) || 4,
        completion_probability: Number(parsed.completion_probability) || 50,
        recovery_probability: Number(parsed.recovery_probability) || 80,
        current_risk: parsed.current_risk || "high",
        estimated_finish_time: parsed.estimated_finish_time || new Date(now + 4 * 3600 * 1000).toISOString(),
        emergency_action_plan: parsed.emergency_action_plan || [],
        remaining_focus_sessions: Number(parsed.remaining_focus_sessions) || 3
      };

      // 4. Persist to database
      await supabase
        .from("rescue_plans")
        .upsert({
          user_id: userId,
          is_active: true,
          emergency_task_id: planData.emergency_task_id,
          hours_remaining: planData.hours_remaining,
          completion_probability: planData.completion_probability,
          recovery_probability: planData.recovery_probability,
          current_risk: planData.current_risk,
          estimated_finish_time: planData.estimated_finish_time,
          emergency_action_plan: planData.emergency_action_plan,
          remaining_focus_sessions: planData.remaining_focus_sessions,
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      // Log event in activity_logs
      await supabase.from("activity_logs").insert({
        user_id: userId,
        action: "RescueModeActivated",
        entity_type: "system",
        metadata: {
          reason: triggerReason,
          recovery_probability: planData.recovery_probability,
          critical_task: criticalTask?.title
        }
      });

      // Proactive Telegram Rescue Notification
      try {
        const { data: account } = await supabase
          .from("telegram_accounts")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (account && account.chat_id && (prefs?.telegram_enabled !== false) && (prefs?.emergency_alerts_enabled !== false)) {
          const { TelegramBotService } = await import("@/lib/telegram/bot-service");
          
          await TelegramBotService.sendRescueAlert(account.chat_id, {
            hoursRemaining: planData.hours_remaining,
            recoveryProbability: planData.recovery_probability,
            nextFocusBlock: planData.emergency_action_plan[0]?.step || "Critical Focus Block",
            focusSessionsRequired: planData.remaining_focus_sessions,
            rescuePlanId: userId
          });
        }
      } catch (telegramErr) {
        console.error("[RescueEngine] Failed to dispatch Telegram rescue alert:", telegramErr);
      }

      return planData;
    } catch (error) {
      console.error("Error in detectAndRunRescue:", error);
      return null;
    }
  }

  /**
   * Deactivates rescue mode.
   */
  static async deactivateRescue(userId: string): Promise<void> {
    const supabase = await createClient();
    await supabase
      .from("rescue_plans")
      .upsert({
        user_id: userId,
        is_active: false,
        emergency_task_id: null,
        emergency_action_plan: []
      }, { onConflict: "user_id" });

    await supabase.from("activity_logs").insert({
      user_id: userId,
      action: "RescueModeDeactivated",
      entity_type: "system",
      metadata: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Called whenever task progress changes. Automatically recalculates the rescue plan if active.
   */
  static async updateRescueProgress(userId: string): Promise<void> {
    const supabase = await createClient();
    const { data: plan } = await supabase
      .from("rescue_plans")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (plan && plan.is_active) {
      // If the emergency task was completed, turn off rescue mode!
      if (plan.emergency_task_id) {
        const { data: task } = await supabase
          .from("tasks")
          .select("status")
          .eq("id", plan.emergency_task_id)
          .single();

        if (task && task.status === "done") {
          await this.deactivateRescue(userId);
          return;
        }
      }

      // Re-trigger rescue to recalculate plan with updated task status
      await this.detectAndRunRescue(userId);
    }
  }
}
