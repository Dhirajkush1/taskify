"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MOCK_HEIGHTS = [40, 65, 30, 85, 55, 20, 70]; // placeholder bar heights %

export function ProductivitySummary() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-2xl p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
            Weekly Progress
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--accent)" }}>
          <TrendingUp className="w-3.5 h-3.5" />
          Coming soon
        </div>
      </div>

      {/* Placeholder Chart */}
      <div className="h-32 flex items-end gap-2">
        {MOCK_HEIGHTS.map((h, i) => (
          <motion.div
            key={DAYS[i]}
            className="flex-1 flex flex-col items-center gap-2"
          >
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
              className="w-full rounded-lg relative overflow-hidden"
              style={{
                background: i === 3
                  ? "linear-gradient(180deg, var(--primary), oklch(0.65 0.22 280 / 0.4))"
                  : "var(--surface-raised)",
                border: "1px solid var(--border)",
                minHeight: "8px",
              }}
            >
              {i === 3 && (
                <div className="absolute inset-0" style={{ background: "var(--primary-muted)" }} />
              )}
            </motion.div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {DAYS[i]}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: "var(--text-disabled)" }}>
        Connect your tasks to see real completion data
      </p>
    </motion.div>
  );
}
