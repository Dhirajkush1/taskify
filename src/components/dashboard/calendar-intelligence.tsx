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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/suggest");
      if (response.ok) {
        const payload = await response.json();
        setConflicts(payload.data || []);
        setSuggestions(payload.suggestions || []);
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
      if (conflictType === "double_booking" && payload.eventB) {
        const res = await fetch(`/api/calendar/events/${payload.eventB}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
            end_time: new Date(Date.now() + 3.5 * 3600 * 1000).toISOString()
          })
        });
        if (!res.ok) throw new Error();
      } else if (conflictType === "no_lunch") {
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
        const res = await fetch("/api/calendar/sync", { method: "POST" });
        if (!res.ok) throw new Error();
      }

      toast.success("AI scheduling recommendation applied successfully!");
      triggerConfetti();
      loadInsights();
    } catch {
      toast.error("Failed to execute calendar change.");
    } finally {
      setActingId(null);
    }
  };

  const handleSuggestionAction = async (eventId: string, action: "approve" | "ignore") => {
    setActingId(eventId);
    toast.info(action === "approve" ? "Scheduling tasks..." : "Ignoring suggestion...");

    try {
      const res = await fetch(`/api/calendar/events/${eventId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error();

      toast.success(action === "approve" ? "Tasks scheduled successfully!" : "Suggestion ignored.");
      loadInsights();
    } catch {
      toast.error("Failed to process suggestion action.");
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
        <div className="space-y-4">
          {/* AI Suggestions Section */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Action Recommendations</h3>
              {suggestions.map((s) => (
                <div 
                  key={s.id}
                  className="p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 flex flex-col gap-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-neutral-200">{s.title}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                      Purpose: {s.ai_analysis?.purpose || "Preparation tasks needed"}.
                    </p>
                    {s.ai_analysis?.suggested_tasks && s.ai_analysis.suggested_tasks.length > 0 && (
                      <div className="mt-1.5 pl-2 border-l border-violet-500/40 text-[9px] text-neutral-400 space-y-0.5">
                        {s.ai_analysis.suggested_tasks.map((t: any, idx: number) => (
                          <div key={idx}>• {t.title} ({t.estimated_duration}m)</div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-violet-500/10 mt-1">
                    <button
                      onClick={() => handleSuggestionAction(s.id, "ignore")}
                      disabled={actingId === s.id}
                      className="px-2 py-1 rounded-lg hover:bg-neutral-800 text-[9px] font-bold text-neutral-400 cursor-pointer"
                    >
                      Ignore
                    </button>
                    <button
                      onClick={() => handleSuggestionAction(s.id, "approve")}
                      disabled={actingId === s.id}
                      className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-[9px] flex items-center gap-1 cursor-pointer"
                    >
                      {actingId === s.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Check className="w-2.5 h-2.5" />
                      )}
                      Schedule Tasks
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timeline Conflicts */}
          <div className="space-y-2">
            {conflicts.length > 0 && (
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Timeline Alerts</h3>
            )}
            {conflicts.length === 0 && suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400/30 mb-1.5" />
                <p className="text-xs font-bold text-neutral-200">Timeline Fully Optimized</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Clutch detected no conflicts or pending tasks.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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
            )}
          </div>

          <div className="mt-2 p-3 rounded-xl bg-neutral-900/30 border border-neutral-900/60 flex items-center justify-between text-[9px] text-neutral-500">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Focus time protected</span>
            <span className="font-bold text-neutral-300">Active Shield</span>
          </div>
        </div>
      )}
    </div>
  );
}
