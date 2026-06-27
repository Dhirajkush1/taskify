"use client";

import { motion } from "framer-motion";
import { CheckSquare, Zap, Clock, TrendingUp } from "lucide-react";
import type { DashboardStats } from "@/types/app.types";

interface QuickStatsProps {
  stats: DashboardStats;
}

const STAT_ITEMS = [
  {
    key: "totalTasks" as keyof DashboardStats,
    label: "Total Tasks",
    icon: CheckSquare,
    color: "oklch(0.65 0.22 280)",
    suffix: "",
  },
  {
    key: "completedToday" as keyof DashboardStats,
    label: "Done Today",
    icon: TrendingUp,
    color: "oklch(0.70 0.18 152)",
    suffix: "",
  },
  {
    key: "inProgress" as keyof DashboardStats,
    label: "In Progress",
    icon: Zap,
    color: "oklch(0.75 0.18 60)",
    suffix: "",
  },
  {
    key: "upcomingDeadlines" as keyof DashboardStats,
    label: "Due This Week",
    icon: Clock,
    color: "oklch(0.65 0.22 27)",
    suffix: "",
  },
];

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {value}
    </motion.span>
  );
}

export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_ITEMS.map(({ key, label, icon: Icon, color }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          whileHover={{ y: -2, scale: 1.01 }}
          className="p-5 rounded-2xl relative overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Background glow */}
          <div
            className="absolute inset-0 rounded-2xl opacity-5"
            style={{ background: `radial-gradient(circle at 80% 20%, ${color}, transparent 70%)` }}
          />

          <div className="flex items-start justify-between mb-4 relative z-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}/15`, border: `1px solid ${color}/25` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>

          <div className="relative z-10">
            <p
              className="text-3xl font-bold mb-1"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
            >
              <AnimatedNumber value={stats[key] as number} />
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {label}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function QuickStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl shimmer"
          style={{ height: "130px", border: "1px solid var(--border)" }}
        />
      ))}
    </div>
  );
}
