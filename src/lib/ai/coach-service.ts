import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ContextBuilder } from "./context-builder";
import type { Task } from "@/types/app.types";

export interface CoachingInsight {
  encouragement: string;
  micro_tasks: string[];
  metrics_brief: string;
}

export class CoachService {
  /**
   * Generates a proactive smart coaching card based on current workload, streaks, and delays.
   */
  static async generateCoachingCard(userId: string, tasks: Task[]): Promise<CoachingInsight> {
    const pending = tasks.filter((t) => t.status !== "done" && t.status !== "archived");
    const completed = tasks.filter((t) => t.status === "done");
    const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

    // Detect if any task has been updated (postponed) multiple times
    // Let's search for tasks with high priority_score but still todo
    const highlyPostponedTask = pending.find((t) => (t.priority_score || 0) > 75 && t.status === "todo");

    // Standard fallback values
    let metrics_brief = `You have completed ${completionRate}% of your active missions today.`;
    let encouragement = "Keep up the momentum! Let's conquer the next block.";
    let micro_tasks = ["Open your dashboard", "Check off one subtask"];

    if (highlyPostponedTask) {
      metrics_brief = `Task "${highlyPostponedTask.title}" has high urgency but hasn't been started yet.`;
      encouragement = `Let's break "${highlyPostponedTask.title}" down into a small, zero-friction win. Doing just 15 minutes of work now will dramatically boost your momentum.`;
      micro_tasks = [
        `Open the workspace for "${highlyPostponedTask.title}"`,
        `Write down the very first sentence or outline`,
        `Work for exactly 5 minutes with a timer`
      ];
    }

    // Call Gemini to supercharge the coaching insight!
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { encouragement, micro_tasks, metrics_brief };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const context = await ContextBuilder.buildContext(userId, "give coaching advice and progress metrics");

      const systemInstruction = `
You are Clutch's Smart Coach. Your goal is to analyze the user's workload, streaks, and delays, and output highly empathetic, motivating, and strategic coaching advice.
Highlight completion percentages, calculate probability boosts, and provide concrete, low-friction micro-task wins.

Your response MUST be a single, strictly valid JSON object.

JSON SCHEMA:
{
  "encouragement": "A highly premium, motivating coach comment (e.g. 'You've postponed this twice. Let's reduce it to a 15-minute task!'), keeping settings personality in mind.",
  "micro_tasks": [
    "Ultra-small, zero-friction action step 1 (e.g. 'Open document')",
    "Ultra-small action step 2"
  ],
  "metrics_brief": "A summary of today's progress (e.g. 'Completing this task now increases today's completion probability to 91%')"
}
`;

      const prompt = `
${context.promptContextString}
Generate my smart coaching insight card now. Keep user stress levels low and motivation high.
`;

      const result = await model.generateContent([systemInstruction, prompt]);
      return JSON.parse(result.response.text());
    } catch (err) {
      console.error("[CoachService] Gemini coaching generation error, returning fallback:", err);
      return { encouragement, micro_tasks, metrics_brief };
    }
  }
}
