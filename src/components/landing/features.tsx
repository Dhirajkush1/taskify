"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Brain, Clock, BarChart3, Shield, Zap, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Natural Language Input",
    description:
      "Just talk. No forms, no structure required. Tell Clutch what you need to do and it figures out everything else.",
    color: "oklch(0.65 0.22 280)",
    gradient: "from-violet-500/20 to-transparent",
  },
  {
    icon: Brain,
    title: "AI Task Extraction",
    description:
      "Gemini AI parses your words and extracts structured tasks with titles, deadlines, priorities, and estimated durations.",
    color: "oklch(0.70 0.15 230)",
    gradient: "from-sky-500/20 to-transparent",
  },
  {
    icon: Shield,
    title: "Risk Intelligence",
    description:
      "Clutch calculates risk levels based on deadline proximity, task complexity, and your completion history.",
    color: "oklch(0.65 0.22 27)",
    gradient: "from-red-500/20 to-transparent",
  },
  {
    icon: Clock,
    title: "Smart Deadline Tracking",
    description:
      "Every task gets a countdown. Clutch monitors urgency in real-time and resurfaces tasks before they become emergencies.",
    color: "oklch(0.75 0.18 60)",
    gradient: "from-amber-500/20 to-transparent",
  },
  {
    icon: Zap,
    title: "Mission Control",
    description:
      "Your personal AI war room. Have conversations, refine plans, and get strategic guidance on completing your work.",
    color: "oklch(0.70 0.18 152)",
    gradient: "from-emerald-500/20 to-transparent",
  },
  {
    icon: BarChart3,
    title: "Productivity Analytics",
    description:
      "Track completion streaks, analyze your peak productivity hours, and understand your personal work patterns.",
    color: "oklch(0.72 0.20 300)",
    gradient: "from-fuchsia-500/20 to-transparent",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

export function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="features"
      className="py-24 px-4 relative"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p
            className="text-sm font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--primary)" }}
          >
            Features
          </p>
          <h2 className="mb-4" style={{ color: "var(--text-primary)" }}>
            Everything you need to{" "}
            <span className="gradient-text">stay ahead</span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Clutch AI combines the power of large language models with smart
            task management to give you a truly intelligent productivity system.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <motion.div
              key={title}
              variants={cardVariants}
              whileHover={{ y: -4, scale: 1.01 }}
              className="p-6 rounded-2xl relative overflow-hidden group cursor-default"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${color}/8%, transparent 70%)`,
                }}
              />

              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative z-10"
                style={{
                  background: `${color}/15`,
                  border: `1px solid ${color}/25`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>

              {/* Content */}
              <h3
                className="text-base font-semibold mb-2 relative z-10"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed relative z-10"
                style={{ color: "var(--text-secondary)" }}
              >
                {description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
