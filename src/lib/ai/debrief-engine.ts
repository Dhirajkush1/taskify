import { createClient } from "@/lib/supabase/server";
import { AIClient } from "@/lib/ai/providers";

export interface DailyDebriefData {
  summary: string;
  metrics: {
    completion_rate: number;
    focus_time_minutes: number;
    productivity_score: number;
    current_streak: number;
  };
  completed_tasks: string[];
  delayed_tasks: string[];
  improvements: string[];
  tomorrow_priorities: string[];
  tomorrow_probability: number;
  best_achievement: string;
  missed_opportunities: string[];
}

export interface WeeklyReflectionData {
  start_date: string;
  end_date: string;
  reflection_text: string;
  metrics: {
    completion_rate: number;
    best_working_day: string;
    best_working_hours: string;
    most_delayed_category: string;
  };
  weekly_wins: string[];
  focus_trends: Array<{ date: string; minutes: number }>;
  burnout_trend: Array<{ date: string; score: number }>;
  coaching_advice: string;
  suggested_changes: string[];
}

export class DebriefEngine {

  /**
   * Generates or fetches the daily debrief for a user on a specific date.
   */
  static async getOrCreateDailyDebrief(userId: string, dateStr?: string): Promise<DailyDebriefData | null> {
    const supabase = await createClient();
    const targetDateStr = dateStr || new Date().toISOString().split("T")[0];

    // 1. Check if daily debrief already exists
    const { data: existing } = await supabase
      .from("daily_debriefs")
      .select("*")
      .eq("user_id", userId)
      .eq("debrief_date", targetDateStr)
      .maybeSingle();

    if (existing) {
      return {
        summary: existing.summary,
        metrics: (existing.metrics as unknown as DailyDebriefData["metrics"]) || {
          completion_rate: 0,
          focus_time_minutes: 0,
          productivity_score: 0,
          current_streak: 0
        },
        completed_tasks: (existing.completed_tasks as string[]) || [],
        delayed_tasks: (existing.delayed_tasks as string[]) || [],
        improvements: (existing.improvements as string[]) || [],
        tomorrow_priorities: (existing.tomorrow_priorities as string[]) || [],
        tomorrow_probability: existing.tomorrow_probability ?? 0,
        best_achievement: existing.best_achievement || "",
        missed_opportunities: (existing.missed_opportunities as string[]) || []
      };
    }

    // 2. Query actual user records for the day to formulate the debrief
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId);

    const { data: focusSessions } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", `${targetDateStr}T00:00:00Z`);

    const { data: memories } = await supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", userId);

    const memoryMap: Record<string, string> = {};
    if (memories) {
      for (const m of memories) {
        memoryMap[m.memory_key] = m.memory_value;
      }
    }

    const allTasks = tasks || [];
    const sessions = focusSessions || [];

    const completedToday = allTasks.filter(
      (t) => t.status === "done" && t.updated_at && t.updated_at.startsWith(targetDateStr)
    );
    const delayedToday = allTasks.filter(
      (t) => t.status !== "done" && t.deadline && t.deadline.startsWith(targetDateStr)
    );

    const focusMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const totalToday = completedToday.length + delayedToday.length;
    const completionRate = totalToday > 0 ? Math.round((completedToday.length / totalToday) * 100) : 100;

    try {
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

      const debriefData: DailyDebriefData = {
        summary: parsed.summary || "You locked in solid focus today! Keep pushing forward.",
        best_achievement: parsed.best_achievement || "Establishing momentum",
        tomorrow_probability: Number(parsed.tomorrow_probability) || 85,
        tomorrow_priorities: parsed.tomorrow_priorities || [],
        improvements: parsed.improvements || [],
        missed_opportunities: parsed.missed_opportunities || [],
        completed_tasks: completedToday.map((t) => t.title),
        delayed_tasks: delayedToday.map((t) => t.title),
        metrics: {
          completion_rate: completionRate,
          focus_time_minutes: focusMinutes,
          productivity_score: parsed.metrics?.productivity_score || 80,
          current_streak: parsed.metrics?.current_streak || 1
        }
      };

      // Save to database
      await supabase
        .from("daily_debriefs")
        .upsert({
          user_id: userId,
          debrief_date: targetDateStr,
          summary: debriefData.summary,
          metrics: debriefData.metrics as any,
          completed_tasks: completedToday.map((t) => t.title) as any,
          delayed_tasks: delayedToday.map((t) => t.title) as any,
          improvements: debriefData.improvements as any,
          tomorrow_priorities: debriefData.tomorrow_priorities as any,
          tomorrow_probability: debriefData.tomorrow_probability,
          best_achievement: debriefData.best_achievement,
          missed_opportunities: debriefData.missed_opportunities as any,
          created_at: new Date().toISOString()
        }, { onConflict: "user_id,debrief_date" });

      // Log event
      await supabase.from("activity_logs").insert({
        user_id: userId,
        action: "DailyDebriefGenerated",
        entity_type: "system",
        metadata: { date: targetDateStr, score: debriefData.metrics.productivity_score } as any
      });

      // Proactive Telegram Daily Debrief
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

        if (account && account.chat_id && (prefs?.telegram_enabled !== false) && (prefs?.daily_debrief_enabled !== false)) {
          const { TelegramBotService } = await import("@/lib/telegram/bot-service");
          
          await TelegramBotService.sendDailyDebrief(account.chat_id, {
            completionRate: debriefData.metrics.completion_rate,
            focusMinutes: debriefData.metrics.focus_time_minutes,
            summary: debriefData.summary,
            priorities: debriefData.tomorrow_priorities,
            streak: debriefData.metrics.current_streak
          });
        }
      } catch (telegramErr) {
        console.error("[DebriefEngine] Failed to dispatch Telegram daily debrief:", telegramErr);
      }

      return debriefData;
    } catch (error) {
      console.error("Error in getOrCreateDailyDebrief:", error);
      return null;
    }
  }

  /**
   * Generates or fetches the weekly reflection.
   */
  static async getOrCreateWeeklyReflection(userId: string): Promise<WeeklyReflectionData | null> {
    const supabase = await createClient();

    // 1. Calculate date range (last 7 days)
    const today = new Date();
    const endDateStr = today.toISOString().split("T")[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Check if reflection exists for the week
    const { data: existing } = await supabase
      .from("weekly_reflections")
      .select("*")
      .eq("user_id", userId)
      .eq("start_date", startDateStr)
      .maybeSingle();

    if (existing) {
      return {
        start_date: existing.start_date,
        end_date: existing.end_date,
        reflection_text: existing.reflection_text,
        metrics: (existing.metrics as unknown as WeeklyReflectionData["metrics"]) || {
          completion_rate: 0,
          best_working_day: "",
          best_working_hours: "",
          most_delayed_category: ""
        },
        weekly_wins: (existing.weekly_wins as string[]) || [],
        focus_trends: (existing.focus_trends as WeeklyReflectionData["focus_trends"]) || [],
        burnout_trend: (existing.burnout_trend as WeeklyReflectionData["burnout_trend"]) || [],
        coaching_advice: existing.coaching_advice || "",
        suggested_changes: (existing.suggested_changes as string[]) || []
      };
    }

    // 2. Fetch weekly history logs
    const { data: history } = await supabase
      .from("productivity_analytics_history")
      .select("*")
      .eq("user_id", userId)
      .gte("recorded_date", startDateStr)
      .lte("recorded_date", endDateStr);

    const historyLogs = history || [];

    const focusTrends = historyLogs.map((h) => ({
      date: h.recorded_date,
      minutes: h.focus_time_minutes || 0
    }));

    const burnoutTrend = historyLogs.map((h) => ({
      date: h.recorded_date,
      score: (h.details as any)?.stress_index || 0
    }));

    // Formulate weekly analytics using Gemini
    try {
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

      const reflectionData: WeeklyReflectionData = {
        start_date: startDateStr,
        end_date: endDateStr,
        reflection_text: parsed.reflection_text || "You maintained a highly consistent work rate this week.",
        coaching_advice: parsed.coaching_advice || "Schedule regular focus breaks to prevent fatigue buildup.",
        weekly_wins: parsed.weekly_wins || [],
        suggested_changes: parsed.suggested_changes || [],
        focus_trends: focusTrends,
        burnout_trend: burnoutTrend,
        metrics: {
          completion_rate: parsed.metrics?.completion_rate || 80,
          best_working_day: parsed.metrics?.best_working_day || "Tuesday",
          best_working_hours: parsed.metrics?.best_working_hours || "09:00 - 11:00",
          most_delayed_category: parsed.metrics?.most_delayed_category || "General"
        }
      };

      // Save to database
      await supabase
        .from("weekly_reflections")
        .upsert({
          user_id: userId,
          start_date: startDateStr,
          end_date: endDateStr,
          reflection_text: reflectionData.reflection_text,
          metrics: reflectionData.metrics as any,
          weekly_wins: reflectionData.weekly_wins as any,
          focus_trends: reflectionData.focus_trends as any,
          burnout_trend: reflectionData.burnout_trend as any,
          coaching_advice: reflectionData.coaching_advice,
          suggested_changes: reflectionData.suggested_changes as any,
          created_at: new Date().toISOString()
        }, { onConflict: "user_id,start_date" });

      // Log event
      await supabase.from("activity_logs").insert({
        user_id: userId,
        action: "WeeklyReflectionGenerated",
        entity_type: "system",
        metadata: { start: startDateStr, end: endDateStr } as any
      });

      // Proactive Telegram Weekly Reflection
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

        if (account && account.chat_id && (prefs?.telegram_enabled !== false) && (prefs?.weekly_reflection_enabled !== false)) {
          const { TelegramBotService } = await import("@/lib/telegram/bot-service");
          
          await TelegramBotService.sendWeeklyReflection(account.chat_id, {
            avgCompletionRate: reflectionData.metrics.completion_rate,
            peakHours: reflectionData.metrics.best_working_hours,
            coachingTip: reflectionData.coaching_advice,
            wins: reflectionData.weekly_wins
          });
        }
      } catch (telegramErr) {
        console.error("[DebriefEngine] Failed to dispatch Telegram weekly reflection:", telegramErr);
      }

      return reflectionData;
    } catch (error) {
      console.error("Error in getOrCreateWeeklyReflection:", error);
      return null;
    }
  }
}
