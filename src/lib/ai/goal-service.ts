import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIGeneratedTask {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  estimated_duration: number;
}

export class GoalService {
  /**
   * Automatically decomposes a Milestone into actionable tasks using Gemini,
   * and inserts them into the tasks table.
   */
  static async autoDecomposeMilestone(
    userId: string,
    goalTitle: string,
    milestoneId: string,
    milestoneTitle: string,
    milestoneDescription?: string
  ): Promise<AIGeneratedTask[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[GoalService] Missing GEMINI_API_KEY. Skipping task autogeneration.");
      return [];
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const systemInstruction = `
You are Clutch AI's Goal Decomposer. Your task is to break down a high-level milestone into 3 to 5 highly actionable, granular, and specific tasks.
Each task must be ready to work on immediately.

Your response MUST be a single, strictly valid JSON array of objects.

JSON SCHEMA:
[
  {
    "title": "Actionable task name",
    "description": "Short explanation of what to do",
    "priority": "critical" | "high" | "medium" | "low",
    "estimated_duration": estimated completion minutes (integer)
  }
]
`;

      const prompt = `
Goal: "${goalTitle}"
Milestone: "${milestoneTitle}"
Milestone Description: "${milestoneDescription || ""}"

Decompose this milestone into 3-5 clear tasks.
`;

      const result = await model.generateContent([systemInstruction, prompt]);
      const tasks: AIGeneratedTask[] = JSON.parse(result.response.text());

      if (tasks && tasks.length > 0) {
        const supabase = await createClient();
        console.log(`[GoalService] Generated ${tasks.length} tasks for milestone "${milestoneTitle}"`);

        const taskPayloads = tasks.map((t) => ({
          user_id: userId,
          milestone_id: milestoneId,
          title: t.title,
          description: t.description || null,
          priority: (t.priority || "medium") as "critical" | "high" | "medium" | "low",
          status: "todo" as const,
          estimated_duration: t.estimated_duration || 45,
          completion_percentage: 0,
          priority_score: t.priority === "critical" ? 90 : t.priority === "high" ? 75 : 50,
          risk_level: "low" as const,
          completion_probability: 95
        }));

        const { error } = await supabase.from("tasks").insert(taskPayloads);
        if (error) {
          console.error("[GoalService] Error inserting generated tasks:", error.message);
        }
      }

      return tasks;
    } catch (err) {
      console.error("[GoalService] Decompose milestone failed:", err);
      return [];
    }
  }
}
