"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "I used to miss deadlines constantly. Since using Taskify AI, I've completed every project on time for 3 months straight. The natural language input is a game changer.",
    name: "Aisha Patel",
    role: "Product Manager @ Stripe",
    initials: "AP",
    color: "oklch(0.65 0.22 280)",
  },
  {
    quote:
      "I just tell it 'I have three client reports due this week' and it builds my entire plan. It's like having a brilliant assistant that never sleeps.",
    name: "Marcus Chen",
    role: "Freelance Designer",
    initials: "MC",
    color: "oklch(0.70 0.15 230)",
  },
  {
    quote:
      "The risk level intelligence is what sold me. Taskify flags tasks I didn't even know were urgent. I haven't had a late submission since.",
    name: "Sofia Rodriguez",
    role: "PhD Student, Stanford",
    initials: "SR",
    color: "oklch(0.70 0.18 152)",
  },
  {
    quote:
      "Incredibly intuitive. I was managing 12 client projects simultaneously and Taskify kept me sane. The mission control chat is like having a co-pilot.",
    name: "Jake Thompson",
    role: "Startup Founder",
    initials: "JT",
    color: "oklch(0.75 0.18 60)",
  },
  {
    quote:
      "As an intern with 5 tasks from 3 different managers, I was overwhelmed. Taskify turned all my scattered notes into a clear action plan every morning.",
    name: "Yuki Tanaka",
    role: "Software Engineering Intern",
    initials: "YT",
    color: "oklch(0.72 0.20 300)",
  },
  {
    quote:
      "The streaming AI chat feels like talking to someone who actually cares about your productivity. It's not just a task app — it's a thinking partner.",
    name: "Priya Sharma",
    role: "UX Researcher",
    initials: "PS",
    color: "oklch(0.65 0.22 27)",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 px-4 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--primary)" }}>
            Testimonials
          </p>
          <h2 style={{ color: "var(--text-primary)" }}>
            Loved by people who{" "}
            <span className="gradient-text">get things done</span>
          </h2>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map(({ quote, name, role, initials, color }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.1, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="p-6 rounded-2xl relative"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className="w-3.5 h-3.5 fill-current"
                    style={{ color: "oklch(0.75 0.18 60)" }}
                  />
                ))}
              </div>

              {/* Quote */}
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: "var(--text-secondary)" }}
              >
                &ldquo;{quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: color }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {role}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
