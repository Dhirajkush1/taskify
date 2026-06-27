"use client";

import { motion } from "framer-motion";
import { CalendarClock, AlertTriangle } from "lucide-react";
import type { Task } from "@/types/app.types";
import { PRIORITY_CONFIG } from "@/types/app.types";
import { formatDate, isOverdue } from "@/lib/utils";

interface UpcomingDeadlinesProps {
  tasks: Task[];
}

export function UpcomingDeadlines({ tasks }: UpcomingDeadlinesProps) {
  const upcoming = tasks
    .filter(
      (t) =>
        t.deadline &&
        t.status !== "done" &&
        t.status !== "archived"
    )
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
    )
    .slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <CalendarClock className="w-4 h-4" style={{ color: "var(--warning)" }} />
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
          Upcoming Deadlines
        </h2>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
          No upcoming deadlines
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((task, i) => {
            const overdue = isOverdue(task.deadline);
            const priorityCfg = PRIORITY_CONFIG[task.priority];
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 py-3 px-3.5 rounded-xl"
                style={{
                  background: overdue ? "oklch(0.65 0.22 27 / 0.08)" : "var(--surface-raised)",
                  border: `1px solid ${overdue ? "oklch(0.65 0.22 27 / 0.2)" : "var(--border-subtle)"}`,
                }}
              >
                {overdue ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--danger)" }} />
                ) : (
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: priorityCfg.dotColor.replace("bg-", "var(--") + ")" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {task.title}
                  </p>
                </div>
                <p
                  className="text-xs font-medium shrink-0"
                  style={{ color: overdue ? "var(--danger)" : "var(--text-muted)" }}
                >
                  {formatDate(task.deadline)}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
