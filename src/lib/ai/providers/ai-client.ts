import { AIConfig, AIMessage } from "./types";
import { GeminiAdapter } from "./gemini-adapter";
import { GroqAdapter } from "./groq-adapter";

export class AIClient {
  private static getAdapter(provider: "gemini" | "groq") {
    if (provider === "gemini") {
      return new GeminiAdapter();
    } else if (provider === "groq") {
      return new GroqAdapter();
    }
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  static async generateText(messages: AIMessage[], config: AIConfig): Promise<string> {
    const activeConfig = this.resolveConfig(config);
    const adapter = this.getAdapter(activeConfig.provider);
    return adapter.generateText(messages, activeConfig);
  }

  static async *streamText(messages: AIMessage[], config: AIConfig): AsyncGenerator<string, void, unknown> {
    const activeConfig = this.resolveConfig(config);
    const adapter = this.getAdapter(activeConfig.provider);
    yield* adapter.streamText(messages, activeConfig);
  }

  private static resolveConfig(config: AIConfig): AIConfig {
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Fallback to Groq if Gemini key is missing/invalid
    if (config.provider === "gemini" && (!geminiKey || geminiKey.startsWith("AQ."))) {
      if (groqKey) {
        console.warn("[AIClient] Gemini API key is missing or invalid. Falling back to Groq Llama 3.3.");
        return {
          ...config,
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          jsonMode: true,
        } as AIConfig;
      }
    }

    // Fallback to Gemini if Groq key is missing
    if (config.provider === "groq" && !groqKey) {
      if (geminiKey && !geminiKey.startsWith("AQ.")) {
        console.warn("[AIClient] Groq API key is missing. Falling back to Gemini 1.5 Flash.");
        return {
          ...config,
          provider: "gemini",
          model: "gemini-1.5-flash",
          responseMimeType: "application/json",
        } as AIConfig;
      }
    }

    return config;
  }
}
