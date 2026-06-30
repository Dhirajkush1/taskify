"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Pencil,
  Trash2,
  Archive,
  Clock,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  ShieldAlert,
  BellRing
} from "lucide-react";
import type { Task } from "@/types/app.types";
import { PRIORITY_CONFIG, RISK_CONFIG } from "@/types/app.types";
import { formatDeadline, formatDuration, isOverdue } from "@/lib/utils";
import { useCompleteTask, useDeleteTask, useArchiveTask } from "@/hooks/use-tasks";
import { createClient } from "@/lib/supabase/client";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const archiveTask = useArchiveTask();

  const [isExpanded, setIsExpanded] = useState(false);
  const [reminder, setReminder] = useState<any>(null);

  const supabase = createClient();

  const priority = PRIORITY_CONFIG[task.priority];
  const risk = RISK_CONFIG[task.risk_level];
  const overdue = isOverdue(task.deadline);
  const isDone = task.status === "done";

  // Fetch task reminder status dynamically
  useEffect(() => {
    const fetchReminder = async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("status, reminder_time")
        .eq("task_id", task.id)
        .maybeSingle();
      if (!error && data) {
        setReminder(data);
      }
    };
    fetchReminder();
  }, [task.id, supabase]);

  const priorityDotColor =
    task.priority === "critical" ? "oklch(0.65 0.22 27)"
    : task.priority === "high" ? "oklch(0.75 0.18 60)"
    : task.priority === "medium" ? "oklch(0.75 0.18 60)"
    : "oklch(0.70 0.18 152)";

  const riskColor =
    task.risk_level === "critical" ? "var(--danger)"
    : task.risk_level === "high" ? "oklch(0.75 0.18 60)"
    : task.risk_level === "medium" ? "oklch(0.75 0.18 60)"
    : "var(--accent)";

  // Map reminder status to display values
  const getReminderStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Waiting";
      case "scheduled": return "Scheduled";
      case "sending": return "Sending...";
      case "sent": return "Sent";
      case "completed": return "Completed";
      case "failed": return "Failed";
      case "skipped": return "Skipped";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getReminderStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "sent":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
      case "failed":
        return "text-red-400 bg-red-500/10 border-red-500/25";
      case "sending":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/25 animate-pulse";
      default:
        return "text-blue-400 bg-blue-500/10 border-blue-500/25";
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -1 }}
      onClick={() => setIsExpanded(!isExpanded)}
      className="p-4 rounded-2xl group relative overflow-hidden cursor-pointer transition-all hover:bg-neutral-850"
      style={{
        background: "var(--surface)",
        border: `1px solid ${overdue && !isDone ? "oklch(0.65 0.22 27 / 0.3)" : "var(--border)"}`,
        opacity: isDone ? 0.7 : 1,
      }}
    >
      {/* Overdue indicator strip */}
      {overdue && !isDone && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: "var(--danger)" }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Complete button */}
        <button
          id={`complete-task-${task.id}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDone) completeTask.mutate(task.id);
          }}
          disabled={isDone || completeTask.isPending}
          className="mt-0.5 shrink-0 transition-all hover:scale-110 disabled:cursor-default"
        >
          <CheckCircle2
            className="w-5 h-5"
            style={{ color: isDone ? "var(--accent)" : "var(--border-strong)" }}
          />
        </button>

        {/* Content - Collapsed View */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className="text-sm font-medium mb-1 truncate text-left"
              style={{
                color: "var(--text-primary)",
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {task.title}
            </p>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>

          {/* Meta row - Collapsed */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {/* Priority Badge */}
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "var(--surface-overlay)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityDotColor }} />
              {priority.label}
            </span>

            {/* Deadline */}
            {task.deadline && (
              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: overdue && !isDone ? "var(--danger)" : "var(--text-muted)" }}
              >
                {overdue && !isDone ? (
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                ) : (
                  <Calendar className="w-3 h-3 text-neutral-400" />
                )}
                {formatDeadline(task.deadline)}
              </span>
            )}
          </div>
        </div>

        {/* Progress ring */}
        <div className="shrink-0 relative w-9 h-9">
          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" strokeWidth="2.5" stroke="var(--border)" />
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              strokeWidth="2.5"
              stroke={isDone ? "var(--accent)" : "var(--primary)"}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 14}`}
              strokeDashoffset={`${2 * Math.PI * 14 * (1 - task.completion_percentage / 100)}`}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
            style={{ color: "var(--text-muted)" }}
          >
            {task.completion_percentage}%
          </span>
        </div>
      </div>

      {/* Expanded Details Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pt-3 border-t overflow-hidden space-y-3"
            style={{ borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()} // Prevent collapse when clicking details content
          >
            {task.description && (
              <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800 text-left">
                {task.description}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Category */}
              <div className="flex items-center gap-2 text-neutral-400">
                <Tag className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                <span>Category: <strong className="text-neutral-200">{(task as any).category || "Personal"}</strong></span>
              </div>

              {/* Estimated Duration */}
              {task.estimated_duration && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span>Duration: <strong className="text-neutral-200">{formatDuration(task.estimated_duration)}</strong></span>
                </div>
              )}

              {/* Risk Level */}
              <div className="flex items-center gap-2 text-neutral-400">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                <span className="flex items-center gap-1">
                  Risk: <strong className={task.risk_level === "critical" ? "text-red-400" : "text-neutral-200"}>{risk.label}</strong>
                </span>
              </div>

              {/* Associated Reminder Status */}
              {reminder && (
                <div className="flex items-center gap-2 text-neutral-400 col-span-2 mt-1">
                  <BellRing className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-swing" />
                  <span className="flex items-center gap-2">
                    Reminder:
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getReminderStatusColor(reminder.status)}`}>
                      {getReminderStatusLabel(reminder.status)} ({formatDeadline(reminder.reminder_time)})
                    </span>
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons — visible on hover */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          id={`edit-task-${task.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all"
          style={{ color: "var(--text-muted)" }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {task.status !== "archived" && (
          <button
            id={`archive-task-${task.id}`}
            onClick={(e) => {
              e.stopPropagation();
              archiveTask.mutate(task.id);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          id={`delete-task-${task.id}`}
          onClick={(e) => {
            e.stopPropagation();
            deleteTask.mutate(task.id);
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-all"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
