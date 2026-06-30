"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  BarChart4,
  PieChart,
  Calendar,
  Sparkles,
  GitCommit,
  CheckCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardChartsProps {
  personalTasks: any[];
  projectTasks: any[];
  goalTasks: any[];
  goals: any[];
  habits: any[];
  calendarEvents: any[];
  focusSessions: any[];
  reminders: any[];
}

export function DashboardCharts({
  personalTasks,
  projectTasks,
  goalTasks,
  goals,
  habits,
  calendarEvents,
  focusSessions,
  reminders
}: DashboardChartsProps) {
  const [activeTab, setActiveTab] = useState<"flow" | "missions" | "history">("flow");
  const [hoveredData, setHoveredData] = useState<{ x: number; y: number; text: string } | null>(null);

  // Compute all tasks list
  const allTasks = [...personalTasks, ...projectTasks, ...goalTasks];

  // Helper date parsing
  const getPastDays = (num: number) => {
    const days = [];
    const today = new Date();
    for (let i = num - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    return days;
  };

  const last7Days = getPastDays(7);
  const last30Days = getPastDays(30);

  // 1. DATA PREPARATION: Weekly Completion Trend (Line) & Focus Time (Area) & Completed Tasks (Bar)
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const weeklyData = last7Days.map(day => {
    const dateStr = day.toISOString().split("T")[0];
    
    // Tasks completed on this day
    const completedTasksCount = allTasks.filter(t => {
      if (t.status !== "done" || !t.updated_at) return false;
      return t.updated_at.split("T")[0] === dateStr;
    }).length;

    // Focus minutes on this day
    const focusMins = focusSessions
      .filter(s => s.status === "completed" && s.created_at && s.created_at.split("T")[0] === dateStr)
      .reduce((acc, curr) => acc + (curr.completed_minutes || 0), 0);

    return {
      dayLabel: daysOfWeek[day.getDay()],
      dateStr,
      completed: completedTasksCount,
      focusMinutes: focusMins,
      productivityScore: Math.min(100, (completedTasksCount * 25) + (focusMins > 0 ? 30 : 0) + 30)
    };
  });

  // 2. DATA PREPARATION: Stacked Categories (Personal / Project / Goal)
  const totalPersonal = personalTasks.length;
  const totalProject = projectTasks.length;
  const totalGoal = goalTasks.length;
  const totalEntities = totalPersonal + totalProject + totalGoal;

  const personalPct = totalEntities > 0 ? (totalPersonal / totalEntities) * 100 : 0;
  const projectPct = totalEntities > 0 ? (totalProject / totalEntities) * 100 : 0;
  const goalPct = totalEntities > 0 ? (totalGoal / totalEntities) * 100 : 0;

  const donePersonal = personalTasks.filter(t => t.status === "done").length;
  const doneProject = projectTasks.filter(t => t.status === "done").length;
  const doneGoal = goalTasks.filter(t => t.status === "done").length;

  // 3. DATA PREPARATION: Radar Chart (Work Life Balance)
  // Axes: Focus Session (completed today ratio vs target), Goals Progress average, Habits execution streak average, Project tasks completed, Personal tasks completed
  const radarAxes = [
    { label: "Deep Focus", value: Math.min(100, (focusSessions.filter(s => s.status === "completed").length * 30)) },
    { label: "Goals Progress", value: goals.length > 0 ? Math.round(goals.reduce((acc, g) => acc + (g.completion_percentage || 0), 0) / goals.length) : 0 },
    { label: "Habits Streak", value: habits.length > 0 ? Math.min(100, Math.round(habits.reduce((acc, h) => acc + (h.streak || 0), 0) / habits.length) * 10) : 0 },
    { label: "Projects done", value: projectTasks.length > 0 ? Math.round((doneProject / projectTasks.length) * 100) : 0 },
    { label: "Personal done", value: personalTasks.length > 0 ? Math.round((donePersonal / personalTasks.length) * 100) : 0 }
  ];

  // 4. DATA PREPARATION: GitHub Heatmap Grid & Focus density Heatmap
  const heatmapData = last30Days.map(day => {
    const dateStr = day.toISOString().split("T")[0];

    const completedCount = allTasks.filter(t => {
      if (t.status !== "done" || !t.updated_at) return false;
      return t.updated_at.split("T")[0] === dateStr;
    }).length;

    const habitCount = habits.filter(h => {
      if (!h.last_completed_at) return false;
      return h.last_completed_at.split("T")[0] === dateStr;
    }).length;

    const focusDensity = focusSessions.filter(s => {
      if (s.status !== "completed" || !s.created_at) return false;
      return s.created_at.split("T")[0] === dateStr;
    }).length;

    const totalContributions = completedCount + habitCount;
    return {
      date: day,
      dateLabel: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      contributions: totalContributions,
      focusSessionsCount: focusDensity,
      intensity: totalContributions === 0 ? 0 : totalContributions <= 1 ? 1 : totalContributions <= 3 ? 2 : 3,
      focusIntensity: focusDensity === 0 ? 0 : focusDensity <= 1 ? 1 : focusDensity <= 2 ? 2 : 3
    };
  });

  // 5. MINI CALENDAR LOGIC (Interactive Monthly view with Dots)
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // Day of week (0-6)
    const totalDays = new Date(year, month + 1, 0).getDate(); // Days in month
    
    const days = [];
    // Pad previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ dayNum: null, date: null });
    }
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        dayNum: i,
        date: new Date(year, month, i)
      });
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const calendarMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getDaySchedule = (dayDate: Date) => {
    const dateStr = dayDate.toISOString().split("T")[0];
    
    // Ranks matching categories
    const dayEvents = calendarEvents.filter(e => e.start_time.split("T")[0] === dateStr);
    const dayGoalTasks = goalTasks.filter(t => t.deadline && t.deadline.split("T")[0] === dateStr);
    const dayProjectTasks = projectTasks.filter(t => t.due_date && t.due_date.split("T")[0] === dateStr);
    const dayReminders = reminders.filter(r => (r.due_at || r.reminder_time) && (r.due_at || r.reminder_time).split("T")[0] === dateStr);
    const dayHabits = habits.filter(h => h.last_completed_at && h.last_completed_at.split("T")[0] === dateStr);

    return {
      meetings: dayEvents.filter(e => e.event_type === "external" || e.event_type === "meeting_prep"),
      goalTasks: dayGoalTasks,
      projectTasks: dayProjectTasks,
      reminders: dayReminders,
      habits: dayHabits
    };
  };

  return (
    <div
      className="rounded-2xl border p-5 space-y-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)"
      }}
    >
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20">
            <Activity className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-neutral-100">Interactive Command Analytics</h3>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Linear & Apple Health Engine</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-900 self-start sm:self-auto">
          {[
            { id: "flow", label: "Flow State", icon: TrendingUp },
            { id: "missions", label: "Missions & Time", icon: BarChart4 },
            { id: "history", label: "Consistency Maps", icon: GitCommit }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === tab.id
                    ? "bg-violet-500 text-white shadow-glow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CHART CONTENT RENDERER */}
      <div className="relative min-h-[300px]">
        {/* Tooltip Overlay */}
        <AnimatePresence>
          {hoveredData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none bg-neutral-950/95 border border-violet-500/25 px-2.5 py-1.5 rounded-lg text-[11px] text-neutral-200 font-bold z-50 shadow-lg"
              style={{ left: hoveredData.x + 10, top: hoveredData.y - 45 }}
            >
              {hoveredData.text}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* TAB 1: FLOW STATE (Line productivity, Area focus, Radar balance, Donut distribution) */}
          {activeTab === "flow" && (
            <motion.div
              key="flow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Line & Area Chart Container */}
              <div className="lg:col-span-2 space-y-5 bg-neutral-950/30 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400">Weekly Productivity & Focus Mins</span>
                  <span className="text-[10px] text-neutral-500">Last 7 Days</span>
                </div>
                
                {/* SVG Area (Focus Minutes) & Line (Productivity) */}
                <div className="relative h-[200px] w-full">
                  <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[50, 100, 150].map((yVal, gIdx) => (
                      <line
                        key={gIdx}
                        x1="20"
                        y1={yVal}
                        x2="480"
                        y2={yVal}
                        stroke="rgba(255,255,255,0.03)"
                        strokeDasharray="4,4"
                      />
                    ))}

                    {/* Area Graph: Focus Time */}
                    {(() => {
                      const maxFocus = Math.max(...weeklyData.map(d => d.focusMinutes), 60);
                      const points = weeklyData.map((d, idx) => {
                        const x = 30 + (idx * 440) / 6;
                        const y = 170 - (d.focusMinutes * 140) / maxFocus;
                        return `${x},${y}`;
                      }).join(" ");
                      
                      const fillPoints = `30,170 ${points} 470,170`;

                      return (
                        <>
                          <polygon points={fillPoints} fill="url(#areaGlow)" />
                          <polyline fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2" points={points} strokeLinecap="round" />
                          {weeklyData.map((d, idx) => {
                            const x = 30 + (idx * 440) / 6;
                            const y = 170 - (d.focusMinutes * 140) / maxFocus;
                            return (
                              <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r="4"
                                fill="rgb(16, 185, 129)"
                                className="cursor-pointer hover:r-6 transition-all"
                                onMouseEnter={(e) => setHoveredData({ x: e.clientX - 200, y: e.clientY - 200, text: `Focus Time: ${d.focusMinutes}m` })}
                                onMouseLeave={() => setHoveredData(null)}
                              />
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Line Graph: Productivity Score */}
                    {(() => {
                      const points = weeklyData.map((d, idx) => {
                        const x = 30 + (idx * 440) / 6;
                        const y = 170 - (d.productivityScore * 140) / 100;
                        return `${x},${y}`;
                      }).join(" ");

                      return (
                        <>
                          <polyline fill="none" stroke="rgb(139, 92, 246)" strokeWidth="3" points={points} strokeLinecap="round" />
                          {weeklyData.map((d, idx) => {
                            const x = 30 + (idx * 440) / 6;
                            const y = 170 - (d.productivityScore * 140) / 100;
                            return (
                              <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r="5"
                                fill="rgb(139, 92, 246)"
                                stroke="rgb(10, 10, 10)"
                                strokeWidth="1.5"
                                className="cursor-pointer hover:r-7 transition-all"
                                onMouseEnter={(e) => setHoveredData({ x: e.clientX - 200, y: e.clientY - 200, text: `Productivity Score: ${d.productivityScore}` })}
                                onMouseLeave={() => setHoveredData(null)}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="flex justify-between text-[10px] text-neutral-500 font-bold px-4">
                  {weeklyData.map((d, idx) => (
                    <span key={idx}>{d.dayLabel}</span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-violet-500 block" />
                    <span className="text-neutral-300">Productivity Score</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 block" />
                    <span className="text-neutral-300">Focus Minutes</span>
                  </div>
                </div>
              </div>

              {/* Radar Chart (Work Life Balance) */}
              <div className="bg-neutral-950/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between items-center text-center">
                <div className="w-full flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-neutral-400">Work Life Balance</span>
                  <span className="text-[10px] text-neutral-500">Radar Chart</span>
                </div>

                {/* Radar SVG */}
                <div className="relative w-44 h-44 my-4 flex items-center justify-center">
                  <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                    <defs>
                      <radialGradient id="radarGrad">
                        <stop offset="60%" stopColor="rgb(139, 92, 246)" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                      </radialGradient>
                    </defs>

                    {/* Helper web lines */}
                    {[0.25, 0.5, 0.75, 1].map((scale, sIdx) => {
                      const points = radarAxes.map((_, idx) => {
                        const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                        const x = 100 + scale * 80 * Math.cos(angle);
                        const y = 100 + scale * 80 * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(" ");
                      return (
                        <polygon
                          key={sIdx}
                          points={points}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.04)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Draw Axis Lines */}
                    {radarAxes.map((_, idx) => {
                      const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                      const x = 100 + 80 * Math.cos(angle);
                      const y = 100 + 80 * Math.sin(angle);
                      return (
                        <line
                          key={idx}
                          x1="100"
                          y1="100"
                          x2={x}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.05)"
                          strokeWidth="1.5"
                        />
                      );
                    })}

                    {/* Data Polygon */}
                    {(() => {
                      const points = radarAxes.map((a, idx) => {
                        const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                        // Normalize 0-100 to 0-80px radius
                        const r = (Math.max(10, a.value) / 100) * 80;
                        const x = 100 + r * Math.cos(angle);
                        const y = 100 + r * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(" ");

                      return (
                        <>
                          <polygon
                            points={points}
                            fill="url(#radarGrad)"
                            stroke="rgb(139, 92, 246)"
                            strokeWidth="2"
                          />
                          {radarAxes.map((a, idx) => {
                            const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                            const r = (Math.max(10, a.value) / 100) * 80;
                            const x = 100 + r * Math.cos(angle);
                            const y = 100 + r * Math.sin(angle);
                            return (
                              <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r="3.5"
                                fill="rgb(139, 92, 246)"
                                className="cursor-help"
                              >
                                <title>{`${a.label}: ${a.value}%`}</title>
                              </circle>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Label strings */}
                    {radarAxes.map((a, idx) => {
                      const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                      const x = 100 + 95 * Math.cos(angle);
                      const y = 100 + 95 * Math.sin(angle);
                      
                      let textAnchor: "start" | "end" | "middle" = "middle";
                      if (Math.cos(angle) > 0.1) textAnchor = "start";
                      if (Math.cos(angle) < -0.1) textAnchor = "end";

                      return (
                        <text
                          key={idx}
                          x={x}
                          y={y + 3}
                          fill="rgba(255,255,255,0.4)"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor={textAnchor}
                        >
                          {a.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>

                <div className="text-[10px] text-neutral-500 font-bold max-w-[80%] leading-relaxed mt-2">
                  Maintain balanced execution vectors to maximize mental load safety.
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: MISSIONS & TIMELINES (Completed Tasks Bar, Stacked Categories Bar, Timeline Calendar) */}
          {activeTab === "missions" && (
            <motion.div
              key="missions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Bar Chart: Completed Tasks */}
              <div className="bg-neutral-950/30 p-4 rounded-xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400">Completed Tasks Trend</span>
                  <span className="text-[10px] text-neutral-500">Daily Units</span>
                </div>

                <div className="h-[200px] w-full flex items-end justify-between px-2 pt-4">
                  {weeklyData.map((d, idx) => {
                    const maxVal = Math.max(...weeklyData.map(x => x.completed), 4);
                    // Map value to percentage of height (160px max)
                    const barHeight = Math.max(10, (d.completed / maxVal) * 150);

                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 gap-2 group">
                        <div className="w-full px-2 flex justify-center">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: barHeight }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="w-4 rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 group-hover:from-violet-500 group-hover:to-violet-300 transition-all cursor-help relative"
                            onMouseEnter={(e) => setHoveredData({ x: e.clientX - 200, y: e.clientY - 200, text: `Completed: ${d.completed} tasks` })}
                            onMouseLeave={() => setHoveredData(null)}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-500 font-bold">{d.dayLabel}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-white/5 pt-3 flex justify-between items-center text-xs">
                  <span className="text-neutral-500">Total Completed (7d)</span>
                  <span className="font-black text-neutral-200">
                    {weeklyData.reduce((acc, curr) => acc + curr.completed, 0)} Tasks
                  </span>
                </div>
              </div>

              {/* Stacked Bar & Donut Ratios */}
              <div className="bg-neutral-950/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                <div className="w-full flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-neutral-400">Task Categories Distribution</span>
                  <span className="text-[10px] text-neutral-500">Ratios</span>
                </div>

                {/* Stacked Horizontal Bar */}
                <div className="space-y-4 my-4">
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold block mb-1.5 uppercase">Volume Breakdown</span>
                    <div className="w-full h-4 bg-neutral-900 rounded-full overflow-hidden flex">
                      <div className="h-full bg-violet-500" style={{ width: `${personalPct || 33}%` }} title="Personal" />
                      <div className="h-full bg-emerald-500" style={{ width: `${projectPct || 33}%` }} title="Project" />
                      <div className="h-full bg-orange-500" style={{ width: `${goalPct || 34}%` }} title="Goal" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] font-bold">
                    <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-900">
                      <span className="text-neutral-500 block mb-1">PERSONAL</span>
                      <span className="text-violet-400 text-sm font-black">{totalPersonal}</span>
                    </div>
                    <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-900">
                      <span className="text-neutral-500 block mb-1">PROJECT</span>
                      <span className="text-emerald-400 text-sm font-black">{totalProject}</span>
                    </div>
                    <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-900">
                      <span className="text-neutral-500 block mb-1">GOAL</span>
                      <span className="text-orange-400 text-sm font-black">{totalGoal}</span>
                    </div>
                  </div>
                </div>

                {/* Donut Chart SVG */}
                <div className="flex items-center gap-4 border-t border-white/5 pt-3">
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                      
                      <circle
                        cx="18"
                        cy="18"
                        r="15.91"
                        fill="none"
                        stroke="rgb(139, 92, 246)"
                        strokeWidth="3.5"
                        strokeDasharray={`${personalPct} ${100 - personalPct}`}
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.91"
                        fill="none"
                        stroke="rgb(16, 185, 129)"
                        strokeWidth="3.5"
                        strokeDasharray={`${projectPct} ${100 - projectPct}`}
                        strokeDashoffset={-personalPct}
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.91"
                        fill="none"
                        stroke="rgb(245, 158, 11)"
                        strokeWidth="3.5"
                        strokeDasharray={`${goalPct} ${100 - goalPct}`}
                        strokeDashoffset={-(personalPct + projectPct)}
                      />
                    </svg>
                    <div className="absolute text-[10px] font-black text-neutral-300">
                      {totalEntities}
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span>Personal ({Math.round(personalPct)}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Project ({Math.round(projectPct)}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      <span>Goal ({Math.round(goalPct)}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Calendar (Mini monthly view with interactive hover dots) */}
              <div className="bg-neutral-950/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-neutral-400">Timeline Calendar Insights</span>
                  <div className="flex items-center gap-1">
                    <button onClick={handlePrevMonth} className="p-0.5 hover:bg-white/5 rounded">
                      <ChevronLeft className="w-4 h-4 text-neutral-400" />
                    </button>
                    <span className="text-[10px] font-bold text-neutral-300 w-16 text-center">
                      {calendarMonths[currentMonth.getMonth()]}
                    </span>
                    <button onClick={handleNextMonth} className="p-0.5 hover:bg-white/5 rounded">
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[8px] text-neutral-500 font-bold text-center mt-2.5">
                  <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                </div>

                <div className="grid grid-cols-7 gap-1 mt-1 flex-1">
                  {calendarDays.map((day, idx) => {
                    if (!day.dayNum) {
                      return <div key={idx} className="h-6" />;
                    }

                    const sched = getDaySchedule(day.date!);
                    const isToday = new Date().toDateString() === day.date!.toDateString();

                    const dotElements = [];
                    if (sched.meetings.length > 0) dotElements.push("bg-emerald-400"); // Meeting
                    if (sched.goalTasks.length > 0) dotElements.push("bg-orange-500"); // Goal
                    if (sched.projectTasks.length > 0) dotElements.push("bg-sky-400"); // Project Task
                    if (sched.reminders.length > 0) dotElements.push("bg-rose-400"); // Reminder
                    if (sched.habits.length > 0) dotElements.push("bg-yellow-400"); // Habit

                    const tooltipText = [
                      sched.meetings.length > 0 ? `${sched.meetings.length} Meetings` : "",
                      sched.goalTasks.length > 0 ? `${sched.goalTasks.length} Goal Tasks` : "",
                      sched.projectTasks.length > 0 ? `${sched.projectTasks.length} Project Tasks` : "",
                      sched.reminders.length > 0 ? `${sched.reminders.length} Reminders` : "",
                      sched.habits.length > 0 ? `${sched.habits.length} Habits completed` : ""
                    ].filter(Boolean).join(" · ");

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "h-7 rounded-lg border border-transparent bg-neutral-950/40 hover:bg-white/5 flex flex-col items-center justify-between p-0.5 relative transition-all cursor-help",
                          isToday && "border-violet-500 bg-violet-500/5 text-violet-400"
                        )}
                        onMouseEnter={(e) => {
                          if (tooltipText) {
                            setHoveredData({
                              x: e.clientX - 200,
                              y: e.clientY - 200,
                              text: `${day.date!.toLocaleDateString()}: ${tooltipText}`
                            });
                          }
                        }}
                        onMouseLeave={() => setHoveredData(null)}
                      >
                        <span className="text-[10px] font-bold">{day.dayNum}</span>
                        {/* Dot container */}
                        <div className="flex gap-0.5 justify-center items-center h-1.5">
                          {dotElements.slice(0, 3).map((dotClass, dIdx) => (
                            <span key={dIdx} className={cn("w-1 h-1 rounded-full", dotClass)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: CONSISTENCY MAPS (GitHub-style calendar heatmap, Focus density heatmap, Consistency indicators) */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* GitHub Contribution Heatmap */}
              <div className="lg:col-span-2 bg-neutral-950/30 p-4 rounded-xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitCommit className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-bold text-neutral-400">Activity Contribution Graph</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">Completed items (30 days)</span>
                </div>

                {/* Heatmap Grid (6x5 grid blocks approximately representing 30 days) */}
                <div className="flex flex-wrap gap-2 justify-center py-2.5">
                  {heatmapData.map((d, idx) => {
                    const blockColors = [
                      "bg-white/5 border-white/5 hover:bg-white/10", // 0
                      "bg-violet-950/40 border-violet-900/20 text-violet-400 hover:bg-violet-900/30", // 1
                      "bg-violet-800/40 border-violet-800/20 text-violet-300 hover:bg-violet-800/50", // 2
                      "bg-violet-500/80 border-violet-500/20 text-white hover:bg-violet-500 shadow-glow-sm" // 3+
                    ];

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-10 h-10 rounded-lg border flex flex-col items-center justify-center text-center cursor-help transition-all duration-200",
                          blockColors[d.intensity]
                        )}
                        onMouseEnter={(e) => setHoveredData({ x: e.clientX - 200, y: e.clientY - 200, text: `${d.dateLabel}: ${d.contributions} completions logged` })}
                        onMouseLeave={() => setHoveredData(null)}
                      >
                        <span className="text-[8px] font-bold block opacity-40">{d.dateLabel.split(" ")[0]}</span>
                        <span className="text-xs font-black block mt-0.5">{d.dateLabel.split(" ")[1]}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-neutral-500 border-t border-white/5 pt-3">
                  <span>Less</span>
                  <span className="w-2.5 h-2.5 rounded bg-white/5 border border-white/5" />
                  <span className="w-2.5 h-2.5 rounded bg-violet-950/40 border border-violet-900/20" />
                  <span className="w-2.5 h-2.5 rounded bg-violet-800/40 border border-violet-800/20" />
                  <span className="w-2.5 h-2.5 rounded bg-violet-500/80 border border-violet-500/20" />
                  <span>More</span>
                </div>
              </div>

              {/* Focus Session density Heatmap & Consistency index */}
              <div className="bg-neutral-950/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between gap-5">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-neutral-400">Focus Density Graph</span>
                    <span className="text-[10px] text-neutral-500">Pomodoros (30 days)</span>
                  </div>

                  <div className="grid grid-cols-10 gap-1.5 mt-4">
                    {heatmapData.map((d, idx) => {
                      const densityColors = [
                        "bg-white/5 border-white/5", // 0
                        "bg-emerald-950/40 border-emerald-900/20", // 1
                        "bg-emerald-800/40 border-emerald-800/20", // 2
                        "bg-emerald-500/80 border-emerald-500/20 shadow-glow-sm" // 3+
                      ];

                      return (
                        <div
                          key={idx}
                          className={cn("w-3.5 h-3.5 rounded border cursor-help transition-all", densityColors[d.focusIntensity])}
                          onMouseEnter={(e) => setHoveredData({ x: e.clientX - 200, y: e.clientY - 200, text: `${d.dateLabel}: ${d.focusSessionsCount} focus blocks completed` })}
                          onMouseLeave={() => setHoveredData(null)}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 space-y-2">
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Consistency Index</span>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xl font-black text-neutral-100">
                        {(() => {
                          const activeDays = heatmapData.filter(d => d.contributions > 0).length;
                          return Math.round((activeDays / 30) * 100);
                        })()}%
                      </span>
                      <span className="text-[8px] text-neutral-500 font-bold block uppercase mt-0.5">Execution Score</span>
                    </div>

                    <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-2 py-1 rounded-lg">
                      Excellent Flow
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
