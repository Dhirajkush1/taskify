import { createServiceClient } from "@/lib/supabase/service";
import { AIClient } from "./providers";

export class GoalRiskEngine {
  /**
   * Recalculates the Goal Health Score (0-100) and Momentum Score (0-100)
   * based on task completion rates, missed deadlines, check-ins, and habit consistency.
   */
  static async calculateGoalHealth(goalId: string): Promise<{ health: number; momentum: number; consistency: number }> {
    const supabase = createServiceClient() as any;

    // 1. Fetch goal, milestones, and tasks
    const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (!goal) return { health: 100, momentum: 100, consistency: 100 };

    const { data: milestones } = await supabase.from("milestones").select("id").eq("goal_id", goalId);
    const milestoneIds = (milestones || []).map((m: any) => m.id);

    let tasks: any[] = [];
    if (milestoneIds.length > 0) {
      const { data: objectives } = await supabase
        .from("weekly_objectives")
        .select("id")
        .in("milestone_id", milestoneIds);
      const objectiveIds = (objectives || []).map((o: any) => o.id);

      if (objectiveIds.length > 0) {
        const { data: goalTasks } = await supabase
          .from("goal_tasks")
          .select("*")
          .in("objective_id", objectiveIds);
        tasks = goalTasks || [];
      }
    }

    // 2. Fetch habits
    const { data: habits } = await supabase.from("habits").select("*").eq("goal_id", goalId);
    const goalHabits = habits || [];

    // 3. Fetch checkins
    const { data: checkins } = await supabase
      .from("goal_checkins")
      .select("*")
      .eq("goal_id", goalId)
      .order("checkin_date", { ascending: false })
      .limit(7);
    const recentCheckins = checkins || [];

    // Calculate Task Metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;

    const today = new Date();
    const missedTasks = tasks.filter((t) => {
      if (t.status === "done") return false;
      if (!t.deadline) return false;
      return new Date(t.deadline) < today;
    });

    // Calculate Habit Metrics
    let totalHabitsStreak = 0;
    let missedHabitsCount = 0;
    goalHabits.forEach((h: any) => {
      totalHabitsStreak += h.streak || 0;
      // If habit was completed but last completion is older than 2 days (for daily habits), mark as missed
      if (h.frequency === "daily" && h.last_completed_at) {
        const daysSinceLast = (Date.now() - new Date(h.last_completed_at).getTime()) / (1000 * 3600 * 24);
        if (daysSinceLast > 2) missedHabitsCount++;
      }
    });

    // Calculate Health Score: Starts at 100, declines with missed tasks and habits
    let health = 100;
    health -= missedTasks.length * 8; // penalty per missed task
    health -= missedHabitsCount * 12; // penalty per inactive habit
    health = Math.max(0, Math.min(100, Math.round(health)));

    // Calculate Consistency: percentage of tasks done + habit streaks
    let consistency = 100;
    if (totalTasks > 0 || goalHabits.length > 0) {
      const taskWeight = totalTasks > 0 ? taskCompletionRate : 100;
      const habitWeight = goalHabits.length > 0 
        ? Math.min(100, (totalHabitsStreak / (goalHabits.length * 5)) * 100) 
        : 100;
      consistency = Math.round((taskWeight + habitWeight) / 2);
    }

    // Calculate Momentum: based on consistency + checkin mood/energy trends
    let momentum = consistency;
    if (recentCheckins.length > 0) {
      const avgMoodEnergy = recentCheckins.reduce((acc: number, c: any) => acc + (c.mood_energy || 5), 0) / recentCheckins.length;
      momentum = Math.round((consistency + (avgMoodEnergy * 10)) / 2);
    }
    momentum = Math.max(0, Math.min(100, momentum));

    // 4. Update the goal record
    await supabase
      .from("goals")
      .update({
        health_score: health,
        momentum_score: momentum,
        consistency: consistency,
        streak: totalHabitsStreak, // aggregate streak of linked habits
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId);

    // If health drops below 50%, trigger emergency Rescue Mode alerts/tasks
    if (health < 50) {
      console.warn(`[GoalRiskEngine] Goal ${goalId} health is at ${health}%. Triggering Rescue Mode.`);
    }

    return { health, momentum, consistency };
  }
}

export class GoalForecastEngine {
  /**
   * Evaluates the success probability and forecasts a final completion date.
   */
  static async runForecast(goalId: string): Promise<{ successProbability: number; forecastedCompletion: string; riskAnalysis: string }> {
    const supabase = createServiceClient() as any;

    const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (!goal) throw new Error("Goal not found");

    const { data: milestones } = await supabase
      .from("milestones")
      .select("*, weekly_objectives(*, goal_tasks(*))")
      .eq("goal_id", goalId);
    const msList = milestones || [];

    const systemPrompt = `You are Clutch AI's Goal Forecasting Engine.
Your task is to analyze the current progress of a user's goal, detect risk patterns, estimate the probability of success (0-100%), and forecast the estimated completion date.

Current Goal: "${goal.title}"
Target Date: ${goal.target_date}
Current Health Score: ${goal.health_score}
Current Consistency: ${goal.consistency}%
Current Momentum Score: ${goal.momentum_score}

Milestones & Tasks details:
${JSON.stringify(msList, null, 2)}

Provide an updated forecast. Respond ONLY with a valid JSON matching this schema:
{
  "success_probability": integer (0-100),
  "forecasted_completion": "YYYY-MM-DD",
  "risk_analysis": "Short 2-3 sentence analysis of major risks, bottle-necks, and advice"
}`;

    try {
      const responseText = await AIClient.generateText(
        [{ role: "user", content: "Generate the forecast analysis." }],
        {
          provider: "gemini",
          model: "gemini-1.5-flash",
          systemPrompt,
          responseMimeType: "application/json",
        }
      );

      const parsed = JSON.parse(responseText.trim().replace(/```json/gi, "").replace(/```/gi, "").trim());

      const prob = Number(parsed.success_probability) || 75;
      const forecastDate = parsed.forecasted_completion || goal.target_date;
      const analysis = parsed.risk_analysis || "Progress is steady; maintain habit consistency.";

      // Upsert into goal_predictions table
      await supabase.from("goal_predictions").insert({
        goal_id: goalId,
        success_probability: prob,
        forecasted_completion: forecastDate,
        risk_analysis: analysis,
      });

      // Update goal forecast field
      await supabase
        .from("goals")
        .update({
          forecast: {
            success_probability: prob,
            estimated_completion_date: forecastDate,
            risk_score: 100 - prob,
          },
        })
        .eq("id", goalId);

      return {
        successProbability: prob,
        forecastedCompletion: forecastDate,
        riskAnalysis: analysis,
      };
    } catch (err) {
      console.error("[GoalForecastEngine] Forecast calculation failed:", err);
      return {
        successProbability: goal.forecast?.success_probability || 75,
        forecastedCompletion: goal.forecast?.estimated_completion_date || goal.target_date,
        riskAnalysis: "Coaching forecast telemetry is momentarily offline.",
      };
    }
  }

  /**
   * Run a What-If Scenario simulation for a specific goal.
   */
  static async simulateGoalScenario(
    goalId: string,
    scenarioPrompt: string
  ): Promise<{ successProbability: number; forecastedCompletion: string; alternative: string; impactText: string }> {
    const supabase = createServiceClient() as any;

    const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (!goal) throw new Error("Goal not found");

    const systemPrompt = `You are Clutch AI's What-If Simulator.
Assess the impact of the user's hypothetical scenario: "${scenarioPrompt}" on their goal: "${goal.title}".

Goal Baseline:
- Target Date: ${goal.target_date}
- Success Probability: ${goal.forecast?.success_probability || 75}%
- Health Score: ${goal.health_score}

Predict:
1. The new simulated success probability (0-100).
2. The simulated completion date (YYYY-MM-DD).
3. Suggested alternative or recovery advice.
4. Summary impact statement.

Respond ONLY with a valid JSON matching this schema:
{
  "simulated_probability": integer,
  "simulated_completion": "YYYY-MM-DD",
  "suggested_alternative": "Actionable advice to counteract the impact",
  "impact_text": "A brief summary of how this action shifts the timeline and risks"
}`;

    try {
      const responseText = await AIClient.generateText(
        [{ role: "user", content: "Run simulation." }],
        {
          provider: "gemini",
          model: "gemini-1.5-flash",
          systemPrompt,
          responseMimeType: "application/json",
        }
      );

      const parsed = JSON.parse(responseText.trim().replace(/```json/gi, "").replace(/```/gi, "").trim());

      return {
        successProbability: Number(parsed.simulated_probability) || 50,
        forecastedCompletion: parsed.simulated_completion || goal.target_date,
        alternative: parsed.suggested_alternative || "Buffer with emergency tasks.",
        impactText: parsed.impact_text || "The change shifts the focus load later into the term.",
      };
    } catch (err) {
      console.error("[GoalForecastEngine] What-If simulation failed:", err);
      return {
        successProbability: 50,
        forecastedCompletion: goal.target_date,
        alternative: "Keep focus blocks tightly managed.",
        impactText: "Unable to simulate scenario parameters.",
      };
    }
  }
}

export class GoalScheduler {
  /**
   * Automatically schedules goal milestone tasks into available blocks in the calendar.
   */
  static async scheduleMilestoneTasks(userId: string, milestoneId: string): Promise<number> {
    const supabase = createServiceClient() as any;

    // Fetch tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("milestone_id", milestoneId)
      .eq("status", "todo");
    const todoTasks = tasks || [];

    if (todoTasks.length === 0) return 0;

    // Fetch calendar events to avoid conflicts
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);

    const { data: events } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .gte("start_time", startDate.toISOString())
      .lte("end_time", endDate.toISOString());
    const existingEvents = events || [];

    let scheduledCount = 0;
    let scheduleCursor = new Date();
    scheduleCursor.setHours(9, 0, 0, 0); // start slotting tomorrow at 9 AM

    for (const task of todoTasks) {
      // Find the next available 1-hour block
      let slotFound = false;
      const durationMin = task.estimated_duration || 60;

      while (!slotFound && scheduledCount < 20) {
        // Increment by days/hours if we slip outside working hours
        if (scheduleCursor.getHours() >= 17) {
          scheduleCursor.setDate(scheduleCursor.getDate() + 1);
          scheduleCursor.setHours(9, 0, 0, 0);
        }

        // Weekend shift
        if (scheduleCursor.getDay() === 0 || scheduleCursor.getDay() === 6) {
          scheduleCursor.setDate(scheduleCursor.getDate() + 1);
          scheduleCursor.setHours(9, 0, 0, 0);
          continue;
        }

        const slotStart = new Date(scheduleCursor);
        const slotEnd = new Date(scheduleCursor);
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMin);

        // Check for conflicts
        const conflict = existingEvents.some((e: any) => {
          const eStart = new Date(e.start_time);
          const eEnd = new Date(e.end_time);
          return (
            (slotStart >= eStart && slotStart < eEnd) ||
            (slotEnd > eStart && slotEnd <= eEnd) ||
            (slotStart <= eStart && slotEnd >= eEnd)
          );
        });

        if (!conflict) {
          // Schedule calendar event
          const { error } = await supabase.from("calendar_events").insert({
            user_id: userId,
            summary: `🎯 [Goal Task] ${task.title}`,
            description: task.description || "Milestone execution task",
            start_time: slotStart.toISOString(),
            end_time: slotEnd.toISOString(),
            status: "confirmed",
            color_id: "violet",
            source: "taskify",
            metadata: {
              task_id: task.id,
              milestone_id: milestoneId,
            },
          });

          if (!error) {
            // Update task deadline
            await supabase
              .from("tasks")
              .update({ deadline: slotStart.toISOString().split("T")[0] })
              .eq("id", task.id);

            scheduledCount++;
            slotFound = true;
          }
        }

        // Shift cursor forward by 1 hour
        scheduleCursor.setHours(scheduleCursor.getHours() + 1);
      }
    }

    return scheduledCount;
  }
}

export class GoalAdaptiveEngine {
  /**
   * Adapts the plan dynamically to reality (e.g. injuries, changes in schedule, missed milestones).
   */
  static async adaptPlan(
    userId: string,
    goalId: string,
    incidentPrompt: string
  ): Promise<{ success: boolean; adjustmentsSummary: string }> {
    const supabase = createServiceClient() as any;

    const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (!goal) throw new Error("Goal not found");

    const { data: milestones } = await supabase.from("milestones").select("*, tasks(*)").eq("goal_id", goalId);
    const msList = milestones || [];

    const systemPrompt = `You are Clutch AI's Adaptive Planning Engine.
The user is tracking this goal: "${goal.title}".
They experienced this change: "${incidentPrompt}"

You must adjust their plan. You can:
1. Extend the goal target_date.
2. Modify or reschedule milestone target dates.
3. Recommend tasks to delete (e.g. remove "running" if they have a knee injury) and new tasks to add (e.g. add "swimming").
4. Adjust habits (replace or disable).

Provide the adjustments. Respond ONLY with a valid JSON matching this schema:
{
  "extend_goal_days": integer (additional days to extend the goal, 0 if no change),
  "milestone_adjustments": [
    {
      "milestone_id": "string UUID of milestone",
      "extend_days": integer
    }
  ],
  "tasks_to_add": [
    {
      "milestone_id": "string UUID of milestone",
      "title": "New task title",
      "description": "Short explanation",
      "priority": "critical" | "high" | "medium" | "low",
      "estimated_duration": integer (minutes)
    }
  ],
  "tasks_to_delete": ["string UUID of tasks to remove"],
  "summary": "Short 2-3 sentence overview explaining how the plan adapted to the situation"
}`;

    try {
      const responseText = await AIClient.generateText(
        [{ role: "user", content: "Determine adjustments." }],
        {
          provider: "gemini",
          model: "gemini-1.5-flash",
          systemPrompt,
          responseMimeType: "application/json",
        }
      );

      const parsed = JSON.parse(responseText.trim().replace(/```json/gi, "").replace(/```/gi, "").trim());

      // 1. Extend goal deadline if requested
      if (parsed.extend_goal_days && parsed.extend_goal_days > 0) {
        const currentTarget = new Date(goal.target_date);
        currentTarget.setDate(currentTarget.getDate() + parsed.extend_goal_days);
        await supabase
          .from("goals")
          .update({ target_date: currentTarget.toISOString().split("T")[0] })
          .eq("id", goalId);
      }

      // 2. Adjust milestone deadlines
      if (parsed.milestone_adjustments) {
        for (const adj of parsed.milestone_adjustments) {
          const ms = msList.find((m: any) => m.id === adj.milestone_id);
          if (ms) {
            const currentMsTarget = new Date(ms.target_date);
            currentMsTarget.setDate(currentMsTarget.getDate() + adj.extend_days);
            await supabase
              .from("milestones")
              .update({ target_date: currentMsTarget.toISOString().split("T")[0] })
              .eq("id", ms.id);
          }
        }
      }

      // 3. Delete obsolete tasks
      if (parsed.tasks_to_delete && parsed.tasks_to_delete.length > 0) {
        await supabase.from("tasks").delete().in("id", parsed.tasks_to_delete);
      }

      // 4. Add new tasks
      if (parsed.tasks_to_add && parsed.tasks_to_add.length > 0) {
        const newTasks = parsed.tasks_to_add.map((t: any) => ({
          user_id: userId,
          milestone_id: t.milestone_id,
          title: t.title,
          description: t.description,
          priority: t.priority || "medium",
          status: "todo",
          estimated_duration: t.estimated_duration || 60,
          completion_percentage: 0,
          priority_score: t.priority === "critical" ? 95 : 60,
          risk_level: "low",
          completion_probability: 95,
        }));

        for (const payload of newTasks) {
          const { data: existing } = await supabase
            .from("tasks")
            .select("id")
            .eq("user_id", userId)
            .ilike("title", payload.title.trim())
            .eq("status", "todo")
            .limit(1);

          if (existing && existing.length > 0) {
            await supabase
              .from("tasks")
              .update(payload as any)
              .eq("id", existing[0].id);
          } else {
            await supabase
              .from("tasks")
              .insert(payload as any);
          }
        }
      }

      // Log adaptive session
      await supabase.from("goal_ai_sessions").insert({
        user_id: userId,
        goal_id: goalId,
        session_type: "coaching_feedback",
        summary: `Adapted to: "${incidentPrompt}". Action details: ${parsed.summary}`,
        dialogue: [{ role: "user", content: incidentPrompt }, { role: "model", content: parsed.summary }],
      });

      return {
        success: true,
        adjustmentsSummary: parsed.summary || "Plan updated to align with current physical limits.",
      };
    } catch (err) {
      console.error("[GoalAdaptiveEngine] Adaptation failed:", err);
      return {
        success: false,
        adjustmentsSummary: "Failed to adapt the plan parameters dynamically.",
      };
    }
  }
}
