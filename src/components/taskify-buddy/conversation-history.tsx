"use client";

import { motion } from "framer-motion";
import { MessageSquare, Plus } from "lucide-react";

// Placeholder conversation history — will be wired to Supabase in production
const PLACEHOLDER_CONVOS = [
  { id: "1", title: "Study plan for finals", time: "2h ago" },
  { id: "2", title: "Work deadlines this week", time: "Yesterday" },
  { id: "3", title: "Project launch checklist", time: "3 days ago" },
];

export function ConversationHistory() {
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--surface)" }}>
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          History
        </p>
        <button
          id="new-conversation-btn"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {PLACEHOLDER_CONVOS.map(({ id, title, time }, i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left mb-1 transition-all hover:bg-white/5"
          >
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                {title}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {time}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
