export interface BaseAIConfig {
  provider: "gemini" | "groq";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeout?: number;
  stream?: boolean;
  retry?: number;
}

export interface GeminiConfig extends BaseAIConfig {
  provider: "gemini";
  responseMimeType?: string;
}

export interface GroqConfig extends BaseAIConfig {
  provider: "groq";
  jsonMode?: boolean;
}

export type AIConfig = GeminiConfig | GroqConfig;

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string | any[]; // content can be string or Gemini-like parts array
}

export interface AIProviderAdapter {
  generateText(messages: AIMessage[], config: AIConfig): Promise<string>;
  streamText(messages: AIMessage[], config: AIConfig): AsyncGenerator<string, void, unknown>;
}
