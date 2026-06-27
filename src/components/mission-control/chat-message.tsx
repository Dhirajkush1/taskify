"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Brain,
  Shield,
  CalendarDays,
  ListTodo,
  TrendingUp,
  Send,
} from "lucide-react";
import type { LocalMessage } from "./chat-interface";

interface ChatMessageProps {
  message: LocalMessage;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-5 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--primary)" }}
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const metadata = message.metadata; // Our AutonomousAIOutput parsed object
  const [completedSubtasks, setCompletedSubtasks] = useState<Record<string, boolean>>({});

  const toggleSubtask = (taskId: string, subtaskIndex: number) => {
    const key = `${taskId}-${subtaskIndex}`;
    setCompletedSubtasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Helper to format deadline
  const formatIsoDeadline = (isoString: string | null) => {
    if (!isoString) return "No deadline";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Helper to get priority details
  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "critical":
        return { bg: "bg-red-500/10 border-red-500/30 text-red-400", label: "🔴 Critical" };
      case "high":
        return { bg: "bg-orange-500/10 border-orange-500/30 text-orange-400", label: "🟠 High" };
      case "medium":
        return { bg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", label: "🟡 Medium" };
      default:
        return { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", label: "🟢 Low" };
    }
  };

  // Helper to get risk badge
  const getRiskBadge = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 w-full ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: isUser ? "var(--surface-raised)" : "linear-gradient(135deg, var(--primary), oklch(0.65 0.22 230))",
          border: isUser ? "1px solid var(--border)" : "none",
        }}
      >
        {isUser ? (
          <User className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1 w-full`}>
        {/* Source Badge */}
        {message.source && message.source !== "web" && (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold flex items-center gap-1 mb-0.5 select-none">
            <Send className="w-2.5 h-2.5 rotate-45" /> Telegram
          </span>
        )}

        {/* Main text bubble */}
        <div
          className="px-4 py-3 rounded-2xl w-fit"
          style={
            isUser
              ? {
                  background: "var(--primary)",
                  color: "white",
                  borderRadius: "18px 4px 18px 18px",
                }
              : {
                  background: "var(--surface-raised)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px 18px 18px 18px",
                }
          }
        >
          {message.isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <div
              className="text-sm leading-relaxed prose-sm max-w-none"
              style={isUser ? { color: "white" } : { color: "var(--text-primary)" }}
            >
              {isUser ? (
                <p style={{ margin: 0 }}>{message.content}</p>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0" style={{ color: "var(--text-primary)", margin: "0 0 0.5rem" }}>
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{children}</strong>
                    ),
                    code: ({ children }) => (
                      <code
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{ background: "var(--surface-overlay)", color: "var(--primary)", fontFamily: "monospace" }}
                      >
                        {children}
                      </code>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 my-2" style={{ color: "var(--text-secondary)" }}>
                        {children}
                      </ul>
                    ),
                    li: ({ children }) => (
                      <li style={{ color: "var(--text-secondary)" }}>{children}</li>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
              {message.isStreaming && message.content && (
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </div>
          )}
        </div>

        {/* Structured Autonomous Widgets (Only if metadata is parsed and present) */}
        {!isUser && metadata && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full flex flex-col gap-4 max-w-3xl"
          >
            {/* 1. EXTRACTED TASKS & CHUNKING */}
            {metadata.extracted_tasks && metadata.extracted_tasks.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Autonomous Actions Extracted ({metadata.extracted_tasks.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {metadata.extracted_tasks.map((task: any, idx: number) => {
                    const priority = getPriorityBadge(task.priority);
                    const riskClass = getRiskBadge(task.risk_level);

                    return (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -2 }}
                        className="rounded-xl p-4 border flex flex-col gap-3.5"
                        style={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {/* Task Title & Badges */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                              {task.title}
                            </h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${priority.bg}`}>
                              {priority.label}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Metrics Panel */}
                        <div className="grid grid-cols-3 gap-2 border-y py-2.5 my-0.5" style={{ borderColor: "var(--border)" }}>
                          <div className="flex flex-col items-center justify-center border-r" style={{ borderColor: "var(--border)" }}>
                            <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>PRIORITY SCORE</span>
                            <span className="text-sm font-bold text-violet-400">{task.priority_score || 0}%</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border-r" style={{ borderColor: "var(--border)" }}>
                            <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>RISK LEVEL</span>
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${riskClass}`}>
                              {task.risk_level || "low"}
                            </span>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>COMPLETION PROB.</span>
                            <span className="text-sm font-bold text-emerald-400">{task.completion_probability || 100}%</span>
                          </div>
                        </div>

                        {/* Details Block (Deadline, Duration, Deps) */}
                        <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-orange-400" />
                            <span>Deadline: {formatIsoDeadline(task.deadline)}</span>
                          </div>
                          {task.estimated_duration && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-violet-400" />
                              <span>Effort: {Math.round(task.estimated_duration)} minutes</span>
                            </div>
                          )}
                          {task.dependencies && task.dependencies.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate">Depends on: {task.dependencies.join(", ")}</span>
                            </div>
                          )}
                        </div>

                        {/* Chunked Subtasks */}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="flex flex-col gap-2 mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                              Chunked Action Subtasks ({task.subtasks.length})
                            </span>
                            <div className="flex flex-col gap-1.5">
                              {task.subtasks.map((sub: string, subIdx: number) => {
                                const isCompleted = !!completedSubtasks[`${task.title}-${subIdx}`];
                                return (
                                  <button
                                    key={subIdx}
                                    onClick={() => toggleSubtask(task.title, subIdx)}
                                    className="flex items-start gap-2 text-left text-xs transition-all hover:opacity-80 w-full group"
                                  >
                                    <span className="mt-0.5 shrink-0">
                                      <CheckCircle2
                                        className={`w-3.5 h-3.5 transition-all ${
                                          isCompleted ? "text-emerald-400 fill-emerald-500/10" : "text-neutral-600 group-hover:text-neutral-400"
                                        }`}
                                      />
                                    </span>
                                    <span
                                      className={`leading-normal transition-all ${
                                        isCompleted ? "line-through text-neutral-600" : "text-neutral-300"
                                      }`}
                                    >
                                      {sub}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Missing Information Callout */}
                        {task.missing_information && (
                          <div
                            className="p-2.5 rounded-lg border flex items-start gap-2 text-xs text-amber-300 bg-amber-500/5 mt-1"
                            style={{ borderColor: "var(--warning)/20" }}
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              <strong>Missing details:</strong> {task.missing_information}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. AI EXECUTION PLAN WIDGET */}
            {metadata.execution_plan && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Autonomous Execution Plan
                  </span>
                </div>

                <div
                  className="rounded-xl p-4 border flex flex-col gap-3.5"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Today */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-emerald-400 tracking-wider">TODAY&apos;S MISSION</span>
                      {metadata.execution_plan.today && metadata.execution_plan.today.length > 0 ? (
                        <ul className="flex flex-col gap-1.5 text-xs text-neutral-300">
                          {metadata.execution_plan.today.map((block: string, bIdx: number) => (
                            <li key={bIdx} className="bg-white/5 px-2 py-1.5 rounded border border-white/5 leading-relaxed">
                              {block}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs italic text-neutral-500">No scheduled blocks today.</span>
                      )}
                    </div>

                    {/* Tomorrow */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-violet-400 tracking-wider">TOMORROW&apos;S PLAN</span>
                      {metadata.execution_plan.tomorrow && metadata.execution_plan.tomorrow.length > 0 ? (
                        <ul className="flex flex-col gap-1.5 text-xs text-neutral-300">
                          {metadata.execution_plan.tomorrow.map((block: string, bIdx: number) => (
                            <li key={bIdx} className="bg-white/5 px-2 py-1.5 rounded border border-white/5 leading-relaxed">
                              {block}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs italic text-neutral-500">No scheduled blocks tomorrow.</span>
                      )}
                    </div>

                    {/* Weekly */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-orange-400 tracking-wider">WEEKLY OBJECTIVES</span>
                      {metadata.execution_plan.weekly && metadata.execution_plan.weekly.length > 0 ? (
                        <ul className="flex flex-col gap-1.5 text-xs text-neutral-300">
                          {metadata.execution_plan.weekly.map((block: string, bIdx: number) => (
                            <li key={bIdx} className="bg-white/5 px-2 py-1.5 rounded border border-white/5 leading-relaxed">
                              {block}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs italic text-neutral-500">No high-level goals this week.</span>
                      )}
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>
                        Estimated Completion: <strong className="text-neutral-200">{metadata.execution_plan.estimated_finish_time || "Calculated soon"}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Optimal Block: <strong className="text-neutral-200">{metadata.execution_plan.recommended_work_blocks || "Standard 45-min"}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SMART COACH PANEL */}
            {metadata.coaching_advice && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Brain className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Clutch Smart Coach
                  </span>
                </div>

                <div
                  className="rounded-xl p-4 border flex flex-col gap-3 bg-amber-500/5"
                  style={{
                    borderColor: "rgba(245, 158, 11, 0.2)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <p className="text-xs italic leading-relaxed text-amber-200">
                    &quot;{metadata.coaching_advice.encouragement}&quot;
                  </p>
                  {metadata.coaching_advice.micro_tasks && metadata.coaching_advice.micro_tasks.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "rgba(245, 158, 11, 0.1)" }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                        Zero Friction Micro-wins (Get started in under 2 minutes)
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {metadata.coaching_advice.micro_tasks.map((micro: string, mIdx: number) => {
                          const key = `micro-${mIdx}`;
                          const isCompleted = !!completedSubtasks[key];
                          return (
                            <button
                              key={mIdx}
                              onClick={() => toggleSubtask("micro", mIdx)}
                              className="flex items-start gap-2 text-left text-xs transition-all hover:opacity-80 w-full group"
                            >
                              <span className="mt-0.5 shrink-0">
                                <CheckCircle2
                                  className={`w-3.5 h-3.5 transition-all ${
                                    isCompleted ? "text-amber-400 fill-amber-500/10" : "text-amber-600/60 group-hover:text-amber-400"
                                  }`}
                                />
                              </span>
                              <span className={`leading-normal ${isCompleted ? "line-through text-amber-500/60" : "text-amber-300"}`}>
                                {micro}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
