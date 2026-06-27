"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 px-4 relative overflow-hidden" style={{ borderTop: "1px solid var(--border)" }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full"
          style={{
            background: "radial-gradient(ellipse, oklch(0.65 0.22 280 / 0.15), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-8"
            style={{
              background: "var(--primary-muted)",
              border: "1px solid oklch(0.65 0.22 280 / 0.3)",
              color: "var(--primary)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Start for free today
          </div>

          <h2
            className="mb-6 text-hero"
            style={{ color: "var(--text-primary)" }}
          >
            Ready to{" "}
            <span className="gradient-text">stop scrambling</span>
            <br />
            and start winning?
          </h2>

          <p
            className="text-lg mb-10 max-w-xl mx-auto"
            style={{ color: "var(--text-secondary)", lineHeight: "1.7" }}
          >
            Join thousands of students, professionals, and founders who use
            Clutch AI to stay ahead of every deadline.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup">
              <motion.button
                id="cta-signup-btn"
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all"
                style={{
                  background: "var(--primary)",
                  color: "white",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                Get Started — It&apos;s Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>

          <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
            No credit card required. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
