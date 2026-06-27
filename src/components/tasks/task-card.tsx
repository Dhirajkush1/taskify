"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Pencil,
  Trash2,
  Archive,
  Clock,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { Task } from "@/types/app.types";
import { PRIORITY_CONFIG, RISK_CONFIG } from "@/types/app.types";
import { formatDeadline, formatDuration, isOverdue } from "@/lib/utils";
import { useCompleteTask, useDeleteTask, useArchiveTask } from "@/hooks/use-tasks";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const archiveTask = useArchiveTask();

  const priority = PRIORITY_CONFIG[task.priority];
  const risk = RISK_CONFIG[task.risk_level];
  const overdue = isOverdue(task.deadline);
  const isDone = task.status === "done";

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
      className="p-4 rounded-2xl group relative overflow-hidden"
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
          onClick={() => !isDone && completeTask.mutate(task.id)}
          disabled={isDone || completeTask.isPending}
          className="mt-0.5 shrink-0 transition-all hover:scale-110 disabled:cursor-default"
        >
          <CheckCircle2
            className="w-5 h-5"
            style={{ color: isDone ? "var(--accent)" : "var(--border-strong)" }}
          />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium mb-1"
            style={{
              color: "var(--text-primary)",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>

          {task.description && (
            <p className="text-xs mb-2 line-clamp-2" style={{ color: "var(--text-muted)" }}>
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority */}
            <span
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
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
                className="flex items-center gap-1 text-xs"
                style={{ color: overdue && !isDone ? "var(--danger)" : "var(--text-muted)" }}
              >
                {overdue && !isDone ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                {formatDeadline(task.deadline)}
              </span>
            )}

            {/* Duration */}
            {task.estimated_duration && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <Clock className="w-3 h-3" />
                {formatDuration(task.estimated_duration)}
              </span>
            )}

            {/* Risk */}
            <span className="text-xs" style={{ color: riskColor }}>
              {risk.label}
            </span>
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

      {/* Action buttons — visible on hover */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          id={`edit-task-${task.id}`}
          onClick={() => onEdit(task)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all"
          style={{ color: "var(--text-muted)" }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {task.status !== "archived" && (
          <button
            id={`archive-task-${task.id}`}
            onClick={() => archiveTask.mutate(task.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          id={`delete-task-${task.id}`}
          onClick={() => deleteTask.mutate(task.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-all"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
