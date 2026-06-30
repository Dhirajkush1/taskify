"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const PROMPTS = [
  {
    emoji: "📚",
    title: "Plan my study sessions",
    text: "I have 3 exams next week: Math on Monday, History on Wednesday, and Chemistry on Friday. Help me plan my study schedule.",
  },
  {
    emoji: "💼",
    title: "Manage work deadlines",
    text: "I need to finish the Q3 report by Thursday, prepare a client presentation by Friday, and review 5 PRs before end of week.",
  },
  {
    emoji: "🏠",
    title: "Tackle personal tasks",
    text: "I need to pay rent by the 1st, schedule a dentist appointment, and fix the bathroom sink before my guests arrive Saturday.",
  },
  {
    emoji: "🚀",
    title: "Launch project checklist",
    text: "My app launches in 2 weeks. I still need to write documentation, set up CI/CD, design the landing page, and prepare marketing emails.",
  },
];

interface SuggestedPromptsProps {
  onPromptSelect: (text: string) => void;
}

export function SuggestedPrompts({ onPromptSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-col items-center text-center py-8">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 animate-pulse-glow"
        style={{
          background: "linear-gradient(135deg, var(--primary), oklch(0.65 0.22 230))",
        }}
      >
        <Sparkles className="w-8 h-8 text-white" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xl font-bold mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        Taskify Buddy
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-sm max-w-sm mb-10"
        style={{ color: "var(--text-muted)" }}
      >
        Tell me what you need to get done — I&apos;ll extract your tasks, set
        priorities, and build your mission plan.
      </motion.p>

      {/* Prompt chips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
        {PROMPTS.map(({ emoji, title, text }, i) => (
          <motion.button
            key={title}
            id={`suggested-prompt-${i}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.07 }}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPromptSelect(text)}
            className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="text-xl">{emoji}</span>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {text.slice(0, 72)}...
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
