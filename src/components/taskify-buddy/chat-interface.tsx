"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateId } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { SuggestedPrompts } from "./suggested-prompts";
import { ConversationHistory } from "./conversation-history";
import { PanelLeft, BrainCircuit, Mic } from "lucide-react";
import { VoiceAssistantModal } from "./voice-assistant-modal";

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  metadata?: any; // Structured AutonomousAIOutput
  source?: "web" | "telegram" | "whatsapp" | "discord";
}

/**
 * Robust helper to extract partial "chat_response" from a streaming JSON string.
 * This ensures the user sees the friendly conversational text streaming in real-time,
 * hiding the raw JSON schema.
 */
function extractChatResponse(accumulatedText: string): string {
  const trimmed = accumulatedText.trim();
  
  if (trimmed.startsWith("{")) {
    // 1. Try to match complete "chat_response" key with closing quote
    const match = accumulatedText.match(/"chat_response"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (match && match[1]) {
      return match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }

    // 2. Try to match partial/ongoing "chat_response" key with open quote
    const openMatch = accumulatedText.match(/"chat_response"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)$/);
    if (openMatch && openMatch[1]) {
      return openMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }

    return "Clutch is thinking & organizing your mission...";
  }

  // If the output is somehow plain text, return it directly
  return accumulatedText;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "groq">("groq");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (
    content: string,
    file?: { base64: string; name: string; type: string } | null
  ) => {
    if ((!content.trim() && !file) || isLoading) return;

    // Create user message showing upload tag if present
    const displayContent = content.trim()
      ? content
      : `[Uploaded File: ${file?.name || "Document"}]`;

    const userMsg: LocalMessage = {
      id: generateId(),
      role: "user",
      content: displayContent,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          file: file?.base64 || undefined,
          mimeType: file?.type || undefined,
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Parse streaming conversational text on-the-fly
        const chatText = extractChatResponse(accumulated);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: chatText }
              : m
          )
        );
      }

      // Stream completed. Now parse the final complete JSON
      try {
        const cleaned = accumulated
          .replace(/```json/gi, "")
          .replace(/```/gi, "")
          .trim();
        
        const parsed = JSON.parse(cleaned);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: parsed.chat_response || "Action plan generated!",
                  metadata: parsed,
                  isStreaming: false,
                }
              : m
          )
        );
      } catch (jsonErr) {
        console.error("Error parsing completed autonomous JSON:", jsonErr);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: accumulated.startsWith("{") 
                    ? "Mission processed! View your updated dashboard to see your new plans."
                    : accumulated,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Connection error in ChatInterface:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: "I encountered an error connecting to my AI core. Please check your credentials and try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt, null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation History Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="shrink-0 overflow-hidden"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <ConversationHistory />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Top Bar */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              id="chat-sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                Taskify Buddy
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                </span>
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isLoading ? "Clutch is thinking..." : "Autonomous Companion Active"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice Assistant Trigger */}
            <button
              onClick={() => setShowVoiceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs bg-violet-500/10 border-violet-500/25 text-violet-400 font-bold hover:scale-102 transition-all cursor-pointer"
              type="button"
            >
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              Voice Coach
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
              <span className="font-semibold capitalize text-neutral-300">
                {provider === "groq" ? "Groq (Llama 3.3)" : "Gemini 1.5"} Mode
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <SuggestedPrompts onPromptSelect={handleSuggestedPrompt} />
            ) : (
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                </AnimatePresence>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 pb-4">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              isLoading={isLoading}
              provider={provider}
              onProviderChange={setProvider}
            />
          </div>
        </div>
      </div>

      {/* Voice Assistant Talking Modal */}
      <VoiceAssistantModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
      />
    </div>
  );
}
