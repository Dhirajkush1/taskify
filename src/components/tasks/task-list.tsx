"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox } from "lucide-react";
import type { Task } from "@/types/app.types";
import { TaskCard } from "./task-card";

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  onEdit: (task: Task) => void;
}

type SectionKey = "todaysFocus" | "dueToday" | "overdue" | "upcoming" | "completedToday";

interface SectionConfig {
  key: SectionKey;
  label: string;
  color: string;
  defaultExpanded: boolean;
  bgClass: string;
}

const SECTIONS: SectionConfig[] = [
  { key: "todaysFocus", label: "Today's Focus 🎯", color: "var(--violet-400)", defaultExpanded: true, bgClass: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { key: "dueToday", label: "Due Today ⏱️", color: "var(--blue-400)", defaultExpanded: true, bgClass: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { key: "overdue", label: "Overdue 🚨", color: "var(--red-400)", defaultExpanded: true, bgClass: "bg-red-500/10 text-red-400 border-red-500/20" },
  { key: "upcoming", label: "Upcoming 📅", color: "var(--neutral-400)", defaultExpanded: false, bgClass: "bg-neutral-500/10 text-neutral-400 border-neutral-800" },
  { key: "completedToday", label: "Completed Today ✅", color: "var(--emerald-400)", defaultExpanded: false, bgClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
];

export function TaskList({ tasks, isLoading, onEdit }: TaskListProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(() => {
    const set = new Set<SectionKey>();
    SECTIONS.forEach((s) => {
      if (s.defaultExpanded) set.add(s.key);
    });
    return set;
  });

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="shimmer h-20 rounded-2xl" />
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

  // Time boundaries
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Active tasks (excluding archived)
  const activeTasks = tasks.filter((t) => t.status !== "archived");

  // 1. Today's Focus: status === 'in_progress' OR (status === 'todo' && priority === 'critical' && deadline is today/no deadline/past)
  const todaysFocusList = activeTasks.filter(
    (t) =>
      t.status === "in_progress" ||
      (t.status === "todo" &&
        (t.priority === "critical" || t.priority === "high") &&
        (!t.deadline || new Date(t.deadline).getTime() <= endOfToday.getTime()))
  );

  const focusIds = new Set(todaysFocusList.map((t) => t.id));

  // 2. Due Today (excluding focus): deadline is today, status !== done
  const dueTodayList = activeTasks.filter((t) => {
    if (t.status === "done" || !t.deadline || focusIds.has(t.id)) return false;
    const d = new Date(t.deadline);
    return d.getTime() >= startOfToday.getTime() && d.getTime() <= endOfToday.getTime();
  });

  // 3. Overdue (excluding focus): deadline is in past, status !== done
  const overdueList = activeTasks.filter((t) => {
    if (t.status === "done" || !t.deadline || focusIds.has(t.id)) return false;
    const d = new Date(t.deadline);
    return d.getTime() < startOfToday.getTime();
  });

  // 4. Upcoming (excluding focus): deadline is in future, status !== done
  const upcomingList = activeTasks.filter((t) => {
    if (t.status === "done" || !t.deadline || focusIds.has(t.id)) return false;
    const d = new Date(t.deadline);
    return d.getTime() > endOfToday.getTime();
  });

  // 5. Completed Today: status === 'done' && updated_at >= startOfToday
  const completedTodayList = tasks.filter((t) => {
    if (t.status !== "done") return false;
    const updateTime = t.updated_at ? new Date(t.updated_at).getTime() : 0;
    return updateTime >= startOfToday.getTime();
  });

  const grouped = {
    todaysFocus: todaysFocusList,
    dueToday: dueTodayList,
    overdue: overdueList,
    upcoming: upcomingList,
    completedToday: completedTodayList
  };

  return (
    <div className="space-y-6">
      {SECTIONS.map((sec) => {
        const list = grouped[sec.key];
        if (list.length === 0) return null;
        const isExpanded = expandedSections.has(sec.key);

        return (
          <div key={sec.key} className="space-y-3">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sec.key)}
              className="w-full flex items-center justify-between pb-1.5 border-b group transition-all text-left"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  {sec.label}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sec.bgClass}`}
                >
                  {list.length}
                </span>
              </div>
              <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">
                {isExpanded ? "Collapse" : "Expand"}
              </span>
            </button>

            {/* List Items */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2.5 overflow-hidden"
                >
                  <AnimatePresence mode="popLayout">
                    {list.map((task) => (
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
