import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { CTA } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "Clutch AI — Beat Every Deadline",
  description:
    "The AI productivity companion that helps you actually complete work before deadlines. Talk naturally, get things done.",
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      {/* Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16"
        style={{
          background: "var(--background)/80",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--primary), oklch(0.65 0.22 230))",
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            Clutch AI
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {[
            { label: "Features", href: "#features" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Testimonials", href: "#testimonials" },
            { label: "Pricing", href: "#pricing" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium transition-colors hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <button
              className="text-sm font-medium px-4 py-2 rounded-lg transition-all hover:bg-white/5"
              style={{ color: "var(--text-secondary)" }}
            >
              Sign In
            </button>
          </Link>
          <Link href="/signup">
            <button
              id="nav-get-started"
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
              style={{ background: "var(--primary)" }}
            >
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      {/* Sections */}
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CTA />

      {/* Footer */}
      <footer
        className="py-10 px-6 text-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--primary), oklch(0.65 0.22 230))",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Clutch AI
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} Clutch AI. Built to help you win.
        </p>
      </footer>
    </div>
  );
}
