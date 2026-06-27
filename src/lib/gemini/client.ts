import { GoogleGenerativeAI } from "@google/generative-ai";
import { AUTONOMOUS_SYSTEM_PROMPT } from "@/lib/ai/ai-service";

export interface GeminiMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

export interface GeminiConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// Initialize the Gemini SDK if the API key is present
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Streams chat responses from Groq (Llama 3.3).
 */
export async function* streamGroqChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  config?: GeminiConfig
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    yield "Error: GROQ_API_KEY is not configured in your environment variables.";
    return;
  }

  try {
    const today = new Date();
    const todayStr = today.toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);
    const defaultPrompt = AUTONOMOUS_SYSTEM_PROMPT(todayStr, dayOfWeek);
    const systemPrompt = config?.systemInstruction || defaultPrompt;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      yield `Error: Groq API returned status ${response.status}. ${err}`;
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield "Error: Failed to read stream from Groq.";
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleaned = line.replace(/^data: /, "").trim();
        if (cleaned === "" || cleaned === "[DONE]") continue;

        try {
          const parsed = JSON.parse(cleaned);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // ignore parsing issues for individual SSE lines
        }
      }
    }
  } catch (error: any) {
    yield `Error: ${error?.message || "Connection failed"}`;
  }
}

/**
 * Extracts structured tasks from natural language text using Groq (JSON Mode).
 */
export async function extractTasksWithGroq(text: string): Promise<
  Array<{
    title: string;
    description?: string;
    deadline?: string | null;
    priority: "critical" | "high" | "medium" | "low";
    estimated_duration?: number | null;
    risk_level: "low" | "medium" | "high" | "critical";
  }>
> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("Groq API key missing for task extraction.");
    return [];
  }

  try {
    const todayStr = new Date().toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a precise task extraction engine. 
Analyze the user's input text and extract all tasks, chores, assignments, exams, or meetings mentioned.
Today's date and time is: ${todayStr} (which is a ${dayOfWeek}). Use this to calculate exact relative deadlines (like "tomorrow", "Friday", "next Monday").

You MUST respond with a JSON object containing a "tasks" array.
Each task in the array must be an object matching this structure:
{
  "title": "Actionable task name (string)",
  "description": "Brief context or course details (string)",
  "deadline": "ISO 8601 string of the calculated deadline, or null if none",
  "priority": "critical" | "high" | "medium" | "low",
  "estimated_duration": estimated completion minutes (integer) or null,
  "risk_level": "low" | "medium" | "high" | "critical"
}

Respond ONLY with valid JSON. Do not include markdown wraps or extra explanation.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq task extraction failed with status: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawContent);

    if (parsed && Array.isArray(parsed.tasks)) {
      return parsed.tasks.map((t: any) => ({
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
    console.error("Error in extractTasksWithGroq:", error);
    return [];
  }
}

/**
 * Streams the chat conversation, routing to either Gemini or Groq.
 */
export async function* streamGeminiChat(
  messages: GeminiMessage[],
  config?: GeminiConfig & { provider?: "gemini" | "groq" }
): AsyncGenerator<string> {
  const provider = config?.provider || "gemini";

  if (provider === "groq") {
    const openAIMessages = messages.map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.parts[0].text,
    }));
    yield* streamGroqChat(openAIMessages);
    return;
  }

  // Gemini Execution
  const genAI = getGenAI();
  if (!genAI) {
    yield `I encountered an issue connecting to my Gemini AI core. It looks like a valid Gemini API Key starting with 'AIzaSy' is missing. Please switch to 'Groq' at the bottom to continue, or add a valid Gemini key to .env.local!`;
    return;
  }

  try {
    const modelName = config?.model || "gemini-1.5-flash";
    const today = new Date();
    const todayStr = today.toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);
    const systemPrompt = AUTONOMOUS_SYSTEM_PROMPT(todayStr, dayOfWeek);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role,
      parts: msg.parts,
    }));

    const chat = model.startChat({
      history,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: config?.maxOutputTokens,
      },
    });

    const lastMessageText = messages[messages.length - 1]?.parts[0]?.text || "";
    const result = await chat.sendMessageStream(lastMessageText);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error: any) {
    console.error("Error in streamGeminiChat:", error);
    yield `I encountered an issue connecting to my Gemini AI core: ${error?.message || error}. Please verify your key or switch to Groq at the bottom.`;
  }
}

/**
 * Extracts structured tasks from natural language text using either Gemini or Groq.
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
  if (provider === "groq") {
    return extractTasksWithGroq(text);
  }

  // Gemini Execution
  const genAI = getGenAI();
  if (!genAI) {
    console.warn("Gemini AI not initialized for task extraction.");
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const todayStr = new Date().toISOString();
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

    const prompt = `You are a precise task extraction engine. 
Analyze the following natural language text and extract all tasks, chores, projects, assignments, exams, or meetings mentioned.
Today's date and time is: ${todayStr} (which is a ${dayOfWeek}). Use this to calculate exact relative deadlines (for example, "tomorrow", "Friday", "next Monday").

For each extracted task, output a JSON object with:
1. "title": Short, actionable name of the task
2. "description": Brief context, details, or course name
3. "deadline": ISO 8601 string of the deadline (calculate the date based on today being ${todayStr}), or null if none
4. "priority": One of "critical", "high", "medium", "low" (based on how urgent/important it sounds)
5. "estimated_duration": Estimated minutes to complete (or null)
6. "risk_level": One of "low", "medium", "high", "critical" (high/critical if the deadline is very close or important)

Respond ONLY with a valid JSON array of these objects. Do not include any markdown formatting, backticks, or extra text. If no tasks are found, return an empty array [].

Text to analyze:
"${text}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const cleanedJson = responseText
      .replace(/```json/gi, "")
      .replace(/```/gi, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);
    if (Array.isArray(parsed)) {
      return parsed.map((t) => ({
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
