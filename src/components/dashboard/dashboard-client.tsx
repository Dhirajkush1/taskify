"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Play,
  MessageSquare,
  User,
  Check,
  Send,
  HelpCircle,
  Bell
} from "lucide-react";
import { triggerConfetti } from "@/components/shared/confetti-canvas";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DashboardCharts } from "./dashboard-charts";
import { FocusSessionTimer } from "./focus-session-timer";

interface DashboardClientProps {
  user: any;
  profile: any;
  dashboardData: any;
  personalTasks: any[];
  projectTasks: any[];
  goalTasks: any[];
  goals: any[];
  habits: any[];
  calendarEvents: any[];
  focusSessions: any[];
  reminders: any[];
}

export function DashboardClient({
  user,
  profile,
  dashboardData,
  personalTasks,
  projectTasks,
  goalTasks,
  goals,
  habits,
  calendarEvents,
  focusSessions,
  reminders
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // Local state
  const [completedMicroWins, setCompletedMicroWins] = useState<Record<number, boolean>>({});
  const [activeFocusMode, setActiveFocusMode] = useState(false);
  
  // What-If Scenario State
  const [whatIfInput, setWhatIfInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // ChatGPT-style Reflections state
  const [reflectionsTab, setReflectionsTab] = useState<"daily" | "weekly">("daily");
  const [reflectionsChat, setReflectionsChat] = useState<Array<{ sender: "user" | "clutch"; text: string }>>([
    {
      sender: "clutch",
      text: "Hello! I am compiling your daily reflections. Type a query, or choose a debrief summary option below."
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Smart Coach State
  const [coachChoice, setCoachChoice] = useState<"pending" | "accepted" | "ignored" | "rescheduled">("pending");
  const [habitsList, setHabitsList] = useState<any[]>(habits);
  const [checkingHabitId, setCheckingHabitId] = useState<string | null>(null);

  // Stats calculation
  const allTasks = [...personalTasks, ...projectTasks, ...goalTasks];
  const pendingTasks = allTasks.filter(t => t.status !== "done");
  const completedToday = allTasks.filter(t => {
    if (t.status !== "done" || !t.updated_at) return false;
    return new Date(t.updated_at).toDateString() === new Date().toDateString();
  }).length;

  const totalFocusSessionsToday = focusSessions.filter(s => {
    if (s.status !== "completed" || !s.created_at) return false;
    return new Date(s.created_at).toDateString() === new Date().toDateString();
  }).length;

  const todayEvents = calendarEvents.filter(e => {
    return new Date(e.start_time).toDateString() === new Date().toDateString();
  });

  // Reminders Companion Engine Stats Calculations
  const todayStr = new Date().toDateString();
  const nowTime = new Date();
  
  const upcomingTodayReminders = reminders.filter(r => {
    const due = new Date(r.due_at || r.reminder_time);
    return due.toDateString() === todayStr && (r.status === "pending" || r.status === "scheduled") && due > nowTime;
  }).length;

  const overdueReminders = reminders.filter(r => {
    const due = new Date(r.due_at || r.reminder_time);
    return due < nowTime && r.status !== "completed" && r.status !== "dismissed";
  }).length;

  const deliveredTodayReminders = reminders.filter(r => {
    const due = new Date(r.due_at || r.reminder_time);
    return due.toDateString() === todayStr && r.status === "delivered";
  }).length;

  // Next Scheduled
  const sortedUpcoming = reminders
    .filter(r => {
      const due = new Date(r.due_at || r.reminder_time);
      return (r.status === "pending" || r.status === "scheduled") && due > nowTime;
    })
    .sort((a, b) => new Date(a.due_at || a.reminder_time).getTime() - new Date(b.due_at || b.reminder_time).getTime());

  const nextReminder = sortedUpcoming[0] || null;
  const nextReminderTitle = nextReminder ? nextReminder.title : "None Scheduled";
  const nextReminderTime = nextReminder
    ? new Date(nextReminder.due_at || nextReminder.reminder_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  // Last Delivered
  const sortedDelivered = reminders
    .filter(r => r.status === "delivered" && r.delivered_at)
    .sort((a, b) => new Date(b.delivered_at || b.due_at).getTime() - new Date(a.delivered_at || a.due_at).getTime());

  const lastDelivered = sortedDelivered[0] || null;
  const lastDeliveredTitle = lastDelivered ? lastDelivered.title : "None Yet";
  const lastDeliveredTime = lastDelivered
    ? new Date(lastDelivered.delivered_at || lastDelivered.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] || "Dhiraj";

  // Timeline list for the right sidebar hero card
  const todayTimelineList = [
    ...todayEvents.map(e => ({
      time: new Date(e.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: new Date(e.start_time).getTime(),
      title: e.title,
      type: "meeting"
    })),
    ...allTasks
      .filter(t => t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString())
      .map(t => ({
        time: new Date(t.deadline!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: new Date(t.deadline!).getTime(),
        title: t.title,
        type: "task"
      }))
  ].sort((a, b) => a.timestamp - b.timestamp);

  // Habits checking handler
  const handleCheckHabit = async (habitId: string, currentStreak: number, lastCompletedAt: string | null) => {
    setCheckingHabitId(habitId);
    try {
      const now = new Date();
      let newStreak = currentStreak;

      if (lastCompletedAt) {
        const lastDate = new Date(lastCompletedAt);
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          if (lastDate.toDateString() !== now.toDateString()) {
            newStreak = currentStreak + 1;
          }
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      const { error } = await supabase
        .from("habits")
        .update({
          streak: newStreak,
          last_completed_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq("id", habitId);

      if (!error) {
        triggerConfetti();
        toast.success("Habit Ring Updated!");
        // Update local list
        setHabitsList(prev =>
          prev.map(h =>
            h.id === habitId
              ? { ...h, streak: newStreak, last_completed_at: now.toISOString() }
              : h
          )
        );
        router.refresh();
      } else {
        toast.error("Failed to complete habit.");
      }
    } catch (e) {
      toast.error("Error logging habit check-in.");
    } finally {
      setCheckingHabitId(null);
    }
  };

  // What-If Simulation execution
  const runWhatIfSimulation = async (scenario: string) => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (data.simulation) {
        setSimulationResult(data.simulation);
        toast.success("Simulation modeling loaded!");
      } else {
        toast.error("Could not run simulation scenario.");
      }
    } catch (e) {
      toast.error("Failed to connect to AI simulation server.");
    } finally {
      setIsSimulating(false);
    }
  };

  // Conversational Reflection generator
  const triggerDebriefChat = async (type: "daily" | "weekly") => {
    setChatLoading(true);
    // Add user question bubble
    const userText = type === "daily" ? "Generate my Daily Debrief" : "Generate my Weekly Reflection";
    setReflectionsChat(prev => [...prev, { sender: "user", text: userText }]);

    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const url = type === "daily"
        ? `/api/ai/debrief?type=daily&date=${dateStr}`
        : `/api/ai/debrief?type=weekly`;

      const res = await fetch(url);
      const data = await res.json();
      
      let reply = "I couldn't compile your reflection files. Make sure you complete tasks to enable reflection maps.";
      if (type === "daily" && data.debrief) {
        reply = `**Daily Debrief Summary:**\n"${data.debrief.summary}"\n\n- **Wins Today:** ${data.debrief.best_achievement}\n- **Growth Focus:** ${data.debrief.improvements?.join(", ") || "Maintain general schedule"}\n- **Tomorrow Probability:** ${data.debrief.tomorrow_probability}% Success Chance`;
      } else if (type === "weekly" && data.reflection) {
        reply = `**Weekly Reflection Summary:**\n"${data.reflection.reflection_text}"\n\n- **Weekly Wins:** ${data.reflection.weekly_wins?.join(", ") || "Completed items logged"}\n- **Peak Working Hours:** ${data.reflection.metrics?.best_working_hours || "9AM - 12PM"}\n- **Coaching Directive:** ${data.reflection.coaching_advice}`;
      }

      setReflectionsChat(prev => [...prev, { sender: "clutch", text: reply }]);
    } catch (e) {
      setReflectionsChat(prev => [...prev, { sender: "clutch", text: "Error fetching data from database logs." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Smart Coach choices
  const handleCoachClick = (choice: "accepted" | "ignored" | "rescheduled") => {
    setCoachChoice(choice);
    if (choice === "accepted") {
      triggerConfetti();
      toast.success("Schedule updated automatically. Workout moved to 18:00.");
    } else if (choice === "ignored") {
      toast.info("Coach recommendation dismissed.");
    } else {
      toast.info("Rescheduled for tomorrow morning.");
    }
  };

  const productivityScore = dashboardData.productivityScore?.score || 82;
  const successPrediction = dashboardData.completionProbability?.average || 83;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      {/* Dynamic Focus Timer Modal Overlay */}
      <AnimatePresence>
        {activeFocusMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="relative max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-glow">
              <button
                onClick={() => setActiveFocusMode(false)}
                className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 p-1.5 rounded-full text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <FocusSessionTimer tasks={allTasks} onSessionComplete={() => { setActiveFocusMode(false); router.refresh(); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 1. HERO HEADER & GREETING SECTION */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div
          className="lg:col-span-2 rounded-3xl p-6 border flex flex-col justify-between relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, var(--surface) 0%, oklch(0.12 0.015 280 / 0.15) 100%)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-md)"
          }}
        >
          {/* Subtle design particles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl group-hover:bg-violet-500/10 transition-all duration-700" />
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                Productivity Engine V2
              </span>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-neutral-100 leading-tight">
                {greeting}, {firstName} 👋
              </h1>
              <p className="text-sm font-semibold text-neutral-400 max-w-xl">
                Today looks productive. You have completed <strong className="text-violet-400">{completedToday} tasks</strong> and <strong className="text-emerald-400">{totalFocusSessionsToday} focus blocks</strong>.
              </p>
            </div>

            {/* Quick Metrics Cards Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-neutral-950/40 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block">Focus Sessions</span>
                <span className="text-lg font-black text-violet-400">{totalFocusSessionsToday} / 3 Sessions</span>
              </div>
              <div className="bg-neutral-950/40 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block">Meetings</span>
                <span className="text-lg font-black text-emerald-400">{todayEvents.length} Meetings</span>
              </div>
              <div className="bg-neutral-950/40 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block">Tasks Due</span>
                <span className="text-lg font-black text-orange-400">{pendingTasks.length} Active</span>
              </div>
              <div className="bg-neutral-950/40 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block">Success Forecast</span>
                <span className="text-lg font-black text-violet-400">{successPrediction}% Prediction</span>
              </div>
            </div>
          </div>

          <div className="pt-6 flex items-center gap-3">
            <button
              onClick={() => setActiveFocusMode(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-black py-2.5 px-5 rounded-2xl border border-violet-500/20 shadow-glow-sm hover:scale-[1.02] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Deep Focus
            </button>
            <button
              onClick={() => router.push("/tasks")}
              className="bg-white/5 hover:bg-white/10 text-neutral-300 text-xs py-2.5 px-5 rounded-2xl border border-white/10 transition-all cursor-pointer"
            >
              Open Daily Planner
            </button>
          </div>
        </div>

        {/* Right side: Today's Timeline widget */}
        <div
          className="rounded-3xl p-5 border flex flex-col justify-between"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Today&apos;s Timeline</span>
            <span className="text-[10px] text-neutral-500 font-bold">Agenda</span>
          </div>

          {todayTimelineList.length > 0 ? (
            <div className="flex-1 overflow-y-auto max-h-[170px] pr-1 space-y-3 mt-3">
              {todayTimelineList.map((item, idx) => (
                <div key={idx} className="flex gap-3 text-xs items-start">
                  <span className="text-[10px] text-neutral-500 font-extrabold w-12 pt-0.5">{item.time}</span>
                  <div className="relative pl-3 border-l border-white/10 flex-1 min-w-0">
                    <span className={cn(
                      "absolute -left-1 top-1.5 w-2 h-2 rounded-full",
                      item.type === "meeting" ? "bg-emerald-400" : "bg-violet-400"
                    )} />
                    <span className="font-extrabold text-neutral-200 block truncate">{item.title}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-xs text-neutral-500 italic">
              No calendar events or deadlines scheduled for today.
            </div>
          )}

          <div className="border-t border-neutral-800 pt-3 text-[10px] text-neutral-500 font-semibold text-center">
            Timeline sync active (Local & Google)
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 2. DYNAMIC GAUGE STATS (Interactive KPI cards) */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Goal Completion Dial */}
        <div className="bg-neutral-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider">Goal Progress</span>
            <h3 className="text-xl font-black text-neutral-100">
              {goals.length > 0 ? Math.round(goals.reduce((acc, g) => acc + (g.completion_percentage || 0), 0) / goals.length) : 78}%
            </h3>
            <span className="text-[9px] text-neutral-500 font-bold block uppercase">Concentric Goals Average</span>
          </div>

          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="rgb(245, 158, 11)"
                strokeWidth="3.5"
                strokeDasharray="100 100"
                strokeDashoffset={100 - (goals.length > 0 ? Math.round(goals.reduce((acc, g) => acc + (g.completion_percentage || 0), 0) / goals.length) : 78)}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 2: Focus Time Area Graph */}
        <div className="bg-neutral-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider">Focus Time Today</span>
            <h3 className="text-xl font-black text-neutral-100">
              {(() => {
                const todayMins = focusSessions
                  .filter(s => s.status === "completed" && s.created_at && new Date(s.created_at).toDateString() === new Date().toDateString())
                  .reduce((acc, curr) => acc + (curr.completed_minutes || 0), 0);
                const hrs = Math.floor(todayMins / 60);
                const mins = todayMins % 60;
                return `${hrs}h ${mins}m`;
              })()}
            </h3>
            <span className="text-[9px] text-neutral-500 font-bold block uppercase">Visual Session Log</span>
          </div>

          {/* Mini Area SVG */}
          <div className="w-16 h-10 shrink-0">
            <svg viewBox="0 0 60 30" className="w-full h-full">
              <defs>
                <linearGradient id="miniAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16, 185, 1 emerald)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points="0,30 10,25 20,28 30,12 40,15 50,5 60,8 60,30" fill="url(#miniAreaGrad)" />
              <polyline fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2" points="0,25 10,25 20,28 30,12 40,15 50,5 60,8" />
            </svg>
          </div>
        </div>

        {/* KPI 3: Weekly Productivity Bar Graph */}
        <div className="bg-neutral-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider">Completed (7d)</span>
            <h3 className="text-xl font-black text-neutral-100">
              {allTasks.filter(t => {
                if (t.status !== "done" || !t.updated_at) return false;
                const diffTime = Math.abs(new Date().getTime() - new Date(t.updated_at).getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 7;
              }).length} Tasks
            </h3>
            <span className="text-[9px] text-neutral-500 font-bold block uppercase">Productivity bar curve</span>
          </div>

          {/* Mini Bar SVG */}
          <div className="w-14 h-10 shrink-0 flex items-end justify-between gap-0.5">
            {[4, 12, 8, 16, 10, 18, 14].map((barVal, bIdx) => (
              <div
                key={bIdx}
                className="w-1 bg-violet-500 rounded-t"
                style={{ height: `${(barVal / 18) * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* KPI 4: Completion Rate Gauge */}
        <div className="bg-neutral-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider">Completion Rate</span>
            <h3 className="text-xl font-black text-neutral-100">
              {allTasks.length > 0 ? Math.round((allTasks.filter(t => t.status === "done").length / allTasks.length) * 100) : 92}%
            </h3>
            <span className="text-[9px] text-neutral-500 font-bold block uppercase">Linear gauge index</span>
          </div>

          {/* Mini Gauge SVG */}
          <div className="relative w-14 h-8 shrink-0 flex justify-center items-end">
            <svg viewBox="0 0 36 18" className="w-full h-full">
              <path d="M3,18 A15,15 0 0,1 33,18" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3.5" />
              <path
                d="M3,18 A15,15 0 0,1 33,18"
                fill="none"
                stroke="rgb(139, 92, 246)"
                strokeWidth="4"
                strokeDasharray="47.1"
                strokeDashoffset={47.1 - (47.1 * (allTasks.length > 0 ? (allTasks.filter(t => t.status === "done").length / allTasks.length) : 0.92))}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Reminder Companion Engine Card */}
      <div className="bg-neutral-900/40 p-5 rounded-3xl border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-violet-400 animate-bounce" style={{ animationDuration: '3s' }} />
            <div>
              <h3 className="text-sm font-black text-neutral-200">Reminder Companion Engine</h3>
              <p className="text-[10px] text-neutral-500 font-bold uppercase">Real-time Scheduler Status</p>
            </div>
          </div>
          <Link href="/reminders" className="text-[10px] font-black text-violet-400 hover:text-violet-300 uppercase tracking-wider">
            Open Reminder Center &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-neutral-950/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Upcoming Today</span>
            <span className="text-xl font-black text-violet-400 mt-1">{upcomingTodayReminders} Reminders</span>
          </div>
          <div className="bg-neutral-950/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Overdue (Missed)</span>
            <span className={cn("text-xl font-black mt-1", overdueReminders > 0 ? "text-rose-400" : "text-neutral-400")}>
              {overdueReminders} Overdue
            </span>
          </div>
          <div className="bg-neutral-950/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Delivered Today</span>
            <span className="text-xl font-black text-emerald-400 mt-1">{deliveredTodayReminders} Sent</span>
          </div>
          <div className="bg-neutral-950/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Next Scheduled</span>
            <span className="text-xs font-black text-neutral-200 truncate mt-1.5" title={nextReminderTitle}>
              {nextReminderTitle}
            </span>
            {nextReminderTime && (
              <span className="text-[9px] text-violet-400 font-bold block uppercase mt-0.5">{nextReminderTime}</span>
            )}
          </div>
          <div className="bg-neutral-950/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Last Delivered</span>
            <span className="text-xs font-black text-neutral-300 truncate mt-1.5" title={lastDeliveredTitle}>
              {lastDeliveredTitle}
            </span>
            {lastDeliveredTime && (
              <span className="text-[9px] text-emerald-400 font-bold block uppercase mt-0.5">{lastDeliveredTime}</span>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 3. CORE 3-COLUMN LAYOUT */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* COLUMN 1: AI COMMAND, DISCUSSIONS & SIMULATORS */}
        <div className="space-y-6 flex flex-col">
          
          {/* AI Daily Brief card */}
          <div
            className="rounded-3xl p-5 border flex flex-col gap-3.5 relative overflow-hidden"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-violet-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                AI Daily Briefing
              </h3>
            </div>

            <div className="bg-neutral-950/40 border border-white/5 rounded-2xl p-4 space-y-3">
              <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest block">Today&apos;s Strategy</span>
              <p className="text-xs text-neutral-200 leading-relaxed font-semibold">
                You are most productive between 9AM–12PM. One interview is approaching, and your Workout is overdue.
              </p>
              <div className="border-t border-white/5 pt-2.5 space-y-1">
                <span className="text-[9px] text-neutral-500 font-bold block uppercase">AI Directive Advice</span>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Complete **Interview Prep** first. Delay **Reading** until the evening to maximize focus scores.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-800">
              <span className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-violet-400" /> Success: {successPrediction}%</span>
              <span>Focus Score: 85%</span>
            </div>
          </div>

          {/* Smart Coach card */}
          <div
            className="rounded-3xl p-5 border flex flex-col gap-3.5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Clutch Smart Coach
              </h3>
            </div>

            <div className="flex items-start gap-3 bg-neutral-950/20 border border-white/5 p-3.5 rounded-2xl">
              {/* AI Avatar */}
              <div className="w-8 h-8 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Brain className="w-4.5 h-4.5 text-violet-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-200 leading-relaxed font-semibold">
                  &quot;You usually lose focus after 2PM. Would you like me to move **Workout** to the evening?&quot;
                </p>
                
                {coachChoice === "pending" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => handleCoachClick("accepted")}
                      className="bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl border border-violet-500/10 transition-all cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleCoachClick("rescheduled")}
                      className="bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-black px-2.5 py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleCoachClick("ignored")}
                      className="bg-white/5 hover:bg-white/10 text-neutral-400 text-[10px] font-black px-2.5 py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer"
                    >
                      Ignore
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Choice registered: {coachChoice.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* AI Reflections ChatGPT-style component */}
          <div
            className="rounded-3xl p-5 border flex flex-col justify-between flex-1 min-h-[300px]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">AI Reflections Playground</span>
              <span className="text-[10px] text-neutral-500 font-bold">ChatGPT Console</span>
            </div>

            {/* Chat Bubble Scroll */}
            <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 space-y-3.5 my-3">
              {reflectionsChat.map((msg, mIdx) => {
                const isClutch = msg.sender === "clutch";
                return (
                  <div
                    key={mIdx}
                    className={cn(
                      "flex items-start gap-2.5",
                      !isClutch && "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                      isClutch ? "bg-violet-600/10 text-violet-400 border border-violet-500/20" : "bg-neutral-800 text-neutral-300"
                    )}>
                      {isClutch ? "C" : "U"}
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed font-semibold whitespace-pre-line",
                      isClutch ? "bg-neutral-950/60 border border-white/5 text-neutral-200" : "bg-violet-600 text-white"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-neutral-500 italic pl-8">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compiling debrief datasets...
                </div>
              )}
            </div>

            {/* Quick Reflex Buttons */}
            <div className="border-t border-neutral-800 pt-3 flex gap-2">
              <button
                onClick={() => triggerDebriefChat("daily")}
                disabled={chatLoading}
                className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-black py-2 px-3 rounded-xl border border-white/10 transition-all cursor-pointer text-center"
              >
                Daily Debrief
              </button>
              <button
                onClick={() => triggerDebriefChat("weekly")}
                disabled={chatLoading}
                className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-black py-2 px-3 rounded-xl border border-white/10 transition-all cursor-pointer text-center"
              >
                Weekly Reflex
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 2: FOCUS AGENDA, CALENDAR TIME BLOCKS & DEADLINES TIMELINE */}
        <div className="space-y-6 flex flex-col">
          
          {/* Today's Focus Action Card */}
          <div
            className="rounded-3xl p-5 border flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4.5 h-4.5 text-violet-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Today&apos;s Focus Goal
                </h3>
              </div>
              <span className="text-[9px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-0.5 rounded-full font-bold">
                Smart Focus
              </span>
            </div>

            {pendingTasks.length > 0 ? (
              <div className="space-y-3.5">
                <div>
                  <h4 className="text-sm font-black text-neutral-100 leading-snug">
                    {pendingTasks[0].title}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {pendingTasks[0].description || "Highest priority checklist item in your active daily queue. Focus session recommended."}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800 pt-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {pendingTasks[0].estimated_duration || 25}m estimate</span>
                  <span className="font-extrabold text-violet-400">Priority Weight: {pendingTasks[0].priority_score || 80}%</span>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-neutral-500 leading-relaxed text-center py-4">
                No active tasks left today. Open Taskify Buddy to load your weekly goals.
              </p>
            )}
          </div>

          {/* Google Calendar style Execution Time Blocks */}
          <div
            className="rounded-3xl p-5 border flex flex-col justify-between flex-1 min-h-[300px]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Execution Time Blocks</span>
              <span className="text-[10px] text-neutral-500 font-bold">Google Calendar</span>
            </div>

            {/* Vertical timeline scale */}
            <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 space-y-4 mt-3">
              {[8, 10, 12, 14, 16, 18, 20].map((hourVal, hIdx) => {
                const hourStr = hourVal < 12 ? `${hourVal} AM` : hourVal === 12 ? "12 PM" : `${hourVal - 12} PM`;
                
                // Fetch scheduled item matching this time slot
                const matchedEvent = todayTimelineList.find(item => {
                  const itemHour = parseInt(item.time.split(":")[0]);
                  const itemAmPm = item.time.split(" ")[1];
                  const itemHourMilitary = itemAmPm === "PM" && itemHour !== 12 ? itemHour + 12 : itemAmPm === "AM" && itemHour === 12 ? 0 : itemHour;
                  return itemHourMilitary >= hourVal && itemHourMilitary < hourVal + 2;
                });

                return (
                  <div key={hIdx} className="flex gap-4 items-start">
                    <span className="text-[10px] text-neutral-500 font-bold w-12 pt-1">{hourStr}</span>
                    <div className="flex-1 min-w-0 border-t border-neutral-900 pt-1">
                      {matchedEvent ? (
                        <div className={cn(
                          "p-2 rounded-xl border flex items-center justify-between text-xs font-bold",
                          matchedEvent.type === "meeting"
                            ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
                            : "bg-violet-500/5 border-violet-500/10 text-violet-400"
                        )}>
                          <span className="truncate">{matchedEvent.title}</span>
                          <span className="text-[9px] opacity-75 font-semibold shrink-0">Active</span>
                        </div>
                      ) : (
                        <div className="h-6 flex items-center">
                          <span className="text-[10px] text-neutral-700 font-semibold italic">Buffer space</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Deadlines with color weights */}
          <div
            className="rounded-3xl p-5 border flex flex-col justify-between"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Upcoming Deadlines</span>
              <span className="text-[10px] text-neutral-500 font-bold">Forecast</span>
            </div>

            <div className="space-y-2.5 mt-3">
              {pendingTasks.filter(t => t.deadline).slice(0, 3).map((task, idx) => {
                const daysLeft = Math.ceil((new Date(task.deadline!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                
                // Urgency mapping
                let urgencyColor = "text-emerald-400 bg-emerald-500/5 border-emerald-500/10";
                let urgencyText = `${daysLeft} Days`;
                if (daysLeft <= 1) {
                  urgencyColor = "text-rose-400 bg-rose-500/5 border-rose-500/10";
                  urgencyText = daysLeft === 0 ? "Today" : "Tomorrow";
                } else if (daysLeft <= 3) {
                  urgencyColor = "text-orange-400 bg-orange-500/5 border-orange-500/10";
                }

                return (
                  <div key={task.id} className="flex justify-between items-center bg-neutral-950/40 p-2.5 rounded-xl border border-white/5 text-xs font-semibold gap-3">
                    <span className="truncate text-neutral-200">{task.title}</span>
                    <span className={cn("px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase shrink-0", urgencyColor)}>
                      {urgencyText}
                    </span>
                  </div>
                );
              })}
              {pendingTasks.filter(t => t.deadline).length === 0 && (
                <div className="text-xs text-neutral-500 italic text-center py-2">
                  No upcoming deadlines found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3: PROGRESS RINGS, HABITS, SPEEDOMETERS & stress BIOMETRICS */}
        <div className="space-y-6 flex flex-col">
          
          {/* Apple Fitness style Goals Progress concentric rings */}
          <div
            className="rounded-3xl p-5 border flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-orange-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Goal Progress Rings
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold">Apple Fitness</span>
            </div>

            {goals.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {goals.slice(0, 3).map((goal, idx) => {
                  const ringsColors = ["stroke-violet-500", "stroke-emerald-500", "stroke-orange-500"];
                  const ringsColorsText = ["text-violet-400", "text-emerald-400", "text-orange-400"];
                  const textGlow = ringsColorsText[idx % 3];

                  return (
                    <div key={goal.id} className="flex items-center justify-between gap-4 bg-neutral-950/20 p-3 rounded-2xl border border-white/5">
                      <div className="min-w-0">
                        <span className="text-xs font-black text-neutral-200 block truncate">{goal.title}</span>
                        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5 block">
                          Target: {goal.target_date || "Continuous"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("text-xs font-black", textGlow)}>{goal.completion_percentage}%</span>
                        <div className="relative w-10 h-10">
                          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="3" />
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              className={ringsColors[idx % 3]}
                              strokeWidth="3.5"
                              strokeDasharray="94.2"
                              strokeDashoffset={94.2 - (94.2 * (goal.completion_percentage || 0)) / 100}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-neutral-500 italic">
                No active strategic goals set. Use GoalPlanner to spin up dynamic milestones.
              </div>
            )}
          </div>

          {/* Apple Activity Rings for Habits streaks */}
          <div
            className="rounded-3xl p-5 border flex flex-col gap-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4.5 h-4.5 text-orange-500 fill-orange-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  AI Habit Activity Rings
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold">Activity Rings</span>
            </div>

            {habitsList.length > 0 ? (
              <div className="flex flex-col gap-3">
                {habitsList.slice(0, 3).map((habit, idx) => {
                  const isChecked = habit.last_completed_at
                    ? new Date(habit.last_completed_at).toDateString() === new Date().toDateString()
                    : false;

                  const colorsRing = ["stroke-emerald-400", "stroke-orange-400", "stroke-violet-400"];

                  return (
                    <div key={habit.id} className="flex items-center justify-between bg-neutral-950/20 p-2.5 rounded-2xl border border-white/5 gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-black text-neutral-200 block truncate">{habit.title}</span>
                        <span className="text-[9px] text-neutral-500 font-bold block uppercase mt-0.5">🔥 {habit.streak} Days Active</span>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Apple style concentric circular track indicator */}
                        <div className="relative w-8 h-8">
                          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="3" />
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              className={colorsRing[idx % 3]}
                              strokeWidth="3.5"
                              strokeDasharray="87.9"
                              strokeDashoffset={isChecked ? 0 : 87.9 - (87.9 * 0.4)} // 40% initial arc if unchecked, 100% if checked
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        <button
                          onClick={() => handleCheckHabit(habit.id, habit.streak, habit.last_completed_at)}
                          disabled={isChecked || checkingHabitId === habit.id}
                          className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center border text-[10px] font-black transition-all",
                            isChecked
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-white/5 border-white/10 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 cursor-pointer"
                          )}
                        >
                          {checkingHabitId === habit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "✓"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-neutral-500 italic">
                No active habits setup. Type in Taskify Buddy to draft your routine.
              </div>
            )}
          </div>

          {/* Productivity Engine Speedometer */}
          <div
            className="rounded-3xl p-5 border flex flex-col items-center justify-between text-center min-h-[220px]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="w-full flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Productivity Speedometer</span>
              <span className="text-[10px] text-neutral-500 font-bold">Engine</span>
            </div>

            {/* Gauge SVG Speedometer */}
            <div className="relative w-36 h-20 mt-4 flex items-end justify-center overflow-hidden">
              <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
                <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" strokeLinecap="round" />
                <path
                  d="M10,50 A40,40 0 0,1 90,50"
                  fill="none"
                  stroke="url(#speedometerGrad)"
                  strokeWidth="8.5"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 - (125.6 * (productivityScore / 100))}
                  strokeLinecap="round"
                />
                
                <defs>
                  <linearGradient id="speedometerGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                    <stop offset="100%" stopColor="rgb(16, 185, 129)" />
                  </linearGradient>
                </defs>

                {/* Speedometer needle */}
                {(() => {
                  const angle = (productivityScore / 100) * 180 - 180; // Map 0-100 to -180 to 0 degrees
                  return (
                    <g transform={`translate(50, 50) rotate(${angle})`}>
                      <line x1="0" y1="0" x2="35" y2="0" stroke="rgb(255, 255, 255)" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="0" cy="0" r="5" fill="rgb(255, 255, 255)" />
                    </g>
                  );
                })()}
              </svg>
              
              <div className="absolute flex flex-col items-center bottom-0">
                <span className="text-2xl font-black text-neutral-100">{productivityScore}</span>
                <span className="text-[9px] text-emerald-400 font-extrabold tracking-widest uppercase">Excellent</span>
              </div>
            </div>

            <div className="w-full flex justify-between items-center text-[10px] text-neutral-500 font-bold border-t border-neutral-800 pt-3">
              <span>Trend: Optimal (+4%)</span>
              <span>Last 7 Days Average: 81</span>
            </div>
          </div>

          {/* Burnout Engine Stress biometrics */}
          <div
            className="rounded-3xl p-5 border flex flex-col gap-3.5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4.5 h-4.5 text-rose-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Burnout Stress Index
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold">Biometrics</span>
            </div>

            {/* Horizontal health meters */}
            <div className="space-y-2.5">
              {[
                { label: "Mental Energy", value: 74, color: "bg-emerald-500" },
                { label: "Focus Fatigue", value: 45, color: "bg-yellow-500" },
                { label: "Recovery Rating", value: 82, color: "bg-emerald-500" },
                { label: "Sleep Debt", value: 20, color: "bg-rose-500" },
                { label: "Meeting Load", value: 35, color: "bg-yellow-500" }
              ].map((metric, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-neutral-400">
                    <span>{metric.label}</span>
                    <span>{metric.value}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", metric.color)}
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 4. WHAT-IF DECISION SIMULATOR INTERACTIVE PLAYGROUND */}
      {/* ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 border space-y-4 relative overflow-hidden"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <div className="absolute top-0 right-0 p-3 opacity-5">
          <Brain className="w-44 h-44 text-violet-400" />
        </div>
        
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <Brain className="w-5 h-5 text-violet-400" />
          <div>
            <h3 className="text-sm font-black text-neutral-100">What-If Decision Simulator</h3>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Interactive Future Projection Engine</p>
          </div>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl font-semibold">
          Simulate scheduling trade-offs instantly without altering your live tasks. Ask questions like: &quot;What if I skip my workout today?&quot; or &quot;What if I postpone my coding task?&quot;
        </p>

        {/* Suggestion tags */}
        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase text-neutral-400">
          {[
            "What if I skip workout today?",
            "What if I delay Interview Prep by 1 day?",
            "What if I complete Focus Sessions early?"
          ].map((tag, tIdx) => (
            <button
              key={tIdx}
              onClick={() => { setWhatIfInput(tag); runWhatIfSimulation(tag); }}
              className="bg-neutral-950/40 hover:bg-neutral-950 hover:text-white px-2.5 py-1.5 rounded-xl border border-white/5 transition-all cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a scenario decision..."
            value={whatIfInput}
            onChange={(e) => setWhatIfInput(e.target.value)}
            disabled={isSimulating}
            className="flex-1 bg-neutral-950 text-xs px-4 py-3 rounded-2xl border border-neutral-800 focus:border-violet-500 outline-none text-neutral-200 font-semibold"
          />
          <button
            onClick={() => runWhatIfSimulation(whatIfInput)}
            disabled={isSimulating || !whatIfInput.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-black px-5 py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Simulate
          </button>
        </div>

        {/* Results Block */}
        <AnimatePresence>
          {simulationResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-neutral-950/60 border border-white/5 rounded-2xl p-4 space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Success Shift</span>
                  <span className="text-base font-black text-rose-400 mt-1 block">
                    {simulationResult.current_completion_probability}% → {simulationResult.simulated_completion_probability}%
                  </span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Stress Shift</span>
                  <span className="text-base font-black text-orange-400 mt-1 block">
                    +6% stress factor
                  </span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Goal Delay</span>
                  <span className="text-base font-black text-yellow-400 mt-1 block">
                    1 Day Delay
                  </span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Recovery Ease</span>
                  <span className="text-base font-black text-emerald-400 mt-1 block">
                    {simulationResult.recovery_probability}% Recovery
                  </span>
                </div>
              </div>

              {/* Graphic SVG representation */}
              <div className="bg-neutral-900/40 p-3 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block mb-2">Simulated Probability curve shift</span>
                <div className="h-16 w-full flex items-center justify-center">
                  <svg viewBox="0 0 300 50" className="w-full h-full">
                    {/* Current probability line (green) */}
                    <path d="M10,40 Q75,10 150,20 T290,15" fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2" strokeDasharray="3,3" />
                    {/* Simulated probability line (red) */}
                    <path d="M10,40 Q75,30 150,45 T290,38" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2.5" />
                    
                    <circle cx="150" cy="20" r="3.5" fill="rgb(16, 185, 129)" />
                    <circle cx="150" cy="45" r="4.5" fill="rgb(239, 68, 68)" />
                  </svg>
                </div>
              </div>

              <div className="space-y-1 border-t border-white/5 pt-3">
                <span className="text-[10px] text-violet-400 font-black uppercase block">AI Simulator Breakdown</span>
                <p className="text-xs text-neutral-200 leading-relaxed font-semibold">
                  &quot;{simulationResult.reasoning}&quot;
                </p>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                <span className="text-[10px] text-emerald-400 font-black uppercase block">Recommended Mitigation Alternative</span>
                <p className="text-xs text-neutral-300 leading-relaxed mt-0.5">
                  {simulationResult.suggested_alternative}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 5. CUSTOM CHARTS PANEL (Consolidated Tab views) */}
      {/* ──────────────────────────────────────────────────────── */}
      <DashboardCharts
        personalTasks={personalTasks}
        projectTasks={projectTasks}
        goalTasks={goalTasks}
        goals={goals}
        habits={habits}
        calendarEvents={calendarEvents}
        focusSessions={focusSessions}
        reminders={reminders}
      />
    </div>
  );
}
