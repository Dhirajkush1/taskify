"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Calendar,
  Layers,
  Sparkles,
  Loader2,
  Trash,
  Check,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Reminder {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  timezone: string;
  status: "pending" | "scheduled" | "delivered" | "completed" | "dismissed" | "expired";
  priority: "low" | "medium" | "high" | "critical";
  notification_channels: string[];
  created_from: "telegram" | "dashboard" | "calendar" | "ai" | "voice";
  task?: { title: string } | null;
}

export default function ReminderCenterPage() {
  const supabase = createClient();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "today" | "delivered" | "completed" | "missed" | "dismissed">("upcoming");
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  // Fetch reminders
  const fetchReminders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("reminders")
        .select("*, task:tasks(title)")
        .eq("user_id", user.id)
        .order("due_at", { ascending: true });

      if (error) throw error;
      setReminders((data || []) as any);
    } catch (err: any) {
      console.error("Error loading reminders:", err.message);
      toast.error("Failed to load reminders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();

    // Set up real-time listener to sync changes instantly
    const channel = supabase
      .channel("realtime-reminders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reminders" },
        () => {
          fetchReminders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async (reminderId: string, action: string) => {
    try {
      const res = await fetch("/api/reminders/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Action executed.");
        fetchReminders();
      } else {
        toast.error(data.error || "Action failed.");
      }
    } catch (e) {
      toast.error("Error communicating with action server.");
    }
  };

  // Filter logic
  const now = new Date();
  const todayStr = now.toDateString();

  const filteredReminders = reminders.filter(r => {
    const rDate = new Date(r.due_at);
    
    switch (activeTab) {
      case "upcoming":
        return (r.status === "pending" || r.status === "scheduled") && rDate > now;
      case "today":
        return rDate.toDateString() === todayStr && r.status !== "completed" && r.status !== "dismissed";
      case "delivered":
        return r.status === "delivered";
      case "completed":
        return r.status === "completed";
      case "missed":
        // Deliberate Missed / Expired classification
        return r.status === "expired" || ((r.status === "delivered" || r.status === "pending") && rDate < now);
      case "dismissed":
        return r.status === "dismissed";
      default:
        return false;
    }
  });

  const getPriorityBadge = (p: string) => {
    const styles: Record<string, string> = {
      critical: "bg-rose-500/10 border-rose-500/20 text-rose-400",
      high: "bg-orange-500/10 border-orange-500/20 text-orange-400",
      medium: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
      low: "bg-neutral-500/10 border-neutral-500/20 text-neutral-400"
    };
    return styles[p] || styles.medium;
  };

  const getSourceBadge = (s: string) => {
    const styles: Record<string, string> = {
      telegram: "bg-sky-500/10 border-sky-500/20 text-sky-400",
      dashboard: "bg-violet-500/10 border-violet-500/20 text-violet-400",
      calendar: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
      ai: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      voice: "bg-pink-500/10 border-pink-500/20 text-pink-400"
    };
    return styles[s] || "bg-neutral-500/10 text-neutral-400";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-7">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-violet-500/10 p-2.5 rounded-2xl border border-violet-500/20 shadow-glow-sm">
            <Bell className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-100">Reminder Center</h1>
            <p className="text-xs text-neutral-400 mt-0.5">Centralized companion notification & dispatch center.</p>
          </div>
        </div>

        <button
          onClick={() => { setLoading(true); fetchReminders(); }}
          className="bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold py-2 px-4 rounded-xl border border-white/10 flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap bg-neutral-950 p-1.5 rounded-2xl border border-neutral-900 gap-1">
        {[
          { id: "upcoming", label: "Upcoming" },
          { id: "today", label: "Today" },
          { id: "delivered", label: "Delivered" },
          { id: "completed", label: "Completed" },
          { id: "missed", label: "Missed" },
          { id: "dismissed", label: "Dismissed" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setReschedulingId(null); }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-violet-600 text-white shadow-glow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reminders List rendering */}
      {loading ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center text-center text-xs text-neutral-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          <span>Syncing reminder table logs...</span>
        </div>
      ) : filteredReminders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredReminders.map(rem => (
              <motion.div
                key={rem.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-neutral-900/40 p-4.5 rounded-2xl border border-white/5 flex flex-col justify-between gap-4 hover:border-violet-500/20 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn("px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider shrink-0", getSourceBadge(rem.created_from))}>
                      {rem.created_from}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider shrink-0", getPriorityBadge(rem.priority))}>
                      {rem.priority}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-neutral-100 leading-snug">{rem.title}</h3>
                  
                  {rem.description && (
                    <p className="text-xs text-neutral-400 leading-relaxed font-semibold">{rem.description}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold uppercase tracking-wider pt-1">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <span>
                      {new Date(rem.due_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>

                  {rem.task && (
                    <div className="bg-neutral-950/40 border border-white/5 p-2 rounded-xl text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      <span className="truncate">Task: {rem.task.title}</span>
                    </div>
                  )}
                </div>

                {/* Reschedule inline drawer */}
                {reschedulingId === rem.id && (
                  <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-2.5 space-y-2.5">
                    <span className="text-[9px] text-neutral-500 font-black block uppercase">Quick Reschedule Offset</span>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black uppercase">
                      <button onClick={() => handleAction(rem.id, "snooze")} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/5 transition-all text-center">
                        +10 Min
                      </button>
                      <button onClick={() => handleAction(rem.id, "busy")} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/5 transition-all text-center">
                        +30 Min
                      </button>
                      <button onClick={() => handleAction(rem.id, "later")} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/5 transition-all text-center">
                        +1 Hr
                      </button>
                    </div>
                    <button
                      onClick={() => setReschedulingId(null)}
                      className="w-full text-center text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase block"
                    >
                      Cancel Rescheduling
                    </button>
                  </div>
                )}

                {/* Card footer action buttons */}
                {reschedulingId !== rem.id && (
                  <div className="flex items-center gap-2 border-t border-neutral-800 pt-3.5">
                    {rem.status !== "completed" && (
                      <button
                        onClick={() => handleAction(rem.id, "complete")}
                        className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Complete
                      </button>
                    )}
                    
                    {(rem.status === "pending" || rem.status === "scheduled" || rem.status === "delivered") && (
                      <button
                        onClick={() => setReschedulingId(rem.id)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs py-2 rounded-xl border border-white/10 transition-all text-center cursor-pointer font-bold"
                      >
                        Reschedule
                      </button>
                    )}

                    {rem.status !== "dismissed" && (
                      <button
                        onClick={() => handleAction(rem.id, "skip")}
                        className="bg-white/5 hover:bg-white/10 text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl border border-white/5 transition-all cursor-pointer"
                        title="Dismiss Reminder"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="min-h-[250px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-neutral-500">
          <Clock className="w-8 h-8 text-neutral-600 mb-3 animate-pulse" />
          <h3 className="text-sm font-black text-neutral-300 uppercase tracking-wide">No Reminders Found</h3>
          <p className="text-xs max-w-sm mt-1">There are no reminders classified under this view filter. Use the AI Chat to schedule a task companion!</p>
        </div>
      )}

    </div>
  );
}
