"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";
import type { Task } from "@/types/app.types";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/app.types";
import { formatDeadline, isOverdue } from "@/lib/utils";

interface TodayMissionsProps {
  tasks: Task[];
}

export function TodayMissions({ tasks }: TodayMissionsProps) {
  const todayTasks = tasks
    .filter((t) => t.status !== "archived" && t.status !== "done")
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
            Today&apos;s Missions
          </h2>
        </div>
        <Link href="/tasks">
          <button className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--primary)" }}>
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </Link>
      </div>

      {todayTasks.length === 0 ? (
        <div className="text-center py-10">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--accent)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            All clear! No active missions.
          </p>
          <Link href="/mission-control">
            <button
              className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
            >
              Add tasks via AI
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {todayTasks.map((task, i) => {
            const priorityCfg = PRIORITY_CONFIG[task.priority];
            const overdue = isOverdue(task.deadline);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
                className="flex items-center gap-3 p-3.5 rounded-xl group"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* Priority dot */}
                <div
                  className="priority-dot shrink-0"
                  style={{ background: priorityCfg.color.replace("text-", "") }}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {task.title}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: overdue ? "var(--danger)" : "var(--text-muted)" }}
                  >
                    {formatDeadline(task.deadline)}
                  </p>
                </div>

                {/* Completion ring */}
                <div className="shrink-0 relative w-8 h-8">
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16" cy="16" r="12"
                      fill="none"
                      strokeWidth="2.5"
                      stroke="var(--border)"
                    />
                    <circle
                      cx="16" cy="16" r="12"
                      fill="none"
                      strokeWidth="2.5"
                      stroke="var(--primary)"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 12}`}
                      strokeDashoffset={`${2 * Math.PI * 12 * (1 - task.completion_percentage / 100)}`}
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {task.completion_percentage}%
                  </span>
                </div>

                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: priorityCfg.bg.split(" ")[0], color: priorityCfg.color.replace("text-", "var(--") + ")" }}
                >
                  {priorityCfg.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export function TodayMissionsSkeleton() {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="shimmer h-5 w-36 rounded-lg mb-5" />
      <div className="space-y-2.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="shimmer h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
