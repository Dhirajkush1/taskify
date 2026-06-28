import React from "react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        colorScheme: "light",
        background: "#FFFFFF",
        color: "#0F172A",
        // CSS Theme variables override for premium white aesthetic
        "--background": "#FFFFFF",
        "--background-subtle": "#F8FAFC",
        "--surface": "#FFFFFF",
        "--surface-raised": "#F8FAFC",
        "--text-primary": "#0F172A",
        "--text-secondary": "#475569",
        "--text-muted": "#64748B",
        "--border": "#E2E8F0",
        "--border-strong": "#CBD5E1",
        "--primary": "#4F46E5",
        "--primary-muted": "rgba(79, 70, 229, 0.08)",
        "--shadow-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "--shadow-md": "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)",
        "--shadow-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08)",
      } as React.CSSProperties}
      className="min-h-screen text-slate-900"
    >
      {children}
    </div>
  );
}
