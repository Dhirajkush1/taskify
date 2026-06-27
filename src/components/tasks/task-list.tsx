"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, Inbox, Loader2 } from "lucide-react";
import type { Task, TaskStatus } from "@/types/app.types";
import { STATUS_CONFIG } from "@/types/app.types";
import { TaskCard } from "./task-card";

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  onEdit: (task: Task) => void;
}

const STATUS_ORDER: TaskStatus[] = ["in_progress", "todo", "done", "archived"];

export function TaskList({ tasks, isLoading, onEdit }: TaskListProps) {
  const [expandedSections, setExpandedSections] = useState<Set<TaskStatus>>(
    new Set(["todo", "in_progress"])
  );

  const toggleSection = (status: TaskStatus) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="shimmer h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <Inbox className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
        </div>
        <p className="text-base font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
          No tasks found
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Create your first task or ask Clutch AI to extract them
        </p>
      </motion.div>
    );
  }

  // Group by status
  const grouped = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
  );

  return (
    <div className="space-y-5">
      {STATUS_ORDER.map((status) => {
        const group = grouped[status];
        if (group.length === 0) return null;
        const cfg = STATUS_CONFIG[status];
        const isExpanded = expandedSections.has(status);

        return (
          <div key={status}>
            {/* Section header */}
            <button
              onClick={() => toggleSection(status)}
              className="w-full flex items-center gap-3 mb-3 group"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" style={{ color: cfg.color.replace("text-", "var(--") + ")" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {cfg.label}
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: cfg.bg.split(" ")[0].replace("bg-", "oklch(") + "/0.15)",
                    color: cfg.color.replace("text-", "var(--") + ")",
                  }}
                >
                  {group.length}
                </span>
              </div>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isExpanded ? "↑" : "↓"}
              </span>
            </button>

            {/* Cards */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2.5 overflow-hidden"
                >
                  <AnimatePresence mode="popLayout">
                    {group.map((task) => (
                      <TaskCard key={task.id} task={task} onEdit={onEdit} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
