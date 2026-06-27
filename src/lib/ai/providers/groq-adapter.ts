import { AIProviderAdapter, AIMessage, AIConfig } from "./types";

export class GroqAdapter implements AIProviderAdapter {
  private getApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY");
    }
    return apiKey;
  }

  private mapMessages(messages: AIMessage[], systemPrompt?: string) {
    const mapped: any[] = [];
    
    // Prepend system prompt if provided
    if (systemPrompt) {
      mapped.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "system") {
        // If system prompt is inside messages array and was not already handled
        if (!systemPrompt) {
          mapped.push({ role: "system", content: msg.content as string });
        }
        continue;
      }
      
      const role = msg.role === "assistant" ? "assistant" : "user";
      let content = "";
      
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .map((part) => part.text || "")
          .join(" ")
          .trim();
      }
      
      mapped.push({ role, content });
    }

    return mapped;
  }

  async generateText(messages: AIMessage[], config: AIConfig): Promise<string> {
    const apiKey = this.getApiKey();
    const systemPrompt = config.systemPrompt || messages.find((m) => m.role === "system")?.content as string | undefined;

    const payload: any = {
      model: config.model || "llama-3.3-70b-versatile",
      temperature: config.temperature ?? 0.2,
      messages: this.mapMessages(messages, systemPrompt),
    };

    if (config.maxTokens) {
      payload.max_tokens = config.maxTokens;
    }

    if (config.provider === "groq" && config.jsonMode !== false) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "{}";
  }

  async *streamText(messages: AIMessage[], config: AIConfig): AsyncGenerator<string, void, unknown> {
    const apiKey = this.getApiKey();
    const systemPrompt = config.systemPrompt || messages.find((m) => m.role === "system")?.content as string | undefined;

    const payload: any = {
      model: config.model || "llama-3.3-70b-versatile",
      temperature: config.temperature ?? 0.2,
      messages: this.mapMessages(messages, systemPrompt),
      stream: true,
    };

    if (config.maxTokens) {
      payload.max_tokens = config.maxTokens;
    }

    if (config.provider === "groq" && config.jsonMode !== false) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to read stream from Groq.");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
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
    } finally {
      reader.releaseLock();
    }
  }
}
