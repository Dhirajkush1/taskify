"use client";

import { motion } from "framer-motion";
import { MessageSquare, Sparkles, ListChecks, Trophy } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Tell Taskify What's On Your Mind",
    description:
      'Speak or type naturally. "I have an exam Friday, a report due Monday, and a meeting tomorrow at 3pm." That\'s it.',
    color: "oklch(0.65 0.22 280)",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "AI Extracts & Structures Everything",
    description:
      "Gemini AI instantly parses your message, extracts each task, infers deadlines, estimates durations, and assigns priority levels.",
    color: "oklch(0.70 0.15 230)",
  },
  {
    number: "03",
    icon: ListChecks,
    title: "Get Your Mission Plan",
    description:
      "Taskify builds your prioritized mission list, flags high-risk deadlines, and shows you exactly what to tackle first.",
    color: "oklch(0.75 0.18 60)",
  },
  {
    number: "04",
    icon: Trophy,
    title: "Execute & Win",
    description:
      "Work through your missions with AI guidance. Taskify tracks progress, adjusts priorities, and celebrates every completion.",
    color: "oklch(0.70 0.18 152)",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 px-4 relative"
      style={{ background: "var(--background-subtle)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--primary)" }}>
            How It Works
          </p>
          <h2 style={{ color: "var(--text-primary)" }}>
            From chaos to{" "}
            <span className="gradient-text">clarity</span>
            <br />
            in seconds
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line */}
          <div
            className="hidden lg:block absolute top-14 left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px"
            style={{
              background: "linear-gradient(90deg, transparent, var(--border), var(--border-strong), var(--border), transparent)",
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map(({ number, icon: Icon, title, description, color }, i) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="flex flex-col items-center text-center relative"
              >
                {/* Icon bubble */}
                <motion.div
                  whileHover={{ scale: 1.1, y: -4 }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative z-10"
                  style={{
                    background: `${color}/15`,
                    border: `1px solid ${color}/30`,
                    boxShadow: `0 0 24px ${color}/15`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color }} />
                </motion.div>

                {/* Step number */}
                <span
                  className="text-xs font-bold tracking-widest mb-3 uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  Step {number}
                </span>

                <h3
                  className="text-base font-semibold mb-3"
                  style={{ color: "var(--text-primary)", fontSize: "1rem" }}
                >
                  {title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
