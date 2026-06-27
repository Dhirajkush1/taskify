"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useAnimation } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle2, Clock, Zap } from "lucide-react";

const DEMO_TEXT = "I have my math exam on Friday, need to pay the electricity bill tomorrow, and complete my internship assignment by Monday.";

const EXTRACTED_TASKS = [
  { title: "Math Exam", deadline: "Friday", priority: "critical", icon: "📚" },
  { title: "Electricity Bill", deadline: "Tomorrow", priority: "high", icon: "⚡" },
  { title: "Internship Assignment", deadline: "Monday", priority: "high", icon: "💼" },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "oklch(0.65 0.22 27)",
  high: "oklch(0.75 0.18 60)",
  medium: "oklch(0.70 0.18 152)",
};

export function Hero() {
  const [typedText, setTypedText] = useState("");
  const [showTasks, setShowTasks] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const startDemo = () => {
      setTypedText("");
      setShowTasks(false);
      setIsTyping(true);

      let i = 0;
      const type = () => {
        if (i < DEMO_TEXT.length) {
          setTypedText(DEMO_TEXT.slice(0, i + 1));
          i++;
          timerRef.current = setTimeout(type, 28 + Math.random() * 20);
        } else {
          setIsTyping(false);
          timerRef.current = setTimeout(() => setShowTasks(true), 600);
        }
      };

      timerRef.current = setTimeout(type, 1200);
    };

    startDemo();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 animate-spin-slow"
          style={{
            background:
              "radial-gradient(circle, oklch(0.65 0.22 280 / 0.6), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(circle, oklch(0.70 0.18 152 / 0.5), transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5"
          style={{
            background:
              "radial-gradient(circle, oklch(0.65 0.22 280), transparent 70%)",
            filter: "blur(100px)",
          }}
        />
        {/* Grid */}
        <div className="absolute inset-0 bg-grid opacity-30" />
      </div>

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
        style={{
          background: "var(--primary-muted)",
          border: "1px solid oklch(0.65 0.22 280 / 0.3)",
          color: "var(--primary)",
        }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Powered by Gemini AI
      </motion.div>

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-center max-w-4xl mx-auto mb-6"
      >
        <h1
          className="text-display mb-4 leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          Stop{" "}
          <span className="gradient-text">missing</span>
          <br />
          deadlines.{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, oklch(0.80 0.22 280), oklch(0.70 0.18 152))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Forever.
          </span>
        </h1>
        <p
          className="text-lg md:text-xl max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)", lineHeight: "1.7" }}
        >
          Just talk naturally. Clutch AI extracts your tasks, sets smart
          deadlines, calculates risk — and keeps you{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            ahead of everything
          </span>
          .
        </p>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="flex flex-wrap gap-3 justify-center mb-16"
      >
        <Link href="/signup">
          <motion.button
            id="hero-cta-primary"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: "var(--primary)",
              color: "white",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </Link>
        <Link href="/login">
          <motion.button
            id="hero-cta-secondary"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{
              background: "var(--surface-raised)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            Sign In
          </motion.button>
        </Link>
      </motion.div>

      {/* Demo Card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.35 }}
        className="w-full max-w-2xl mx-auto"
      >
        <div
          className="rounded-2xl p-6 glass"
          style={{ boxShadow: "var(--shadow-lg), var(--shadow-glow-sm)" }}
        >
          {/* Input simulation */}
          <div className="mb-4">
            <div
              className="flex items-center gap-2 mb-3"
            >
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--danger)" }} />
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--warning)" }} />
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
              <span className="ml-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Mission Control
              </span>
            </div>
            <div
              className="w-full rounded-xl p-4 min-h-[72px] text-sm leading-relaxed relative"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {typedText}
              {isTyping && (
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </div>
          </div>

          {/* Extracted tasks */}
          {showTasks && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                  AI extracted 3 tasks
                </span>
              </div>
              {EXTRACTED_TASKS.map((task, i) => (
                <motion.div
                  key={task.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.35 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: "var(--surface-overlay)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span className="text-base">{task.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Due {task.deadline}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                    style={{
                      color: PRIORITY_COLORS[task.priority] || "var(--text-muted)",
                      background: `${PRIORITY_COLORS[task.priority] || "var(--border)"}/15`,
                      border: `1px solid ${PRIORITY_COLORS[task.priority] || "var(--border)"}/25`,
                    }}
                  >
                    {task.priority}
                  </span>
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs mt-4"
          style={{ color: "var(--text-muted)" }}
        >
          No credit card required · Free to start · Setup in 30 seconds
        </motion.p>
      </motion.div>
    </section>
  );
}
