import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { SupabaseProvider } from "@/providers/supabase-provider";
import { RealtimeSyncProvider } from "@/providers/realtime-sync-provider";
import { Toaster } from "sonner";
import { ConfettiCanvas } from "@/components/shared/confetti-canvas";

export const metadata: Metadata = {
  title: {
    default: "Taskify AI — Beat Every Deadline",
    template: "%s | Taskify AI",
  },
  description:
    "Taskify AI is your AI productivity companion that helps you actually complete work before deadlines. Just talk naturally — Taskify extracts tasks, sets priorities, and keeps you ahead.",
  keywords: ["AI productivity", "task management", "deadline tracker", "AI assistant", "taskify buddy"],
  authors: [{ name: "Taskify AI" }],
  openGraph: {
    title: "Taskify AI — Beat Every Deadline",
    description: "Your AI productivity companion. Talk naturally, get things done.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Taskify AI",
    description: "Your AI productivity companion.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <SupabaseProvider>
          <QueryProvider>
            <RealtimeSyncProvider>
              {children}
              <ConfettiCanvas />
              <Toaster
                position="bottom-right"
                theme="dark"
                toastOptions={{
                  style: {
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  },
                }}
              />
            </RealtimeSyncProvider>
          </QueryProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
