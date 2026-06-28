import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { AIClient } from "@/lib/ai/providers";

export interface SimulationResult {
  current_completion_probability: number;
  simulated_completion_probability: number;
  current_deadline_risk: string;
  simulated_deadline_risk: string;
  recovery_probability: number;
  workload_impact: string;
  affected_tasks: string[];
  suggested_alternative: string;
  expected_completion_date: string;
  reasoning: string;
}

export class SimulationEngine {

  /**
   * Simulates the impact of a hypothetical action (e.g. postponing a task, skipping study, canceling a meeting)
   * on the user's workload, risk levels, and completion probability using Gemini.
   */
  static async runSimulation(userId: string, scenarioPrompt: string): Promise<SimulationResult | null> {
    const supabase = await createClient();

    // 1. Fetch current tasks and productivity history to build rich context
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "done");

    const { data: history } = await supabase
      .from("productivity_analytics_history")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_date", { ascending: false })
      .limit(7);

    const pendingTasks = tasks || [];
    const historyLogs = history || [];

    try {
      const context = {
        pendingTasks: pendingTasks.map((t) => ({
          title: t.title,
          priority: t.priority,
          deadline: t.deadline,
          duration: t.estimated_duration || 30,
          score: t.priority_score || 50
        })),
        recentAnalytics: historyLogs.map((h) => ({
          date: h.recorded_date,
          completed: h.tasks_completed_count,
          probability: h.completion_probability_average
        })),
        scenario: scenarioPrompt
      };

      const prompt = `You are the Clutch AI Simulator. 
You predict the future impact of user decisions without modifying any database records.
User wants to simulate this decision: "${scenarioPrompt}"

Current system state context:
${JSON.stringify(context, null, 2)}

Analyze the consequences of this decision on their deadlines, workload density, stress, and completion probabilities.
Estimate how it shifts their current completion probability, deadline risk (LOW, MEDIUM, HIGH, CRITICAL), and recovery requirements.

Respond ONLY with a valid JSON object matching this schema:
{
  "current_completion_probability": integer (0-100, current estimate before decision),
  "simulated_completion_probability": integer (0-100, predicted estimate after decision),
  "current_deadline_risk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "simulated_deadline_risk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recovery_probability": integer (0-100, how easy it is to recover if they take a suggested alternative),
  "workload_impact": "DECREASED" | "NO CHANGE" | "STRESSED" | "OVERLOADED",
  "affected_tasks": ["Title of task 1", "Title of task 2"],
  "suggested_alternative": "Concise, actionable advice on what they should do instead to mitigate risk",
  "expected_completion_date": "YYYY-MM-DD format of new completion timeline",
  "reasoning": "A concise explanation of why the probability and risks shifted, including specific bottlenecks created."
}

Do not wrap in markdown or include extra conversational text. Return raw JSON.`;

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

      // Log event in activity logs
      await supabase.from("activity_logs").insert({
        user_id: userId,
        action: "SimulationRequested",
        entity_type: "system",
        metadata: {
          scenario: scenarioPrompt,
          impact: parsed.workload_impact,
          simulated_prob: parsed.simulated_completion_probability
        }
      });

      return {
        current_completion_probability: Number(parsed.current_completion_probability) || 90,
        simulated_completion_probability: Number(parsed.simulated_completion_probability) || 70,
        current_deadline_risk: parsed.current_deadline_risk || "LOW",
        simulated_deadline_risk: parsed.simulated_deadline_risk || "HIGH",
        recovery_probability: Number(parsed.recovery_probability) || 80,
        workload_impact: parsed.workload_impact || "STRESSED",
        affected_tasks: parsed.affected_tasks || [],
        suggested_alternative: parsed.suggested_alternative || "Maintain a 30-minute high-focus interval today.",
        expected_completion_date: parsed.expected_completion_date || new Date().toISOString().split("T")[0],
        reasoning: parsed.reasoning || "Postponing increases density tomorrow, increasing the probability of missing adjacent deadlines."
      };
    } catch (error) {
      console.error("Error in runSimulation:", error);
      return null;
    }
  }
}
