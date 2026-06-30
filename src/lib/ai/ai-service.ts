
export interface AutonomousAIOutput {
  chat_response: string;
  extracted_tasks: Array<{
    title: string;
    description: string;
    deadline: string | null;
    priority: "critical" | "high" | "medium" | "low";
    estimated_duration: number | null;
    priority_score: number;
    risk_level: "low" | "medium" | "high" | "critical";
    completion_probability: number;
    subtasks: string[];
    dependencies: string[];
    missing_information: string;
  }>;
  execution_plan: {
    today: string[];
    tomorrow: string[];
    weekly: string[];
    estimated_finish_time: string;
    recommended_work_blocks: string;
  };
  coaching_advice?: {
    encouragement: string;
    alternative_plan: string;
    micro_tasks: string[];
  };
}

/**
 * Priority Engine Helper Calculations
 * These formulas are implemented programmatically as a fallback and as calibration for AI outputs.
 */
export function calculatePriorityMetrics(task: {
  urgencyDays: number; // days until deadline
  importance: 1 | 2 | 3 | 4 | 5; // user/AI assigned importance
  estimatedEffortHours: number;
  dependencyCount: number;
}) {
  // 1. Urgency Score (higher if closer to deadline)
  const urgencyScore = task.urgencyDays <= 0 ? 100 : Math.max(0, 100 - task.urgencyDays * 15);

  // 2. Effort Impact (longer tasks are higher effort, but lower priority if we want quick wins)
  const effortFactor = Math.min(100, task.estimatedEffortHours * 10);

  // 3. Priority Score = Weighted combination of Importance and Urgency
  const priorityScore = Math.round(urgencyScore * 0.4 + task.importance * 12 * 0.4 + (100 - effortFactor) * 0.2);

  // 4. Risk Score = Combination of Urgency and Dependency lock
  const dependencyFactor = Math.min(100, task.dependencyCount * 25);
  const riskVal = urgencyScore * 0.6 + dependencyFactor * 0.4;
  const risk_level: "low" | "medium" | "high" | "critical" =
    riskVal > 80 ? "critical"
    : riskVal > 60 ? "high"
    : riskVal > 35 ? "medium"
    : "low";

  // 5. Completion Probability = Baseline probability reduced by effort and dependencies
  const completion_probability = Math.max(
    10,
    Math.round(100 - effortFactor * 0.3 - dependencyFactor * 0.2 - (task.urgencyDays < 2 ? 30 : 0))
  );

  return {
    priority_score: Math.min(100, Math.max(0, priorityScore)),
    risk_level,
    completion_probability: Math.min(100, Math.max(0, completion_probability)),
  };
}

/**
 * Reusable prompt architecture for the Autonomous AI engine.
 */
export const AUTONOMOUS_SYSTEM_PROMPT = (todayStr: string, dayOfWeek: string) => `
You are Clutch AI, an autonomous, highly advanced, and deeply encouraging AI productivity companion.
Unlike normal assistants that simply reply, you must THINK, extract structure, plan, and coach the user.

Today's date and time is: ${todayStr} (which is a ${dayOfWeek}). Use this to calculate exact relative deadlines.

Your response MUST be a single, strictly valid JSON object. Do not output markdown code wraps (like \`\`\`json), do not output plain text, do not explain. Just output the JSON.

JSON SCHEMA:
{
  "chat_response": "A highly premium, conversational, empathetic, and encouraging reply summarizing your thoughts, confirming tasks created, and outlining the next steps. Address the user directly and friendly.",
  "extracted_tasks": [
    {
      "title": "Actionable task name",
      "description": "Short summary or context",
      "deadline": "ISO 8601 string of calculated deadline, or null",
      "priority": "critical" | "high" | "medium" | "low",
      "estimated_duration": estimated completion minutes (integer), or null,
      "priority_score": 1-100 score calculating deadline urgency, effort, and importance,
      "risk_level": "low" | "medium" | "high" | "critical",
      "completion_probability": 1-100 percentage based on urgency, effort, and dependencies,
      "subtasks": ["Step 1", "Step 2", ... (3 to 10 subtasks chunked automatically for large/medium tasks)],
      "dependencies": ["Task title this depends on, or empty array"],
      "missing_information": "Any crucial detail missing (e.g. 'What time is the exam?') or empty string"
    }
  ],
  "extracted_reminders": [
    {
      "title": "Reminder or reminder action title",
      "reminder_time": "Time string (e.g. 'in 15 minutes', '2026-06-27T10:00:00Z', 'tomorrow at 9 AM') or null if no time is explicitly provided",
      "reminder_type": "specific_time" | "relative_time" | "recurring" | "deadline" | "smart",
      "recurrence_pattern": "daily" | "weekly" | "every 2 hours" | null,
      "priority": "low" | "medium" | "high" | "critical" | null
    }
  ],
  "extracted_goals": [
    {
      "title": "High-level strategic goal title",
      "description": "Short description of what to achieve",
      "target_date": "YYYY-MM-DD target date string, or null",
      "milestones": ["Key milestone 1", "Key milestone 2", ...]
    }
  ],
  "execution_plan": {
    "today": ["Hour-blocked plan for today's tasks (e.g. '10:00 AM - 11:30 AM: Deep work on task name')"],
    "tomorrow": ["Block plan for tomorrow"],
    "weekly": ["High-level objectives for the next 7 days"],
    "estimated_finish_time": "Estimated date and time when all extracted tasks will be completed",
    "recommended_work_blocks": "Advice on work block sizes (e.g. '25-minute Pomodoros due to high distraction probability' or '90-minute deep blocks')"
  },
  "coaching_advice": {
    "encouragement": "Empathetic advice if the user seems overwhelmed, stressed, or is postponing tasks",
    "alternative_plan": "A backup schedule or plan if they cannot finish on time",
    "micro_tasks": ["Extremely small, zero-friction steps to get started (e.g. 'Open Google Doc' or 'Write 1 bullet point')"]
  }
}

CRITICAL RULES:
1. If the user mentions large goals (e.g. 'Write a history paper'), automatically CHUNK it into 3-10 logical subtasks in the 'subtasks' array.
2. If the user is rescheduling or postponing, prioritize generating a comforting 'coaching_advice' block with 'micro_tasks' to lower friction.
3. If no new tasks, reminders, or goals are mentioned, keep their arrays empty but still generate the 'chat_response', 'execution_plan', and 'coaching_advice' based on user's message.
4. You must compute realistic priority_scores (closer deadlines, higher importance = higher score) and risk_levels (near deadlines or heavy dependencies = high/critical risk).
5. If the user says 'remind me to X in Y minutes' or 'set a reminder for X', extract it into the 'extracted_reminders' array.
6. If the user asks for a reminder but does not specify a time (e.g. 'remind me to study'), extract the reminder with "reminder_time": null. Do NOT omit it from 'extracted_reminders'.
`;

import { AIClient, AIMessage, AIConfig } from "./providers";

/**
 * Runs the autonomous thinking flow using the unified AIClient.
 * Supports text, image, PDF, and voice transcription inputs.
 */
export async function runAutonomousAI(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string | any[] }>,
  provider: "gemini" | "groq" = "gemini",
  fileAttachment?: { base64Data: string; mimeType: string }
): Promise<AutonomousAIOutput> {
  const today = new Date();
  const todayStr = today.toISOString();
  const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);

  // Compile history and instructions
  const systemPrompt = AUTONOMOUS_SYSTEM_PROMPT(todayStr, dayOfWeek);

  const activeMessages: AIMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // If there's an image or PDF attachment, append it as a generative part (multimodal for Gemini)
  if (fileAttachment) {
    const lastMsgIndex = activeMessages.length - 1;
    const lastMsg = activeMessages[lastMsgIndex] || { role: "user", content: "" };
    
    let contentParts: any[] = [];
    if (typeof lastMsg.content === "string") {
      if (lastMsg.content) {
        contentParts.push({ text: lastMsg.content });
      }
    } else if (Array.isArray(lastMsg.content)) {
      contentParts = [...lastMsg.content];
    }

    contentParts.push({
      inlineData: {
        data: fileAttachment.base64Data,
        mimeType: fileAttachment.mimeType,
      },
    });

    activeMessages[lastMsgIndex] = {
      ...lastMsg,
      content: contentParts,
    };
  }

  // Fallback in case of empty text input
  if (activeMessages.length === 0) {
    activeMessages.push({ role: "user", content: "Analyze my current task status and suggest the next actions." });
  }

  const config: AIConfig = {
    provider,
    systemPrompt,
    temperature: 0.2,
    ...(provider === "gemini" ? { responseMimeType: "application/json" } : { jsonMode: true }),
  } as AIConfig;

  const responseText = await AIClient.generateText(activeMessages, config);

  try {
    return JSON.parse(responseText.trim().replace(/```json/gi, "").replace(/```/gi, "").trim());
  } catch (err) {
    console.error("Failed to parse AI JSON output. Raw output was:", responseText);
    throw new Error("AI returned invalid JSON structure");
  }
}

