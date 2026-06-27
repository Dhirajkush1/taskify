import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--background)" }}
    >
      {/* Auth Nav */}
      <nav className="flex items-center justify-between px-6 h-16" style={{ borderBottom: "1px solid var(--border)" }}>
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
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {/* Glow orb */}
          <div
            className="absolute -top-20 -left-20 w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, oklch(0.65 0.22 280 / 0.1), transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
