import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AIClient } from "./providers";

export interface GoalBlueprint {
  title: string;
  description: string;
  category: "personal" | "fitness" | "health" | "learning" | "career" | "business" | "finance" | "relationship" | "travel" | "habit" | "custom";
  term: "short_term" | "medium_term" | "long_term";
  duration_days: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  success_probability: number;
  risk_score: number;
  required_hours: number;
  weekly_commitment_hours: number;
  daily_commitment_minutes: number;
  summary: string;
  potential_obstacles: string[];
  emergency_recovery_plan: string;
  confidence_score: number;
  milestones: Array<{
    title: string;
    description: string;
    target_day_offset: number;
    reward: string;
    risk: string;
    tasks: Array<{
      title: string;
      description: string;
      priority: "critical" | "high" | "medium" | "low";
      estimated_duration: number;
    }>;
  }>;
  habits: Array<{
    title: string;
    description: string;
    frequency: "daily" | "weekly" | "weekdays" | "weekends";
  }>;
}

export class GoalPlannerEngine {
  /**
   * Process a step in the Goal-Setting chat interview.
   * Prompts Gemini to review the dialogue, ask the next question,
   * or mark the interview as completed and output the structured GoalBlueprint.
   */
  static async processInterview(
    userId: string,
    dialogue: Array<{ role: "user" | "model"; content: string }>,
    latestMessage: string
  ): Promise<{ completed: boolean; question?: string; blueprint?: GoalBlueprint }> {
    const updatedDialogue = [...dialogue, { role: "user" as const, content: latestMessage }];

    const systemPrompt = `You are Clutch AI's Goal Coaching Facilitator.
Your goal is to guide the user in setting a realistic, highly detailed, and actionable goal (e.g. losing weight, coding an app, learning a language).

You should interview the user step-by-step. Keep your responses brief, conversational, and direct (ask only 1-2 questions at a time).
Do not overwhelm the user. Gather details about:
- Target objective, timeline, and metrics.
- Experience level, current baseline, and constraints (e.g. knee injury, busy schedule).
- Gym or home workout preference, diet, learning hours.
- Time availability (days and hours per week).
- Preferred schedule.
- Biggest challenges/obstacles they expect.

Review the dialogue logs. Once you have enough context to construct a complete blueprint (usually after 4-8 message exchanges), generate the final blueprint JSON.
Otherwise, continue the interview by asking the next logical question.

Your response MUST be a strictly valid JSON object matching one of the two formats:

Format 1: If MORE information is needed:
{
  "completed": false,
  "question": "Your next follow-up question here"
}

Format 2: If you have SUFFICIENT information:
{
  "completed": true,
  "blueprint": {
    "title": "Goal Title",
    "description": "Short description of the goal roadmap",
    "category": "personal" | "fitness" | "health" | "learning" | "career" | "business" | "finance" | "relationship" | "travel" | "habit" | "custom",
    "term": "short_term" | "medium_term" | "long_term",
    "duration_days": integer (total days to complete),
    "difficulty": "easy" | "medium" | "hard" | "expert",
    "success_probability": integer (predicted chance of success 0-100),
    "risk_score": integer (0-100),
    "required_hours": integer (total hours estimated to invest),
    "weekly_commitment_hours": integer,
    "daily_commitment_minutes": integer,
    "summary": "Comprehensive overview of the execution strategy",
    "potential_obstacles": ["obstacle 1", "obstacle 2"],
    "emergency_recovery_plan": "Emergency steps to take if streak or consistency drops below 50%",
    "confidence_score": integer (0-100),
    "milestones": [
      {
        "title": "Milestone Title",
        "description": "Actionable milestone description",
        "target_day_offset": integer (day number from start of goal, e.g. 15, 30, 60),
        "reward": "A micro-reward to incentivize achieving this milestone",
        "risk": "Short explanation of risks if they miss this milestone",
        "tasks": [
          {
            "title": "Task title",
            "description": "Actionable task description",
            "priority": "critical" | "high" | "medium" | "low",
            "estimated_duration": integer (in minutes)
          }
        ]
      }
    ],
    "habits": [
      {
        "title": "Habit Title",
        "description": "Required repeating habit behavior",
        "frequency": "daily" | "weekly" | "weekdays" | "weekends"
      }
    ]
  }
}

Do not include markdown codeblocks or wrap in any markdown. Return raw JSON text.`;

    const promptText = `
Dialogue history:
${JSON.stringify(updatedDialogue, null, 2)}

Evaluate the dialogue and respond.
`;

    try {
      const responseText = await AIClient.generateText(
        [{ role: "user", content: promptText }],
        {
          provider: "gemini",
          model: "gemini-1.5-flash",
          systemPrompt,
          responseMimeType: "application/json",
        }
      );

      const parsed = JSON.parse(responseText.trim().replace(/```json/gi, "").replace(/```/gi, "").trim());
      
      return {
        completed: !!parsed.completed,
        question: parsed.question,
        blueprint: parsed.blueprint,
      };
    } catch (error) {
      console.error("[GoalPlannerEngine] Error processing interview:", error);
      return {
        completed: false,
        question: "Could you repeat that? Let's check your availability and constraints.",
      };
    }
  }

  /**
   * Commits an AI GoalBlueprint to the Supabase database.
   * Inserts Goal, Milestones, Tasks, and Habits.
   */
  static async instantiateGoal(userId: string, blueprint: GoalBlueprint): Promise<string> {
    const supabase = createServiceClient() as any;

    // Calculate absolute target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + blueprint.duration_days);

    // 1. Insert Goal
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        title: blueprint.title,
        description: blueprint.description,
        target_date: targetDate.toISOString().split("T")[0],
        status: "active",
        category: blueprint.category,
        term: blueprint.term,
        health_score: 100,
        momentum_score: 100,
        consistency: 100,
        streak: 0,
        blueprint: {
          difficulty: blueprint.difficulty,
          required_hours: blueprint.required_hours,
          weekly_commitment_hours: blueprint.weekly_commitment_hours,
          daily_commitment_minutes: blueprint.daily_commitment_minutes,
          potential_obstacles: blueprint.potential_obstacles,
          emergency_recovery_plan: blueprint.emergency_recovery_plan,
          confidence_score: blueprint.confidence_score,
          summary: blueprint.summary,
        },
        forecast: {
          success_probability: blueprint.success_probability,
          estimated_completion_date: targetDate.toISOString().split("T")[0],
          risk_score: blueprint.risk_score,
        },
      })
      .select()
      .single();

    if (goalError || !goal) {
      console.error("[GoalPlannerEngine] Error inserting goal:", goalError?.message);
      throw new Error(`Failed to create goal: ${goalError?.message}`);
    }

    // 2. Insert Habits
    if (blueprint.habits && blueprint.habits.length > 0) {
      const habitsPayload = blueprint.habits.map((h) => ({
        user_id: userId,
        goal_id: goal.id,
        title: h.title,
        description: h.description,
        frequency: h.frequency,
        streak: 0,
      }));
      const { error: habitsError } = await supabase.from("habits").insert(habitsPayload);
      if (habitsError) {
        console.error("[GoalPlannerEngine] Non-blocking: Error inserting habits:", habitsError.message);
      }
    }

    // 3. Insert Milestones & Tasks
    for (const ms of blueprint.milestones) {
      const msTargetDate = new Date();
      msTargetDate.setDate(msTargetDate.getDate() + ms.target_day_offset);

      const { data: milestone, error: msError } = await supabase
        .from("milestones")
        .insert({
          goal_id: goal.id,
          title: ms.title,
          description: ms.description,
          target_date: msTargetDate.toISOString().split("T")[0],
          status: "todo",
          completion_percentage: 0,
          reward: ms.reward,
          risk: ms.risk,
        })
        .select()
        .single();

      if (msError || !milestone) {
        console.error("[GoalPlannerEngine] Error inserting milestone:", msError?.message);
        continue;
      }

      // Insert Milestone Tasks
      if (ms.tasks && ms.tasks.length > 0) {
        const tasksPayload = ms.tasks.map((t) => ({
          user_id: userId,
          milestone_id: milestone.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: "todo",
          estimated_duration: t.estimated_duration,
          completion_percentage: 0,
          priority_score: t.priority === "critical" ? 95 : t.priority === "high" ? 80 : t.priority === "medium" ? 60 : 30,
          risk_level: "low",
          completion_probability: 95,
        }));
        const { error: tasksError } = await supabase.from("tasks").insert(tasksPayload);
        if (tasksError) {
          console.error("[GoalPlannerEngine] Error inserting milestone tasks:", tasksError.message);
        }
      }
    }

    return goal.id;
  }
}
