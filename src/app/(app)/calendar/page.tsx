"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { Calendar as CalendarIcon, Clock, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { triggerConfetti } from "@/components/shared/confetti-canvas";
import { toast } from "sonner";
import type { Task } from "@/types/app.types";

interface ScheduledBlock {
  id: string;
  title: string;
  startHour: number; // e.g. 9 for 09:00
  duration: number; // in hours, e.g. 1.5
  priority: string;
  status: string;
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduledBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [settings, setSettings] = useState<{
    timezone: string;
    working_hours_start: string;
    working_hours_end: string;
  } | null>(null);
  
  const supabase = useMemo(() => createClient(), []);

  const formatHour = (hourDecimal: number) => {
    const hours = Math.floor(hourDecimal);
    const mins = hourDecimal % 1 === 0 ? "00" : "30";
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins} ${ampm}`;
  };

  const parseHour = (timeStr: string): number => {
    const cleaned = timeStr.trim();
    const match = cleaned.match(/^(\d+):(\d+)\s*(AM|PM|am|pm)?$/i);
    if (!match) return 9;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const modifier = match[3];
    
    if (modifier?.toLowerCase() === "pm" && hours < 12) {
      hours += 12;
    }
    if (modifier?.toLowerCase() === "am" && hours === 12) {
      hours = 0;
    }
    
    return hours + minutes / 60;
  };

  const loadTasksAndSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Fetch settings, tasks, and daily execution plan in parallel
      const [settingsRes, tasksRes, planRes] = await Promise.all([
        supabase.from("settings").select("timezone, working_hours_start, working_hours_end").eq("user_id", user.id).maybeSingle(),
        supabase.from("tasks").select("*").neq("status", "archived").order("priority_score", { ascending: false }),
        supabase.from("execution_plans").select("plan_data").eq("user_id", user.id).eq("plan_type", "daily").maybeSingle()
      ]);

      const userSettings = settingsRes.data || { timezone: "UTC", working_hours_start: "09:00", working_hours_end: "17:00" };
      setSettings(userSettings);

      const activeTasks: Task[] = tasksRes.data || [];
      setTasks(activeTasks);

      const planData = planRes.data?.plan_data as { today?: string[] } | null;

      // 2. Parse daily plan if present
      if (planData && Array.isArray(planData.today) && planData.today.length > 0) {
        const blocks: ScheduledBlock[] = [];
        planData.today.forEach((line, index) => {
          const match = line.match(/^(\d+:\d+\s*(?:AM|PM|am|pm))\s*-\s*(\d+:\d+\s*(?:AM|PM|am|pm)):\s*(.*)$/i);
          if (match) {
            const startStr = match[1];
            const endStr = match[2];
            const title = match[3].trim();
            
            const startHour = parseHour(startStr);
            const endHour = parseHour(endStr);
            const duration = Math.max(0.5, endHour - startHour);
            
            const matchedTask = activeTasks.find(t => 
              t.title.toLowerCase().includes(title.toLowerCase()) || 
              title.toLowerCase().includes(t.title.toLowerCase())
            );
            
            blocks.push({
              id: matchedTask?.id || `block-${index}`,
              title: title,
              startHour,
              duration,
              priority: matchedTask?.priority || "medium",
              status: matchedTask?.status || "todo"
            });
          }
        });
        setSchedule(blocks);
      } else {
        // Fallback: Generate mock blocks from tasks
        if (activeTasks.length > 0) {
          const initialSchedule: ScheduledBlock[] = [];
          let currentHour = parseHour(userSettings.working_hours_start || "09:00");
          
          activeTasks.slice(0, 4).forEach((t) => {
            const durationMins = t.estimated_duration || 60;
            const durationHours = Math.round((durationMins / 60) * 2) / 2 || 1;
            
            initialSchedule.push({
              id: t.id,
              title: t.title,
              startHour: currentHour,
              duration: durationHours,
              priority: t.priority,
              status: t.status,
            });
            currentHour += durationHours + 0.5;
          });
          setSchedule(initialSchedule);
        } else {
          setSchedule([]);
        }
      }
    } catch (err: any) {
      console.error("[Calendar] Error loading tasks/schedule:", err.message);
      toast.error("Failed to load planner schedule.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadTasksAndSchedule();
  }, [loadTasksAndSchedule]);

  // AI Auto-Scheduling Trigger
  const handleAutoSchedule = async () => {
    setScheduling(true);
    toast.info("Clutch AI is calculating non-overlapping work slots...");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Auto-schedule my current tasks into a balanced daily hour-blocked timeline. Return an execution plan.",
            },
          ],
          provider: "gemini",
        }),
      });

      if (res.ok) {
        await loadTasksAndSchedule();
        triggerConfetti();
        toast.success("AI auto-scheduling completed! Calendar optimized.");
      } else {
        throw new Error("API responded with an error");
      }
    } catch {
      toast.error("Auto-scheduling failed. Try again.");
    } finally {
      setScheduling(false);
    }
  };

  // Complete a task directly from the schedule
  const handleCompleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completion_percentage: 100 })
      .eq("id", taskId);

    if (!error) {
      setSchedule((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: "done" } : item))
      );
      triggerConfetti();
      toast.success("Task checked off! Celebration fired.");
      loadTasksAndSchedule();
    }
  };

  // Shift block times and persist to Supabase
  const shiftTime = async (blockId: string, hours: number) => {
    const startLimit = settings ? parseHour(settings.working_hours_start) : 8;
    const endLimit = settings ? parseHour(settings.working_hours_end) : 19;

    const updatedSchedule = schedule.map((item) => {
      if (item.id === blockId) {
        const newStart = Math.min(Math.max(item.startHour + hours, startLimit), endLimit);
        return { ...item, startHour: newStart };
      }
      return item;
    });

    setSchedule(updatedSchedule);

    // Save updated execution plan lines
    const lines = updatedSchedule.map(item => 
      `${formatHour(item.startHour)} - ${formatHour(item.startHour + item.duration)}: ${item.title}`
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("execution_plans").upsert({
        user_id: user.id,
        plan_type: "daily",
        plan_data: { today: lines },
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id, plan_type" });
      
      toast.success("Task rescheduled! Timeline synchronized.");
    }
  };

  // Compile hourly slots for rendering
  const timeSlots = useMemo(() => {
    const slots = [];
    const start = settings ? parseHour(settings.working_hours_start) : 8;
    const end = settings ? parseHour(settings.working_hours_end) : 19;
    for (let i = start; i <= end; i += 0.5) {
      slots.push(i);
    }
    return slots;
  }, [settings]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">AI Daily Planner</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Optimize your day, adjust time blocks, and complete missions.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTasksAndSchedule}
            className="p-2 rounded-xl bg-white/5 border border-white/5 text-neutral-400 hover:text-white transition-all"
            title="Reload tasks"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleAutoSchedule}
            disabled={scheduling}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {scheduling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" />
                AI Auto-Schedule
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Daily timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="rounded-2xl p-5 border flex flex-col gap-4 overflow-hidden relative"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-violet-400" /> Today&apos;s Work Blocks
              </span>
              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-neutral-400 font-bold">
                {settings?.timezone || "UTC"}
              </span>
            </div>

            {/* Hourly Grid list */}
            <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
              {timeSlots.map((slot) => {
                const block = schedule.find(
                  (item) => slot >= item.startHour && slot < item.startHour + item.duration
                );
                const isStart = block && slot === block.startHour;

                return (
                  <div key={slot} className="flex items-start gap-4 min-h-12 border-b border-neutral-900/40 py-1">
                    {/* Hour label */}
                    <span className="text-[9px] font-mono font-bold text-neutral-500 w-16 pt-0.5">
                      {slot % 1 === 0 ? formatHour(slot) : ""}
                    </span>

                    {/* Timeline Slot content */}
                    <div className="flex-1 relative min-h-8">
                      {block ? (
                        isStart && (
                          <motion.div
                            layoutId={`block-${block.id}`}
                            className={`absolute inset-x-0 top-0 rounded-xl p-3 border shadow-sm z-10 flex flex-col justify-between ${
                              block.status === "done"
                                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                                : block.priority === "critical"
                                ? "bg-red-500/5 border-red-500/25 text-neutral-200"
                                : block.priority === "high"
                                ? "bg-orange-500/5 border-orange-500/25 text-neutral-200"
                                : "bg-neutral-900/80 border-neutral-800 text-neutral-200"
                            }`}
                            style={{
                              height: `${block.duration * 48}px`,
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className={`text-xs font-bold leading-tight ${block.status === "done" ? "line-through opacity-50" : ""}`}>
                                  {block.title}
                                </h4>
                                <span className="text-[9px] text-neutral-400 flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" /> {formatHour(block.startHour)} - {formatHour(block.startHour + block.duration)}
                                </span>
                              </div>

                              {block.status !== "done" && !block.id.startsWith("block-") && (
                                <button
                                  onClick={() => handleCompleteTask(block.id)}
                                  className="w-5 h-5 rounded-md flex items-center justify-center bg-white/5 border border-white/10 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all cursor-pointer"
                                >
                                  ✓
                                </button>
                              )}
                            </div>

                            {/* Rescheduling Shifts */}
                            {block.status !== "done" && (
                              <div className="flex justify-end gap-1.5 pt-2">
                                <button
                                  onClick={() => shiftTime(block.id, -0.5)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 hover:text-white"
                                >
                                  -30m
                                </button>
                                <button
                                  onClick={() => shiftTime(block.id, 0.5)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 hover:text-white"
                                >
                                  +30m
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )
                      ) : (
                        <div className="h-full w-full border border-dashed border-neutral-900 rounded-xl hover:border-neutral-800 transition-all min-h-8" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Task Queue lists */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-5 border flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Unscheduled Mission Queue
            </h3>

            <div className="flex flex-col gap-2.5 max-h-[440px] overflow-y-auto pr-1">
              {tasks
                .filter((t) => !schedule.some((s) => s.id === t.id) && t.status !== "done")
                .map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 flex flex-col gap-1.5"
                  >
                    <span className="text-xs font-bold text-neutral-200">{task.title}</span>
                    <div className="flex items-center justify-between text-[9px] text-neutral-500">
                      <span>⏱️ {task.estimated_duration || 45} mins</span>
                      <span className={`font-bold uppercase ${
                        task.priority === "critical" ? "text-red-400" :
                        task.priority === "high" ? "text-orange-400" : "text-neutral-400"
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
