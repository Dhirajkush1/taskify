"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Sparkles, AlertCircle, ShieldAlert, Check, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SmartNotification {
  id: string;
  type: "urgency" | "blocker" | "incentive" | "reminder" | "follow_up";
  title: string;
  message: string;
  read: boolean;
  time: string;
  task_id?: string | null;
}

function formatRelativeTime(isoString: string): string {
  const elapsed = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(elapsed / (1000 * 60));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch notifications from the database
    const { data: dbNotifs, error } = await (supabase
      .from("notifications") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[NotificationCenter] Error fetching notifications:", error.message);
      return;
    }

    const mapped: SmartNotification[] = (dbNotifs || []).map((n: any) => ({
      id: n.id,
      type: n.type as any,
      title: n.title,
      message: n.message,
      read: n.read,
      time: formatRelativeTime(n.created_at),
      task_id: n.task_id
    }));

    setNotifications(mapped);
  };

  useEffect(() => {
    loadNotifications();

    // Subscribe to realtime changes on notifications table
    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    // Close dropdown on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("mousedown", handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase
      .from("notifications") as any)
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (notif: SmartNotification) => {
    // Mark as read in Supabase
    await (supabase
      .from("notifications") as any)
      .update({ read: true })
      .eq("id", notif.id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );

    setIsOpen(false);

    if (notif.task_id) {
      router.push("/tasks");
    }
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
                      onClick={() => handleNotificationClick(notif)}
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
                          {notif.type === "reminder" && <Bell className="w-3.5 h-3.5 text-blue-400" />}
                          {notif.type === "follow_up" && <AlertCircle className="w-3.5 h-3.5 text-violet-400" />}
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
