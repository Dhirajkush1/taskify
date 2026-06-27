"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for individuals getting started",
    features: [
      "Up to 20 tasks/month",
      "Basic AI extraction",
      "Mission Control (5 conversations)",
      "Email support",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    description: "For power users who need to get serious",
    features: [
      "Unlimited tasks",
      "Advanced AI extraction",
      "Unlimited Mission Control",
      "Risk intelligence",
      "Calendar integration",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "Team",
    price: "$29",
    description: "Collaborate and execute as a team",
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Shared mission boards",
      "Team analytics",
      "SSO / SAML",
      "Dedicated support",
    ],
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="py-24 px-4 relative"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--primary)" }}>
            Pricing
          </p>
          <h2 style={{ color: "var(--text-primary)" }}>
            Simple, transparent{" "}
            <span className="gradient-text">pricing</span>
          </h2>
          <p className="mt-4 text-lg" style={{ color: "var(--text-secondary)" }}>
            Choose the plan that fits your ambitions.
          </p>
        </motion.div>

        {/* Coming Soon Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 px-5 py-3.5 rounded-xl mb-10 max-w-sm mx-auto justify-center"
          style={{
            background: "var(--primary-muted)",
            border: "1px solid oklch(0.65 0.22 280 / 0.3)",
          }}
        >
          <Lock className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
            Paid plans launching soon
          </span>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
          {/* Blur overlay */}
          <div
            className="absolute inset-0 z-10 rounded-2xl"
            style={{
              backdropFilter: "blur(2px)",
              background: "var(--background)/40",
            }}
          />

          {PLANS.map(({ name, price, description, features, highlight }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="p-6 rounded-2xl relative"
              style={{
                background: highlight ? "var(--primary-muted)" : "var(--surface)",
                border: `1px solid ${highlight ? "oklch(0.65 0.22 280 / 0.4)" : "var(--border)"}`,
                boxShadow: highlight ? "var(--shadow-glow-sm)" : "none",
              }}
            >
              {highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                {name}
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>

              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {price}
                </span>
                {price !== "$0" && (
                  <span className="text-sm ml-1" style={{ color: "var(--text-muted)" }}>
                    /month
                  </span>
                )}
              </div>

              <ul className="space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent)" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
