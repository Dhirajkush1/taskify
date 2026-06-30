import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProviderAdapter, AIMessage, AIConfig } from "./types";

export class GeminiAdapter implements AIProviderAdapter {
  private getGenAI(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith("AQ.")) {
      throw new Error("Invalid or missing GEMINI_API_KEY");
    }
    return new GoogleGenerativeAI(apiKey);
  }

  private mapMessages(messages: AIMessage[]) {
    // Exclude system message from contents, as it is passed via systemInstruction
    const chatMessages = messages.filter((msg) => msg.role !== "system");
    
    return chatMessages.map((msg) => {
      const role = msg.role === "assistant" ? "model" : "user";
      let parts: any[] = [];
      if (typeof msg.content === "string") {
        parts = [{ text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        parts = msg.content;
      }
      return { role, parts };
    });
  }

  async generateText(messages: AIMessage[], config: AIConfig): Promise<string> {
    const genAI = this.getGenAI();
    const systemPrompt = config.systemPrompt || messages.find((m) => m.role === "system")?.content as string | undefined;
    
    const model = genAI.getGenerativeModel({
      model: config.model || "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    const contents = this.mapMessages(messages);

    const generationConfig: any = {
      temperature: config.temperature ?? 0.2,
    };

    if (config.maxTokens) {
      generationConfig.maxOutputTokens = config.maxTokens;
    }

    if (config.provider === "gemini" && config.responseMimeType) {
      generationConfig.responseMimeType = config.responseMimeType;
    }

    const result = await model.generateContent({
      contents,
      generationConfig,
    });

    return result.response.text();
  }

  async *streamText(messages: AIMessage[], config: AIConfig): AsyncGenerator<string, void, unknown> {
    const genAI = this.getGenAI();
    const systemPrompt = config.systemPrompt || messages.find((m) => m.role === "system")?.content as string | undefined;

    const model = genAI.getGenerativeModel({
      model: config.model || "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    const contents = this.mapMessages(messages);

    const generationConfig: any = {
      temperature: config.temperature ?? 0.2,
    };

    if (config.maxTokens) {
      generationConfig.maxOutputTokens = config.maxTokens;
    }

    if (config.provider === "gemini" && config.responseMimeType) {
      generationConfig.responseMimeType = config.responseMimeType;
    }

    const result = await model.generateContentStream({
      contents,
      generationConfig,
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  }
}
