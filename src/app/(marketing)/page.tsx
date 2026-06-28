"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { CTA } from "@/components/landing/cta";
import { Timeline } from "@/components/landing/timeline";
import { DesktopPreview } from "@/components/landing/desktop-preview";
import { CursorGlow } from "@/components/landing/cursor-glow";

export default function LandingPage() {
  const [booting, setBooting] = useState(true);
  const [progress, setProgress] = useState(0);

  // Simulated Neural Boot Sequence
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setBooting(false), 300); // smooth fade transition
          return 100;
        }
        // Random step increases to feel like real initialization
        return prev + Math.floor(Math.random() * 12 + 6);
      });
    }, 90);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }} className="relative select-none">
      
      {/* Premium Cursor Experience */}
      <CursorGlow />

      <AnimatePresence mode="wait">
        {booting ? (
          <motion.div
            key="boot"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[99999]"
          >
            {/* Pulsing Core */}
            <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.25, 1],
                  opacity: [0.15, 0.45, 0.15]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 rounded-full bg-violet-500 filter blur-xl"
              />
              <Sparkles className="w-8 h-8 text-violet-400 relative z-10 animate-pulse" />
            </div>

            <span className="text-[10px] uppercase tracking-widest font-black text-neutral-500 mb-2">
              Initializing Second Brain OS
            </span>

            {/* Progress Percentage */}
            <span className="text-xl font-black font-mono text-neutral-200 mb-6">
              {Math.min(100, progress)}%
            </span>

            {/* Progress Bar Container */}
            <div className="w-48 h-1 bg-neutral-900 rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-violet-600"
                style={{ width: `${Math.min(100, progress)}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {/* Navigation */}
            <nav
              className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 bg-white/70 backdrop-blur-md border-b border-slate-200/50"
            >
              <Link href="/" className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/10"
                >
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <span className="font-extrabold text-slate-800 text-sm tracking-tight">
                  Taskify AI
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-6">
                {[
                  { label: "Features", href: "#features" },
                  { label: "How It Works", href: "#how-it-works" },
                  { label: "Timeline", href: "#timeline" },
                  { label: "Preview", href: "#preview" }
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Link href="/login">
                  <button
                    className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    Sign In
                  </button>
                </Link>
                <Link href="/signup">
                  <button
                    id="nav-get-started"
                    className="text-xs font-bold px-4 py-2.5 rounded-xl text-white transition-all hover:opacity-95 shadow-md shadow-violet-500/10 cursor-pointer bg-violet-600 hover:bg-violet-700"
                  >
                    Get Started
                  </button>
                </Link>
              </div>
            </nav>

            {/* Immersive Scroll Sections */}
            <Hero />
            
            <div id="features">
              <Features />
            </div>

            <div id="how-it-works">
              <HowItWorks />
            </div>

            <div id="timeline">
              <Timeline />
            </div>

            <div id="preview">
              <DesktopPreview />
            </div>

            <Testimonials />
            <Pricing />
            <CTA />

            {/* Footer */}
            <footer
              className="py-12 bg-white border-t border-slate-100 text-center relative z-20"
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-extrabold text-sm text-slate-800">
                  Taskify AI
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                © {new Date().getFullYear()} Taskify AI. Beat every deadline. All rights reserved.
              </p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
