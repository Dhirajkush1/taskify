import { AIClient, AIConfig, AIMessage } from "@/lib/ai/providers";

export interface GeminiMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

export interface GeminiConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  provider?: "gemini" | "groq";
}

/**
 * Streams chat responses. Routes to either Gemini or Groq adapter via unified AIClient.
 */
export async function* streamGeminiChat(
  messages: GeminiMessage[],
  config?: GeminiConfig
): AsyncGenerator<string> {
  const provider = config?.provider || "gemini";
  const systemPrompt = config?.systemInstruction;

  const mappedMessages: AIMessage[] = messages.map((m) => ({
    role: m.role === "model" ? ("assistant" as const) : ("user" as const),
    content: m.parts[0]?.text || "",
  }));

  const aiConfig: AIConfig = {
    provider,
    model: config?.model,
    temperature: config?.temperature,
    maxTokens: config?.maxOutputTokens,
    systemPrompt,
  } as AIConfig;

  try {
    yield* AIClient.streamText(mappedMessages, aiConfig);
  } catch (error: any) {
    console.error("Error in streamGeminiChat:", error);
    yield `I encountered an issue connecting to my AI core: ${error?.message || error}.`;
  }
}

/**
 * Extracts structured tasks from natural language text using unified AIClient.
 */
export async function extractTasksFromText(
  text: string,
  provider: "gemini" | "groq" = "gemini"
): Promise<
  Array<{
    title: string;
    description?: string;
    deadline?: string | null;
    priority: "critical" | "high" | "medium" | "low";
    estimated_duration?: number | null;
    risk_level: "low" | "medium" | "high" | "critical";
  }>
> {
  try {
    const todayStr = new Date().toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

    const systemPrompt = `You are a precise task extraction engine. 
Analyze the following natural language text and extract all tasks, chores, projects, assignments, exams, or meetings mentioned.
Today's date and time is: ${todayStr} (which is a ${dayOfWeek}). Use this to calculate exact relative deadlines (for example, "tomorrow", "Friday", "next Monday").

For each extracted task, output a JSON object with:
1. "title": Short, actionable name of the task
2. "description": Brief context, details, or course name
3. "deadline": ISO 8601 string of the deadline (calculate the date based on today being ${todayStr}), or null if none
4. "priority": One of "critical", "high", "medium", "low" (based on how urgent/important it sounds)
5. "estimated_duration": Estimated minutes to complete (or null)
6. "risk_level": One of "low", "medium", "high", "critical" (high/critical if the deadline is very close or important)

Respond ONLY with a valid JSON array of these objects. Do not include any markdown formatting, backticks, or extra text. If no tasks are found, return an empty array [].`;

    const aiConfig: AIConfig = {
      provider,
      systemPrompt,
      temperature: 0.1,
      ...(provider === "gemini" ? { responseMimeType: "application/json" } : { jsonMode: true }),
    } as AIConfig;

    const responseText = await AIClient.generateText(
      [{ role: "user", content: text }],
      aiConfig
    );

    const cleanedJson = responseText
      .replace(/```json/gi, "")
      .replace(/```/gi, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const tasksArray = Array.isArray(parsed) ? parsed : (parsed.tasks || []);

    if (Array.isArray(tasksArray)) {
      return tasksArray.map((t: any) => ({
        title: t.title || "Untitled Task",
        description: t.description || "",
        deadline: t.deadline || null,
        priority: ["critical", "high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
        estimated_duration: typeof t.estimated_duration === "number" ? t.estimated_duration : null,
        risk_level: ["low", "medium", "high", "critical"].includes(t.risk_level) ? t.risk_level : "low",
      }));
    }

    return [];
  } catch (error) {
    console.error("Error in extractTasksFromText:", error);
    return [];
  }
}
