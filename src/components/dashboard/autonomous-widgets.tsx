"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Calendar,
  Sparkles,
  Clock,
  Heart,
  Award,
  Zap,
  ShieldCheck,
  Loader2,
  ArrowRight,
  X,
  RefreshCw,
  HelpCircle,
  AlertCircle,
  Sliders,
  BookOpen
} from "lucide-react";
import { formatDeadline } from "@/lib/utils";
import { FocusSessionTimer } from "./focus-session-timer";
import { CustomCharts } from "./custom-charts";
import { triggerConfetti } from "@/components/shared/confetti-canvas";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Task } from "@/types/app.types";
import type { DashboardData } from "@/lib/ai/dashboard-service";

interface AutonomousWidgetsProps {
  dashboardData: DashboardData;
  tasks: Task[];
  userId: string;
  onRefresh?: () => void;
}

interface SimulationResult {
  current_completion_probability: number;
  simulated_completion_probability: number;
  current_deadline_risk: string;
  simulated_deadline_risk: string;
  recovery_probability: number;
  workload_impact: string;
  affected_tasks: string[];
  suggested_alternative: string;
  expected_completion_date: string;
  reasoning: string;
}

interface DailyDebriefData {
  summary: string;
  best_achievement: string;
  tomorrow_probability: number;
  tomorrow_priorities: string[];
  improvements: string[];
  missed_opportunities: string[];
  metrics: {
    completion_rate: number;
    focus_time_minutes: number;
    productivity_score: number;
    current_streak: number;
  };
}

interface WeeklyReflectionData {
  start_date: string;
  end_date: string;
  reflection_text: string;
  coaching_advice: string;
  weekly_wins: string[];
  suggested_changes: string[];
  metrics: {
    completion_rate: number;
    best_working_day: string;
    best_working_hours: string;
    most_delayed_category: string;
  };
}

export function AutonomousWidgets({
  dashboardData,
  tasks,
  userId,
  onRefresh,
}: AutonomousWidgetsProps) {
  const router = useRouter();
  const [completedMicro, setCompletedMicro] = useState<Record<string, boolean>>({});

  // Simulation State
  const [simulationScenario, setSimulationScenario] = useState("");
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Debrief & Reflection State
  const [debriefTab, setDebriefTab] = useState<"daily" | "weekly">("daily");
  const [dailyDebrief, setDailyDebrief] = useState<DailyDebriefData | null>(null);
  const [weeklyReflection, setWeeklyReflection] = useState<WeeklyReflectionData | null>(null);
  const [isLoadingDebrief, setIsLoadingDebrief] = useState(false);

  // Rescue Mode State
  const [isDeactivatingRescue, setIsDeactivatingRescue] = useState(false);

  const {
    stats,
    nextBestAction,
    executionTimeline,
    upcomingDeadlines,
    productivityScore,
    completionProbability,
    burnoutScore,
    recentActivity,
    chartAnalytics,
    rescuePlan
  } = dashboardData;

  const pendingTasks = tasks.filter((t) => t.status !== "done");

  // Load debrief on tab switch or mount
  useEffect(() => {
    fetchDebriefData();
  }, [debriefTab]);

  const fetchDebriefData = async (forceGenerate = false) => {
    setIsLoadingDebrief(true);
    try {
      if (debriefTab === "daily") {
        const url = `/api/ai/debrief?type=daily&date=${new Date().toISOString().split("T")[0]}`;
        const res = await fetch(forceGenerate ? "/api/ai/debrief" : url, {
          method: forceGenerate ? "POST" : "GET",
          headers: { "Content-Type": "application/json" },
          body: forceGenerate ? JSON.stringify({ type: "daily" }) : undefined,
        });
        const data = await res.json();
        if (data.debrief) {
          setDailyDebrief(data.debrief);
        }
      } else {
        const url = `/api/ai/debrief?type=weekly`;
        const res = await fetch(forceGenerate ? "/api/ai/debrief" : url, {
          method: forceGenerate ? "POST" : "GET",
          headers: { "Content-Type": "application/json" },
          body: forceGenerate ? JSON.stringify({ type: "weekly" }) : undefined,
        });
        const data = await res.json();
        if (data.reflection) {
          setWeeklyReflection(data.reflection);
        }
      }
    } catch (err) {
      console.error("Error loading debrief/reflection:", err);
      toast.error("Failed to fetch AI insights.");
    } finally {
      setIsLoadingDebrief(false);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulationScenario.trim()) return;

    setIsSimulating(true);
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: simulationScenario }),
      });
      const data = await res.json();
      if (data.simulation) {
        setSimulationResult(data.simulation);
        toast.success("Simulation complete! Analysis loaded.");
      } else {
        toast.error("Simulation failed. Try rephrasing.");
      }
    } catch (err) {
      toast.error("Failed to connect to simulation core.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDeactivateRescue = async () => {
    setIsDeactivatingRescue(true);
    try {
      const res = await fetch("/api/ai/rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Rescue Mode deactivated. Standard schedule resumed.");
        router.refresh();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      toast.error("Failed to deactivate Rescue Mode.");
    } finally {
      setIsDeactivatingRescue(false);
    }
  };

  // Heatmap generation using the live tasks array (14-day timeline)
  const getHeatmapData = () => {
    const data = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const targetDateStr = targetDate.toISOString().split("T")[0];
      const count = tasks.filter((t) => {
        if (!t.deadline) return false;
        return t.deadline.startsWith(targetDateStr) && t.status !== "done";
      }).length;

      data.push({
        date: targetDate,
        count,
        label: targetDate.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
      });
    }
    return data;
  };

  const heatmap = getHeatmapData();

  // Smart Coach micro-tasks
  const coachMicroTasks = [
    "Open your primary focus mission",
    "Define your immediate next 5-minute milestone",
    "Launch a focus timer session to lock in momentum",
  ];

  // Dynamic workload pills
  let workloadStatus = "Balanced";
  let workloadColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";

  if (burnoutScore.score > 75) {
    workloadStatus = "Overloaded";
    workloadColor = "text-red-400 border-red-500/20 bg-red-500/5";
  } else if (burnoutScore.score > 45) {
    workloadStatus = "High";
    workloadColor = "text-orange-400 border-orange-500/20 bg-orange-500/5";
  }

  const handleMicroWinCheck = (index: number) => {
    const key = `${index}`;
    const isNowDone = !completedMicro[key];
    setCompletedMicro((prev) => ({ ...prev, [key]: isNowDone }));

    if (isNowDone) {
      triggerConfetti();
      toast.success("Micro-win logged! momentum boost gained.");
    }
  };

  // Critical deadlines warning (within 12 hours)
  const missedDeadlines = pendingTasks.filter((t) => {
    if (!t.deadline) return false;
    const hoursLeft = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft < 12;
  });

  return (
    <div className="space-y-6">
      
      {/* 1. RESCUE MODE EMERGENCY PANEL */}
      <AnimatePresence>
        {rescuePlan && rescuePlan.is_active && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-2xl border relative overflow-hidden p-6"
            style={{
              background: "linear-gradient(135deg, oklch(0.14 0.03 12 / 0.4), oklch(0.1 0.01 280 / 0.3))",
              borderColor: "oklch(0.4 0.1 15 / 0.4)",
              boxShadow: "0 0 30px oklch(0.3 0.1 15 / 0.1)",
            }}
          >
            <div className="absolute top-0 left-0 h-1 bg-red-500 w-full animate-pulse" />
            
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest text-red-400">
                    AI Deadline Rescue Mode Active
                  </span>
                </div>
                <h2 className="text-lg font-black text-neutral-100 leading-snug">
                  Emergency protocol initiated. We have paused non-essential tasks to focus entirely on your critical deadline.
                </h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="bg-neutral-950/40 p-2.5 rounded-xl border border-red-950">
                    <span className="text-[10px] text-neutral-500 font-bold block uppercase">Hours Left</span>
                    <span className="text-sm font-black text-red-400">{rescuePlan.hours_remaining.toFixed(1)} hrs</span>
                  </div>
                  <div className="bg-neutral-950/40 p-2.5 rounded-xl border border-red-950">
                    <span className="text-[10px] text-neutral-500 font-bold block uppercase">Risk Level</span>
                    <span className="text-sm font-black text-red-500 uppercase">{rescuePlan.current_risk}</span>
                  </div>
                  <div className="bg-neutral-950/40 p-2.5 rounded-xl border border-red-950">
                    <span className="text-[10px] text-neutral-500 font-bold block uppercase">Est. Completion</span>
                    <span className="text-xs font-bold text-neutral-300">
                      {rescuePlan.estimated_finish_time ? new Date(rescuePlan.estimated_finish_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                    </span>
                  </div>
                  <div className="bg-neutral-950/40 p-2.5 rounded-xl border border-red-950">
                    <span className="text-[10px] text-neutral-500 font-bold block uppercase">Focus Blocks</span>
                    <span className="text-sm font-black text-violet-400">{rescuePlan.remaining_focus_sessions} sessions</span>
                  </div>
                </div>
              </div>

              {/* Probabilities Comparison dial */}
              <div className="flex flex-col items-center gap-3 shrink-0 bg-neutral-950/30 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <span className="text-2xl font-black text-red-500">{rescuePlan.completion_probability}%</span>
                    <span className="text-[9px] text-neutral-500 font-bold block">ORIGINAL PROB.</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-600" />
                  <div className="text-center">
                    <span className="text-2xl font-black text-emerald-400 animate-pulse">{rescuePlan.recovery_probability}%</span>
                    <span className="text-[9px] text-neutral-500 font-bold block">RESCUE PLAN</span>
                  </div>
                </div>

                <button
                  onClick={handleDeactivateRescue}
                  disabled={isDeactivatingRescue}
                  className="w-full mt-2 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs py-2 px-3 rounded-lg font-bold border border-white/10 flex items-center justify-center gap-2 transition-all"
                >
                  {isDeactivatingRescue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Deactivate Rescue Mode
                </button>
              </div>
            </div>

            {/* Emergency Steps Timeline */}
            {rescuePlan.emergency_action_plan && rescuePlan.emergency_action_plan.length > 0 && (
              <div className="mt-5 border-t border-red-950 pt-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Emergency Action Steps</h4>
                <div className="flex flex-wrap gap-2.5">
                  {rescuePlan.emergency_action_plan.map((step: any, sIdx: number) => {
                    const isFocus = step.type === "focus";
                    const bgClass = isFocus ? "bg-red-950/20 border-red-900/40 text-red-300" : "bg-neutral-950/40 border-neutral-800 text-neutral-400";
                    return (
                      <div key={sIdx} className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-xs ${bgClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isFocus ? "bg-red-500 animate-pulse" : "bg-neutral-600"}`} />
                        <span className="font-bold">{step.step}</span>
                        <span className="opacity-60">({step.duration}m)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic AI Brief & Predictions Header Bar */}
      <div
        className="rounded-2xl p-5 border relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
        style={{
          background: "linear-gradient(135deg, var(--surface), oklch(0.12 0.015 280 / 0.25))",
          borderColor: "var(--border-strong)",
        }}
      >
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
              Clutch AI Daily Brief
            </span>
          </div>
          <h3 className="text-sm font-extrabold text-neutral-100 leading-relaxed">
            {pendingTasks.length > 0
              ? `You have ${pendingTasks.length} missions active. Your workload is ${workloadStatus.toLowerCase()} with a ${completionProbability.average}% average completion probability.`
              : "All clear! You have no active missions. Draft a new milestone in Mission Control to unlock your productivity roadmap!"}
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            <strong>Prediction:</strong> {completionProbability.predictionText}
          </p>
        </div>

        {/* Workload Pill & Probability Dial */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
              Workload Status
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${workloadColor}`}>
              {workloadStatus}
            </span>
          </div>

          <div className="h-10 w-px bg-neutral-800" />

          <div className="flex flex-col gap-1 items-end">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
              Success Probability
            </span>
            <span className="text-sm font-black text-violet-400">
              {completionProbability.average}%
            </span>
          </div>
        </div>
      </div>

      {/* CUSTOM ANIMATED SVG CHARTS VIEW (Real DB values, NO placeholders) */}
      <CustomCharts analytics={chartAnalytics} />

      {/* 2. TABBED DAILY DEBRIEF & WEEKLY REFLECTION GLASS CARD */}
      <div
        className="rounded-2xl border overflow-hidden p-5 flex flex-col gap-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20">
              <BookOpen className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-100">AI Reflections & Debriefs</h3>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Personalized Companion Insights</p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-900 self-start sm:self-auto">
            <button
              onClick={() => setDebriefTab("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${debriefTab === "daily" ? "bg-violet-500 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              Daily Debrief
            </button>
            <button
              onClick={() => setDebriefTab("weekly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${debriefTab === "weekly" ? "bg-violet-500 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              Weekly Reflection
            </button>
          </div>
        </div>

        {isLoadingDebrief ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            <span className="text-xs text-neutral-400 italic">Consulting memory and compiling debrief...</span>
          </div>
        ) : (
          <div>
            {debriefTab === "daily" ? (
              dailyDebrief ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div className="bg-white/5 p-4 rounded-xl border border-neutral-900">
                        <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest block mb-1">Clutch Companion Executive Summary</span>
                        <p className="text-xs text-neutral-200 leading-relaxed font-medium">"{dailyDebrief.summary}"</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dailyDebrief.tomorrow_priorities && dailyDebrief.tomorrow_priorities.length > 0 && (
                          <div className="bg-neutral-950/40 p-3.5 rounded-xl border border-neutral-900">
                            <span className="text-[9px] font-black text-neutral-500 uppercase block mb-2">Tomorrow's Priorities</span>
                            <ul className="space-y-1.5">
                              {dailyDebrief.tomorrow_priorities.map((item, idx) => (
                                <li key={idx} className="text-xs text-neutral-300 flex items-center gap-2">
                                  <span className="w-1 h-1 rounded-full bg-violet-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {dailyDebrief.improvements && dailyDebrief.improvements.length > 0 && (
                          <div className="bg-neutral-950/40 p-3.5 rounded-xl border border-neutral-900">
                            <span className="text-[9px] font-black text-neutral-500 uppercase block mb-2">AI Growth Suggestions</span>
                            <ul className="space-y-1.5">
                              {dailyDebrief.improvements.map((item, idx) => (
                                <li key={idx} className="text-xs text-neutral-300 flex items-center gap-2">
                                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metrics sidebar */}
                    <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-4 flex flex-col justify-between gap-4">
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase block mb-3">Key Metrics Today</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 bg-white/5 rounded-lg">
                            <span className="text-xl font-black text-neutral-100">{dailyDebrief.metrics.completion_rate}%</span>
                            <span className="text-[8px] text-neutral-500 font-bold block uppercase">Completion</span>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded-lg">
                            <span className="text-xl font-black text-neutral-100">{dailyDebrief.metrics.focus_time_minutes}m</span>
                            <span className="text-[8px] text-neutral-500 font-bold block uppercase">Focus Time</span>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded-lg">
                            <span className="text-xl font-black text-violet-400">{dailyDebrief.metrics.productivity_score}</span>
                            <span className="text-[8px] text-neutral-500 font-bold block uppercase">Productivity Score</span>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded-lg">
                            <span className="text-xl font-black text-orange-400">{dailyDebrief.metrics.current_streak}d</span>
                            <span className="text-[8px] text-neutral-500 font-bold block uppercase">Streak</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-neutral-900 pt-3">
                        <span className="text-[9px] font-black text-neutral-500 uppercase block mb-1">Tomorrow's Prediction</span>
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4" /> {dailyDebrief.tomorrow_probability}% Success Probability
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-900 pt-3">
                    <span className="text-[10px] text-neutral-500 italic">Best achievement: <strong>{dailyDebrief.best_achievement}</strong></span>
                    <button
                      onClick={() => fetchDebriefData(true)}
                      className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1.5 bg-violet-500/5 px-2.5 py-1 rounded-lg border border-violet-500/10 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate Debrief
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <p className="text-xs text-neutral-500 italic">No Daily Debrief logged for today yet. Generate one now!</p>
                  <button
                    onClick={() => fetchDebriefData(true)}
                    className="bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    Generate Daily Debrief
                  </button>
                </div>
              )
            ) : (
              weeklyReflection ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div className="bg-white/5 p-4 rounded-xl border border-neutral-900">
                        <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest block mb-1">Weekly Coach Report</span>
                        <p className="text-xs text-neutral-200 leading-relaxed font-medium whitespace-pre-line">{weeklyReflection.reflection_text}</p>
                      </div>

                      <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-900">
                        <span className="text-[9px] font-black text-neutral-500 uppercase block mb-2">Weekly Wins</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {weeklyReflection.weekly_wins && weeklyReflection.weekly_wins.map((win, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-neutral-900 p-2 rounded-lg border border-neutral-800/60 text-xs">
                              <Award className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-neutral-300 font-bold">{win}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Metrics sidebar */}
                    <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-4 flex flex-col justify-between gap-4">
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase block mb-3">Weekly Averages</span>
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500">Completion Rate</span>
                            <span className="font-black text-neutral-200">{weeklyReflection.metrics.completion_rate}%</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500">Best Working Day</span>
                            <span className="font-black text-violet-400">{weeklyReflection.metrics.best_working_day}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500">Peak Focus Hours</span>
                            <span className="font-black text-violet-400">{weeklyReflection.metrics.best_working_hours}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500">Bottleneck Area</span>
                            <span className="font-black text-rose-400">{weeklyReflection.metrics.most_delayed_category}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-neutral-900 pt-3">
                        <span className="text-[9px] font-black text-neutral-500 uppercase block mb-1">AI Coaching Strategy</span>
                        <p className="text-[11px] text-neutral-300 leading-relaxed italic">"{weeklyReflection.coaching_advice}"</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-900 pt-3">
                    <span className="text-[10px] text-neutral-500">Date range: {weeklyReflection.start_date} to {weeklyReflection.end_date}</span>
                    <button
                      onClick={() => fetchDebriefData(true)}
                      className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1.5 bg-violet-500/5 px-2.5 py-1 rounded-lg border border-violet-500/10 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate Reflection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <p className="text-xs text-neutral-500 italic">No Weekly Reflection compiled yet. Compile your weekly stats now!</p>
                  <button
                    onClick={() => fetchDebriefData(true)}
                    className="bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    Compile Weekly Reflection
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* CORE 3-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* COLUMN 1: Next Best Action, What-If Simulator & Burnout */}
        <div className="flex flex-col gap-5">
          
          {/* Next Best Action Widget */}
          <div
            className="rounded-2xl p-5 border relative overflow-hidden flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Next Best Action
                </h3>
              </div>
              <span className="text-[9px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">
                AI Direct Focus
              </span>
            </div>

            {nextBestAction.task ? (
              <div className="flex flex-col gap-3.5">
                <div>
                  <h4 className="text-sm font-extrabold text-neutral-100 leading-snug">
                    {nextBestAction.task.title}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {nextBestAction.reason}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-500 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {nextBestAction.task.estimated_duration || 30} mins
                  </span>
                  <span className="font-bold text-violet-400">
                    Score: {nextBestAction.task.priority_score || 80}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-neutral-500 leading-relaxed">
                No active tasks! All missions completed. Type in Mission Control to declare your next strategic goals.
              </p>
            )}
          </div>

          {/* 3. WHAT-IF DECISION SIMULATOR PANEL */}
          <div
            className="rounded-2xl p-5 border flex flex-col gap-4 relative overflow-hidden"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Sliders className="w-16 h-16 text-violet-400" />
            </div>
            
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                What-If Decision Simulator
              </h3>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Hypothesize decisions (e.g. postponing a milestone, skipping focus) to instantly model risk and probability shifts without writing to the database.
            </p>

            <form onSubmit={handleSimulate} className="flex gap-2">
              <input
                type="text"
                placeholder="What if I postpone my math study by 2 days?"
                value={simulationScenario}
                onChange={(e) => setSimulationScenario(e.target.value)}
                disabled={isSimulating}
                className="flex-1 bg-neutral-950 text-xs px-3 py-2 rounded-xl border border-neutral-850 focus:border-violet-500 outline-none placeholder-neutral-600 transition-all text-neutral-200"
              />
              <button
                type="submit"
                disabled={isSimulating || !simulationScenario.trim()}
                className="bg-violet-500 hover:bg-violet-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center justify-center"
              >
                {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Simulate"}
              </button>
            </form>

            <AnimatePresence>
              {simulationResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-3.5 space-y-3 relative overflow-hidden"
                >
                  <button
                    onClick={() => setSimulationResult(null)}
                    className="absolute top-2.5 right-2.5 text-neutral-600 hover:text-neutral-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex justify-between border-b border-neutral-900 pb-2">
                    <div>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase block">Completion Shift</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-bold text-neutral-400">{simulationResult.current_completion_probability}%</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600" />
                        <span className={`text-xs font-black ${simulationResult.simulated_completion_probability >= simulationResult.current_completion_probability ? "text-emerald-400" : "text-red-400"}`}>
                          {simulationResult.simulated_completion_probability}%
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase block">Deadline Risk</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-neutral-400">{simulationResult.current_deadline_risk}</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600" />
                        <span className="text-[10px] font-black text-red-500 uppercase">{simulationResult.simulated_deadline_risk}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] text-neutral-500 font-bold block uppercase">Load Impact</span>
                      <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold inline-block mt-0.5">
                        {simulationResult.workload_impact}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-violet-400 font-bold block uppercase">AI Simulator Reasoning</span>
                    <p className="text-[11px] text-neutral-300 leading-relaxed font-medium">
                      "{simulationResult.reasoning}"
                    </p>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg">
                    <span className="text-[9px] text-emerald-400 font-bold block uppercase">Mitigation Alternative</span>
                    <p className="text-[11px] text-neutral-300 leading-relaxed font-medium mt-0.5">
                      {simulationResult.suggested_alternative}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Burnout Stress Engine */}
          <div
            className="rounded-2xl p-5 border flex flex-col gap-3"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Burnout Stress Engine
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold">Bio-Load</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xl font-black text-neutral-100">{burnoutScore.score}%</span>
                <p className="text-[10px] text-neutral-500 uppercase font-bold mt-0.5">Stress Level</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-white/5 ${burnoutScore.color}`}>
                {burnoutScore.level}
              </span>
            </div>

            {/* Stress thermometer bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${burnoutScore.score}%` }}
              />
            </div>

            <p className="text-[10px] text-neutral-400 leading-relaxed bg-white/5 p-2 rounded-xl border border-neutral-900">
              {burnoutScore.advice}
            </p>
          </div>

          {/* Potential Missed Deadlines Warning */}
          {missedDeadlines.length > 0 && (
            <div
              className="rounded-2xl p-5 border border-red-500/20 bg-red-500/5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider">
                  Critical Deadline Risk
                </h4>
              </div>
              <ul className="flex flex-col gap-2.5">
                {missedDeadlines.map((t) => (
                  <li key={t.id} className="text-xs text-red-300 flex flex-col gap-0.5 leading-relaxed bg-red-500/5 p-2 rounded-xl border border-red-500/10">
                    <span className="font-bold">{t.title}</span>
                    <span className="text-[10px] opacity-85">
                      Due in less than 12 hours: {formatDeadline(t.deadline!)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Workload Heatmap */}
          <div
            className="rounded-2xl p-5 border flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-orange-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Workload Heatmap
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500">Peak loads</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {heatmap.map((day, hIdx) => {
                const count = day.count;
                const colorClass =
                  count === 0
                    ? "bg-white/5 border-white/5 hover:bg-white/10"
                    : count === 1
                    ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                    : count === 2
                    ? "bg-orange-500/30 border-orange-500/40 text-orange-300"
                    : "bg-red-500/40 border-red-500/50 text-red-200";

                return (
                  <div
                    key={hIdx}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${colorClass}`}
                    title={`${count} tasks due`}
                  >
                    <span className="text-[9px] opacity-60 font-medium">{day.label.split(" ")[0]}</span>
                    <span className="text-xs font-extrabold mt-0.5">{day.label.split(" ")[1]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Pomodoro Timer & Work Blocks Schedule */}
        <div className="flex flex-col gap-5">
          {/* Pomodoro Timer */}
          <FocusSessionTimer tasks={tasks} onSessionComplete={onRefresh} />

          {/* Time Block Work Planner */}
          <div
            className="rounded-2xl p-5 border flex flex-col gap-3.5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Execution Time Blocks
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500">Autonomous Schedule</span>
            </div>

            {executionTimeline && executionTimeline.length > 0 ? (
              <ul className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-1">
                {executionTimeline.map((block: string, bIdx: number) => (
                  <li
                    key={bIdx}
                    className="bg-white/5 border border-white/5 p-2.5 rounded-xl text-xs text-neutral-200 leading-relaxed flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5" />
                    <span>{block}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-neutral-500 leading-relaxed">
                Ask Clutch in Mission Control to draft your hour-blocked schedule!
              </p>
            )}
          </div>
        </div>

        {/* COLUMN 3: Productivity Gauge & Gamified Achievements */}
        <div className="flex flex-col gap-5">
          {/* Productivity Streaks Gauge */}
          <div
            className="rounded-2xl p-5 border flex flex-col items-center text-center gap-4 relative overflow-hidden"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="absolute left-3 top-3 flex items-center gap-1 bg-orange-500/5 border border-orange-500/15 px-2 py-0.5 rounded-full">
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-bounce" />
              <span className="text-[10px] font-extrabold text-orange-400">
                {stats.streak} Day Streak
              </span>
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 self-end">
              Productivity Engine
            </span>

            {/* Radial progress ring */}
            <div className="relative flex items-center justify-center h-28 w-28 my-2">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  className="stroke-neutral-800 fill-none"
                  strokeWidth="8"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  className="stroke-violet-500 fill-none"
                  strokeWidth="8"
                  strokeDasharray={301.6}
                  strokeDashoffset={301.6 - (301.6 * productivityScore.score) / 100}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-neutral-100">{productivityScore.score}</span>
                <span className="text-[9px] text-neutral-500 font-bold">OUT OF 100</span>
              </div>
            </div>

            <div className="w-full text-xs text-neutral-400 border-t pt-3 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span>Completed: <strong>{tasks.filter((t) => t.status === "done").length}/{tasks.length}</strong></span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" /> {productivityScore.status}
              </span>
            </div>
          </div>

          {/* Gamified Achievements milestone badges */}
          <div
            className="rounded-2xl p-5 border flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Mission Achievements
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold">3 Milestones</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { title: "Deep Focus", desc: "Focus 45m+", icon: Zap, color: "text-violet-400 bg-violet-500/5 border-violet-500/20" },
                { title: "Streak Hero", desc: "Streak active", icon: Flame, color: "text-orange-400 bg-orange-500/5 border-orange-500/20" },
                { title: "Secure Guard", desc: "No delays", icon: ShieldCheck, color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" },
              ].map((badge, bIdx) => {
                const Icon = badge.icon;
                return (
                  <motion.div
                    key={bIdx}
                    whileHover={{ scale: 1.05 }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-help ${badge.color}`}
                    title={badge.desc}
                  >
                    <Icon className="w-5 h-5 mb-1.5 animate-pulse" />
                    <span className="text-[9px] font-bold leading-tight text-neutral-200">{badge.title}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* AI Coach Card & Micro-tasks Checklist */}
          <div
            className="rounded-2xl p-5 border flex flex-col gap-4"
            style={{
              background: "linear-gradient(135deg, var(--surface), oklch(0.12 0.015 280 / 0.15))",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Clutch Smart Coach Card
              </h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed italic">
              "{burnoutScore.advice}"
            </p>

            <div className="border-t pt-3 space-y-2.5" style={{ borderColor: "var(--border)" }}>
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">
                Today's Micro-Wins Checklist
              </span>
              
              <ul className="flex flex-col gap-2">
                {coachMicroTasks.map((step: string, sIdx: number) => {
                  const isDone = completedMicro[`${sIdx}`] || false;
                  return (
                    <li
                      key={sIdx}
                      onClick={() => handleMicroWinCheck(sIdx)}
                      className="flex items-center gap-2 bg-neutral-950 border border-neutral-900 p-2 rounded-xl cursor-pointer hover:border-neutral-800 transition-all text-xs"
                    >
                      <button
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                          isDone ? "bg-violet-500 border-violet-500 text-white" : "border-neutral-700"
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3 h-3 text-white fill-current" />}
                      </button>
                      <span className={`leading-snug ${isDone ? "line-through opacity-40 text-neutral-500" : "text-neutral-300"}`}>
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
