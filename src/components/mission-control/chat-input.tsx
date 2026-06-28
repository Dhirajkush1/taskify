"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Paperclip, Loader2, X, FileText, Mail, Calendar, MicOff } from "lucide-react";

interface ChatInputProps {
  onSend: (
    message: string,
    file?: { base64: string; name: string; type: string } | null
  ) => void;
  isLoading: boolean;
  provider: "gemini" | "groq";
  onProviderChange: (provider: "gemini" | "groq") => void;
}

export function ChatInput({
  onSend,
  isLoading,
  provider,
  onProviderChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [fileData, setFileData] = useState<{ base64: string; name: string; type: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && !fileData) || isLoading) return;
    onSend(trimmed, fileData);
    setValue("");
    setFileData(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file uploads (Images & PDF)
  const triggerFileSelect = () => {
    if (provider === "groq") {
      alert("Groq is currently text-only. Please switch to Gemini using the selector pill to upload images and PDFs!");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB. Please upload a smaller image or document.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      setFileData({
        base64: base64String,
        name: file.name,
        type: file.type,
      });
    };
    reader.readAsDataURL(file);
    // Clear input so same file can be selected again
    e.target.value = "";
  };

  // Handle voice speech transcription
  const toggleSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setValue((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Pre-fill templates for Email and Calendar modes
  const selectMode = (type: "email" | "calendar") => {
    if (type === "email") {
      setValue("[Email Mode] Paste your email thread here:\n\n");
    } else {
      setValue("[Calendar Mode] Paste your schedule or .ics events here:\n\n");
    }
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Mode Suggestions Chips */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <button
          onClick={() => selectMode("email")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border hover:bg-white/5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text-muted)",
          }}
        >
          <Mail className="w-3 h-3 text-violet-400" />
          <span>Email mode</span>
        </button>
        <button
          onClick={() => selectMode("calendar")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border hover:bg-white/5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text-muted)",
          }}
        >
          <Calendar className="w-3 h-3 text-emerald-400" />
          <span>Calendar plan</span>
        </button>
      </div>

      {/* Main Input Container */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl overflow-hidden flex flex-col relative"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf"
          className="hidden"
        />

        {/* File Preview Bar */}
        <AnimatePresence>
          {fileData && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 42, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-between px-4 pt-3 shrink-0 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 text-xs truncate max-w-[80%]" style={{ color: "var(--text-primary)" }}>
                <FileText className="w-4.5 h-4.5 text-violet-400 shrink-0" />
                <span className="truncate">{fileData.name}</span>
                <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
                  ({fileData.type.split("/")[1]?.toUpperCase() || "FILE"})
                </span>
              </div>
              <button
                onClick={() => setFileData(null)}
                className="w-5 h-5 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          id="mission-control-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isRecording
              ? "Listening..."
              : "Tell Clutch what you need to do... (Upload a syllabus PDF/Image, paste an email, or type naturally)"
          }
          disabled={isLoading || isRecording}
          rows={1}
          className="w-full px-4 pt-4 pb-2 text-sm resize-none bg-transparent disabled:opacity-50"
          style={{
            color: "var(--text-primary)",
            outline: "none",
            lineHeight: "1.6",
            maxHeight: "160px",
          }}
        />

        {/* Actions bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1.5">
            {/* Attachment */}
            <button
              id="chat-attach-btn"
              onClick={triggerFileSelect}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
              style={{
                color: provider === "groq" ? "var(--text-disabled)" : "var(--text-muted)",
              }}
              title={provider === "groq" ? "Switch to Gemini to upload files" : "Attach image or PDF"}
              type="button"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Dictation */}
            <button
              id="chat-voice-btn"
              onClick={toggleSpeech}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isRecording ? "bg-red-500/20 text-red-400 animate-pulse" : "hover:bg-white/5"
              }`}
              style={{ color: isRecording ? undefined : "var(--text-muted)" }}
              title={isRecording ? "Stop listening" : "Voice dictation"}
              type="button"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Model Switcher Pill */}
            <div
              className="flex items-center gap-0.5 ml-2 p-0.5 rounded-lg border shrink-0"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <button
                id="model-select-groq"
                type="button"
                onClick={() => onProviderChange("groq")}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  provider === "groq"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-350"
                }`}
                title="Use Groq Llama-3.3-70b (Active Key)"
              >
                Groq (Llama)
              </button>
              <button
                id="model-select-gemini"
                type="button"
                onClick={() => onProviderChange("gemini")}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  provider === "gemini"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-350"
                }`}
                title="Use Gemini 1.5 Flash"
              >
                Gemini
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:inline" style={{ color: "var(--text-disabled)" }}>
              {value.length > 0 ? `${value.length} chars` : "Enter to send · Shift+Enter for newline"}
            </span>

            <motion.button
              id="chat-send-btn"
              whileHover={!isLoading && (value.trim() || fileData) ? { scale: 1.05 } : {}}
              whileTap={!isLoading && (value.trim() || fileData) ? { scale: 0.95 } : {}}
              onClick={handleSend}
              disabled={isLoading || (!value.trim() && !fileData)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: (value.trim() || fileData) && !isLoading ? "var(--primary)" : "var(--surface-overlay)",
                color: (value.trim() || fileData) && !isLoading ? "white" : "var(--text-muted)",
              }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
