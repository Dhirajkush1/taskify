"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, AlertTriangle, AlertCircle, RefreshCw, Calendar, 
  ArrowRight, ShieldCheck, Check, Clock, Coffee, Move, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { triggerConfetti } from "../shared/confetti-canvas";

interface CalendarConflict {
  type: "double_booking" | "back_to_back" | "overbooked" | "no_lunch" | "late_night";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  affected_events: string[];
  action_suggestion: {
    action: "move" | "delay" | "split" | "decline";
    text: string;
    payload: any;
  };
}

export default function CalendarIntelligenceCard() {
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/suggest");
      if (response.ok) {
        const payload = await response.json();
        setConflicts(payload.data || []);
      }
    } catch (err) {
      console.error("[CalendarIntelligence] Failed to fetch suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Execute AI action recommendation
  const handleApplyAction = async (conflictType: string, payload: any) => {
    setActingId(conflictType);
    toast.info("Applying AI calendar optimization...");

    try {
      // Simulate/apply reschedule change
      if (conflictType === "double_booking" && payload.eventB) {
        // Move focus block event to next available slot
        const res = await fetch(`/api/calendar/events/${payload.eventB}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // delay 2h optimistically
            end_time: new Date(Date.now() + 3.5 * 3600 * 1000).toISOString()
          })
        });
        if (!res.ok) throw new Error();
      } else if (conflictType === "no_lunch") {
        // Create a Lunch block event
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "🍴 Blocked: Lunch Break",
            description: "Blocked automatically by Clutch AI to protect recharge hours.",
            start_time: new Date(new Date().setHours(12, 30, 0)).toISOString(),
            end_time: new Date(new Date().setHours(13, 15, 0)).toISOString(),
            event_type: "focus_block",
            status: "confirmed",
            visibility: "busy"
          })
        });
        if (!res.ok) throw new Error();
      } else {
        // Fallback: trigger a replan general reschedule
        const res = await fetch("/api/calendar/sync", { method: "POST" });
        if (!res.ok) throw new Error();
      }

      toast.success("AI scheduling recommendation applied successfully!");
      triggerConfetti();
      loadInsights(); // reload insights
    } catch {
      toast.error("Failed to execute calendar change. Please try again.");
    } finally {
      setActingId(null);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-red-500/30 bg-red-500/5 text-red-400";
      case "high":
        return "border-orange-500/30 bg-orange-500/5 text-orange-400";
      case "medium":
        return "border-yellow-500/30 bg-yellow-500/5 text-yellow-400";
      default:
        return "border-neutral-800 bg-neutral-900/40 text-neutral-300";
    }
  };

  return (
    <div 
      className="rounded-2xl p-5 border flex flex-col gap-4 relative overflow-hidden"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Decorative gradient glow */}
      <div className="absolute -top-12 -left-12 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-bold text-neutral-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" /> AI Calendar Insights
        </span>
        <button
          onClick={loadInsights}
          disabled={loading}
          className="p-1 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400/30 mb-1.5" />
              <p className="text-xs font-bold text-neutral-200">Timeline Fully Optimized</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">Clutch detected no conflicts, overbooks, or missed buffer times.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {conflicts.map((conflict, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-xl border flex flex-col gap-2 ${getSeverityStyle(conflict.severity)}`}
                  >
                    <div className="flex items-start gap-2">
                      {conflict.severity === "critical" || conflict.severity === "high" ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h4 className="text-[11px] font-bold text-neutral-100">{conflict.title}</h4>
                        <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">{conflict.description}</p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1 border-t border-white/5 mt-0.5">
                      <button
                        onClick={() => handleApplyAction(conflict.type, conflict.action_suggestion.payload)}
                        disabled={actingId === conflict.type}
                        className="px-2.5 py-1 rounded-lg bg-violet-600/95 hover:bg-violet-700 text-white font-bold text-[9px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {actingId === conflict.type ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : conflict.type === "no_lunch" ? (
                          <Coffee className="w-2.5 h-2.5" />
                        ) : (
                          <Move className="w-2.5 h-2.5" />
                        )}
                        {conflict.action_suggestion.text}
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* Quick Metrics display */}
          <div className="mt-2 p-3 rounded-xl bg-neutral-900/30 border border-neutral-900/60 flex items-center justify-between text-[9px] text-neutral-500">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Focus time protected</span>
            <span className="font-bold text-neutral-300">Active Shield</span>
          </div>
        </div>
      )}
    </div>
  );
}
