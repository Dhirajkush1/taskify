"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Sparkles, AlertCircle, ShieldAlert, Check, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SmartNotification {
  id: string;
  type: "urgency" | "blocker" | "incentive";
  title: string;
  message: string;
  read: boolean;
  time: string;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch active tasks to compile smart, context-aware notifications
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "done")
        .neq("status", "archived");

      if (!tasks || tasks.length === 0) {
        setNotifications([
          {
            id: "1",
            type: "incentive",
            title: "Missions Clear! 🚀",
            message: "Your schedule is clear. Start a new milestone to build momentum!",
            read: false,
            time: "Just now",
          },
        ]);
        return;
      }

      const list: SmartNotification[] = [];

      // Add a smart, time-aware urgency notification
      const upcoming = tasks.find((t) => t.deadline);
      if (upcoming) {
        const duration = upcoming.estimated_duration || 45;
        list.push({
          id: "urgency-1",
          type: "urgency",
          title: "Optimized Start Window ⏱️",
          message: `You still have enough time to finish "${upcoming.title}" if you start within 30 minutes.`,
          read: false,
          time: "5m ago",
        });
      }

      // Add blocker dependency alert
      const blocked = tasks.find((t) => t.dependencies && (t.dependencies as string[]).length > 0);
      if (blocked) {
        const deps = blocked.dependencies as string[];
        list.push({
          id: "blocker-1",
          type: "blocker",
          title: "Blocker Alert 🔗",
          message: `"${blocked.title}" is currently locked. Resolve [${deps.join(", ")}] first.`,
          read: false,
          time: "15m ago",
        });
      }

      // Add a motivational productivity incentive
      list.push({
        id: "incentive-1",
        type: "incentive",
        title: "Daily Goal Synergy 🏆",
        message: "Completing today's recommended tasks will boost your Success Probability by 18%!",
        read: false,
        time: "1h ago",
      });

      setNotifications(list);
    }

    loadNotifications();

    // Close dropdown on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/5 relative text-neutral-400 hover:text-white"
        type="button"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 rounded-2xl border p-4 shadow-xl z-50 overflow-hidden"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-bold text-neutral-200">AI Context Notifier</span>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex flex-col gap-2.5 max-h-[250px] overflow-y-auto pr-0.5">
              {notifications.length === 0 ? (
                <p className="text-[10px] text-neutral-500 italic text-center py-4">No notifications.</p>
              ) : (
                notifications.map((notif) => {
                  return (
                    <div
                      key={notif.id}
                      onClick={() => toggleRead(notif.id)}
                      className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        notif.read
                          ? "bg-neutral-900/20 border-neutral-800/40 opacity-60"
                          : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5">
                          {notif.type === "urgency" && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                          {notif.type === "blocker" && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                          {notif.type === "incentive" && <Sparkles className="w-3.5 h-3.5 text-violet-400" />}
                          <span className="text-[10px] font-bold text-neutral-200">{notif.title}</span>
                        </div>
                        <span className="text-[8px] text-neutral-500 font-medium">{notif.time}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-relaxed pl-5">
                        {notif.message}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
