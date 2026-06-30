"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Zap,
  CheckSquare,
  Calendar,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Target,
  FolderKanban,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daily Planner", href: "/tasks", icon: CheckSquare },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Mission Control", href: "/mission-control", icon: Zap },
] as const;

const BOTTOM_ITEMS = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Profile", href: "/profile", icon: User },
] as const;

interface SidebarProps {
  user?: { email?: string; full_name?: string; avatar_url?: string } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 overflow-hidden z-40"
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 animate-pulse-glow"
              style={{
                background: "linear-gradient(135deg, var(--primary), oklch(0.65 0.22 230))",
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="font-bold text-base tracking-tight whitespace-nowrap"
                  style={{ color: "var(--text-primary)" }}
                >
                  Taskify AI
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: collapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "text-white"
                      : "hover:bg-white/5"
                  )}
                  style={
                    isActive
                      ? {
                          background: "var(--primary-muted)",
                          color: "var(--primary)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "var(--primary-muted)" }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon
                    className="w-5 h-5 relative z-10 shrink-0"
                    style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-sm font-medium relative z-10 whitespace-nowrap"
                        style={{ color: isActive ? "var(--primary)" : "var(--text-secondary)" }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <div
                      className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50"
                      style={{
                        background: "var(--surface-overlay)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                        boxShadow: "var(--shadow-md)",
                      }}
                    >
                      {label}
                    </div>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="px-2 py-4 flex flex-col gap-1" style={{ borderTop: "1px solid var(--border)" }}>
          {BOTTOM_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group",
                    collapsed && "justify-center px-2",
                  )}
                  style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {collapsed && (
                    <div
                      className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50"
                      style={{
                        background: "var(--surface-overlay)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {label}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}

          {/* User Profile */}
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1 cursor-pointer group relative",
              collapsed && "justify-center px-2",
            )}
            style={{ background: "var(--surface-raised)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white"
              style={{ background: "var(--primary)" }}
            >
              {initials}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {user?.full_name || "User"}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {user?.email || ""}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {!collapsed && (
              <button
                onClick={handleSignOut}
                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-[72px] -right-3.5 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 z-50"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </motion.aside>

      {/* Mobile Header */}
      <MobileNav pathname={pathname} />
    </>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2"
      style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
    >
      <div className="flex justify-around items-center">
        {[...NAV_ITEMS].map(({ label, href, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}
                >
                  {label.split(" ")[0]}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
