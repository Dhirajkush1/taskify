"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { NotificationCenter } from "./notification-center";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Your mission overview" },
  "/taskify-buddy": { title: "Taskify Buddy", subtitle: "Talk to your AI companion" },
  "/goals": { title: "Goals", subtitle: "Define your destination and execute" },
  "/tasks": { title: "Tasks", subtitle: "Manage your missions" },
  "/calendar": { title: "Calendar", subtitle: "Plan your timeline" },
  "/settings": { title: "Settings", subtitle: "Configure your experience" },
  "/reminders": { title: "Reminder Center", subtitle: "Manage your scheduled notifications" },
  "/profile": { title: "Profile", subtitle: "Your account" },
};

export function Header() {
  const pathname = usePathname();
  const current = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] ?? { title: "Clutch AI", subtitle: "" };

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-16 flex items-center justify-between px-6 shrink-0"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
    >
      {/* Page Title */}
      <div>
        <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
          {current.title}
        </h1>
        {current.subtitle && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {current.subtitle}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          id="header-search-btn"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
        >
          <Search className="w-4 h-4" />
        </button>
        <NotificationCenter />
      </div>
    </motion.header>
  );
}
