"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, CheckCircle2, Clock, Brain, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { triggerConfetti } from "@/components/shared/confetti-canvas";

interface FocusSessionTimerProps {
  tasks: any[];
  onSessionComplete?: () => void;
}

export function FocusSessionTimer({ tasks, onSessionComplete }: FocusSessionTimerProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [durationPreset, setDurationPreset] = useState<number>(25); // minutes
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60); // seconds
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Filter and sort tasks for focus selection based on execution priority
  const activeTasks = tasks
    .filter((t) => t.status !== "done" && t.status !== "archived")
    .sort((a, b) => {
      // 1. Sort by priority score (descending)
      if ((b.priority_score || 0) !== (a.priority_score || 0)) {
        return (b.priority_score || 0) - (a.priority_score || 0);
      }
      // 2. Sort by estimated duration (ascending)
      if ((a.estimated_duration || 0) !== (b.estimated_duration || 0)) {
        return (a.estimated_duration || 30) - (b.estimated_duration || 30);
      }
      // 3. Sort by deadline (ascending, nulls last)
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  // Helper to play synthesized beep/chime using Web Audio API (no external asset dependencies!)
  const playSynthesizedChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Chime note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.value = 523.25; // C5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Chime note 2 (harmonized fifth)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.value = 783.99; // G5
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.55);
    } catch (e) {
      console.warn("Audio Context chime failed:", e);
    }
  };

  const handleTimerFinish = useCallback(async () => {
    setIsRunning(false);
    playSynthesizedChime();
    triggerConfetti(); // Trigger confetti celebration!
    setCompleted(true);
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1. Log Focus Session to DB
        await supabase.from("focus_sessions").insert({
          user_id: user.id,
          task_id: selectedTaskId || null,
          duration_minutes: durationPreset,
          completed_minutes: durationPreset,
          status: "completed" as const,
        });

        // 2. If a task was selected, automatically update its progress/status
        if (selectedTaskId) {
          await supabase
            .from("tasks")
            .update({
              status: "done" as const,
              completion_percentage: 100,
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedTaskId);

          // Log task completion activity
          await supabase.from("activity_logs").insert({
            user_id: user.id,
            action: "task_completed",
            entity_type: "task",
            entity_id: selectedTaskId,
          });

          // 3. Recalculate probabilities & analytics via background API trigger or client updates
          await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: `recalculate productivity metrics for complete task.` }],
              provider: "gemini"
            })
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[FocusSession] Error saving completed focus session:", err);
    } finally {
      setSaving(false);
      if (onSessionComplete) onSessionComplete();
    }
  }, [selectedTaskId, durationPreset, supabase, onSessionComplete]);

  // Reset time when preset changes
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(durationPreset * 60);
    }
  }, [durationPreset, isRunning]);

  // Timer tick down
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, handleTimerFinish]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customMinutes);
    if (mins > 0 && mins <= 180) {
      setDurationPreset(mins);
      setTimeLeft(mins * 60);
      setCustomMinutes("");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Progress percentage
  const totalSeconds = durationPreset * 60;
  const progressPercent = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  return (
    <div
      className="rounded-2xl p-5 border flex flex-col gap-4 relative overflow-hidden h-full"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Focus Session Timer
          </h3>
        </div>
        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-neutral-400 font-bold">
          Pomodoro Mode
        </span>
      </div>

      <AnimatePresence mode="wait">
        {completed ? (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center justify-center py-6 gap-3"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-extrabold text-neutral-100">Focus Session Complete! 🏆</h4>
            <p className="text-xs text-neutral-400 max-w-[80%] leading-relaxed">
              Fantastic work. Your focus time was logged and your task has been updated to completed.
            </p>
            <button
              onClick={() => {
                setCompleted(false);
                setTimeLeft(durationPreset * 60);
              }}
              className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              Start Another Session
            </button>
          </motion.div>
        ) : (
          <motion.div key="timer" className="flex flex-col gap-4">
            {/* Task Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Select Focus Mission
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                disabled={isRunning}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none focus:border-violet-500 transition-all"
              >
                <option value="">-- Focus without a task --</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    🎯 {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center py-4 relative">
              {/* Radial background glow */}
              <div className="absolute w-36 h-36 rounded-full bg-violet-500/5 blur-2xl pointer-events-none" />

              <span className="text-4xl font-black text-neutral-100 tracking-wider font-mono">
                {formatTime(timeLeft)}
              </span>

              {/* Minimal Progress Bar */}
              <div className="w-48 h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Presets and Controls */}
            {!isRunning ? (
              <div className="flex flex-col gap-3">
                {/* Preset Chips */}
                <div className="flex justify-center gap-2">
                  {[25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDurationPreset(mins)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        durationPreset === mins
                          ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                          : "bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Custom</span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    placeholder="Mins"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="w-16 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 text-center outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    className="text-xs font-bold text-violet-400 hover:text-violet-300"
                  >
                    Set
                  </button>
                </form>
              </div>
            ) : null}

            {/* Play/Pause Controls */}
            <div className="flex justify-center gap-3 mt-1.5">
              {isRunning ? (
                <button
                  onClick={() => setIsRunning(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:scale-105 transition-all"
                >
                  <Pause className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => setIsRunning(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-violet-500 text-white shadow-sm hover:scale-105 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>
              )}

              <button
                onClick={() => {
                  setIsRunning(false);
                  setTimeLeft(durationPreset * 60);
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-neutral-400 hover:scale-105 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
