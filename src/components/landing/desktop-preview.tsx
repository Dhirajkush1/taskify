"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Calendar, Clock, Flame, 
  CheckCircle2, Play, Bell, ShieldAlert, Award
} from "lucide-react";

export function DesktopPreview() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [productivityScore, setProductivityScore] = useState(72);
  const [timeText, setTimeText] = useState("10:04 AM");
  
  // Timer countdown simulation
  const [seconds, setSeconds] = useState(1499); // 24m 59s
  
  // Tasks list simulation
  const [tasks, setTasks] = useState([
    { id: 1, title: "Review product design framework", status: "todo", priority: "critical" },
    { id: 2, title: "Finalize calendar schema migrations", status: "todo", priority: "high" },
    { id: 3, title: "Program Telegram webhook link helper", status: "done", priority: "medium" },
    { id: 4, title: "Self-heal user settings timezone defaults", status: "done", priority: "low" }
  ]);

  // Calendar time block shift state
  const [calendarShifted, setCalendarShifted] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // 1. Timer Tick
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => (prev > 0 ? prev - 1 : 1499));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 2. Automate Task Completion & Notification Toast Loop
  useEffect(() => {
    const timer = setTimeout(() => {
      // Mark task 2 completed
      setTasks(prev => 
        prev.map(t => t.id === 2 ? { ...t, status: "done" } : t)
      );
      setProductivityScore(88); // Increase productivity score
      setNotifications(["🎉 Milestone met: Finalize calendar schema migrations completed!"]);
      
      // Shift calendar block as a consequence
      setCalendarShifted(true);
    }, 5000);

    const resetTimer = setTimeout(() => {
      setTasks(prev => 
        prev.map(t => t.id === 2 ? { ...t, status: "todo" } : t)
      );
      setProductivityScore(72);
      setNotifications([]);
      setCalendarShifted(false);
    }, 12000);

    return () => {
      clearTimeout(timer);
      clearTimeout(resetTimer);
    };
  }, []);

  return (
    <section className="py-24 bg-slate-50/20 relative px-6 border-t border-slate-100 flex flex-col items-center">
      
      <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl w-full text-center mb-16 flex flex-col gap-4">
        <span className="text-[11px] font-bold text-violet-600 uppercase tracking-widest block">
          Product Preview
        </span>
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
          Experience the <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Productivity OS</span>.
        </h2>
        <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto">
          Take a look at the desktop environment in action. Watch tasks auto-update, calendars shift, and progress scores sync on the fly.
        </p>
      </div>

      {/* Glassmorphic Simulated Desktop Screen */}
      <div className="max-w-5xl w-full rounded-3xl border border-slate-200 bg-white/80 shadow-2xl shadow-slate-100 overflow-hidden backdrop-blur-xl relative">
        
        {/* Browser Top Window Bar */}
        <div className="w-full h-11 border-b border-slate-200/80 px-4 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-400" />
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <div className="bg-slate-200/40 text-[10px] font-bold px-12 py-1 rounded-lg text-slate-500 border border-slate-200/40">
            app.taskify.ai/dashboard
          </div>
          <div className="w-16" />
        </div>

        {/* Inner Desktop Workspace Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          
          {/* Mock Sidebar Panel */}
          <div className="md:col-span-3 border-r border-slate-200/80 p-4 flex flex-col gap-5 bg-slate-50/30">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-xs text-slate-800">Taskify AI</span>
            </div>

            <div className="flex flex-col gap-1">
              {[
                { id: "dashboard", label: "Mission Control", icon: Sparkles },
                { id: "calendar", label: "Calendar View", icon: Calendar },
                { id: "reminders", label: "Telegram Settings", icon: Clock }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                      activeTab === tab.id 
                        ? "bg-violet-600 text-white shadow-sm" 
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Simulated Live User Profile Card */}
            <div className="mt-auto border border-slate-100 bg-white p-3 rounded-2xl shadow-sm flex items-center gap-2.5">
              <div className="w-7.5 h-7.5 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-600 text-xs">
                DK
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">Dhiraj Kush</span>
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Active OS</span>
              </div>
            </div>
          </div>

          {/* Mock Main Dashboard View */}
          <div className="md:col-span-9 p-6 flex flex-col gap-6">
            
            {/* Dashboard Header Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Workspace Dashboard</h3>
                <span className="text-xs text-slate-400 font-semibold mt-0.5 block">
                  Today is Monday. Real-time calendar synchronized.
                </span>
              </div>
              
              {/* Dynamic Local Clock Mock */}
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/50 text-[11px] font-bold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-violet-500" />
                {timeText}
              </div>
            </div>

            {/* Dashboard Widget Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              
              {/* Widget 1: Focus Timer Countdown */}
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-white shadow-sm flex flex-col items-center justify-between gap-3 text-center">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Focus Session</span>
                <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-slate-100">
                  <span className="text-lg font-black text-slate-800 font-mono">{formatTimer(seconds)}</span>
                  <div className="absolute -inset-1 border-2 border-violet-500 rounded-full animate-pulse pointer-events-none" />
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-600 text-[10px] font-bold border border-violet-100">
                  <Play className="w-2.5 h-2.5 fill-current" /> Active Focus
                </button>
              </div>

              {/* Widget 2: Productivity Score */}
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-white shadow-sm flex flex-col items-center justify-between gap-3 text-center">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Productivity Score</span>
                <div className="w-24 h-24 flex flex-col items-center justify-center rounded-full border-4 border-slate-100 relative">
                  <span className="text-2xl font-black text-slate-800">{productivityScore}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Scale 100</span>
                  
                  {/* Glowing border ring */}
                  <div className="absolute -inset-1 rounded-full border-2 border-emerald-500 pointer-events-none transition-all duration-500" />
                </div>
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> High Performance
                </span>
              </div>

              {/* Widget 3: Live Calendar Shifts */}
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-white shadow-sm flex flex-col gap-3">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">AI Calendar Timeline</span>
                <div className="flex flex-col gap-2 flex-1 justify-center">
                  
                  {/* Block 1 */}
                  <div className="p-2.5 rounded-xl bg-violet-600 text-white flex items-center justify-between shadow-sm">
                    <span className="text-[10px] font-bold">1:00 PM - 2:30 PM: Design Review</span>
                    <span className="text-[9px] font-black opacity-80">Locked</span>
                  </div>

                  {/* Block 2 (Animate shifting) */}
                  <motion.div 
                    animate={{
                      y: calendarShifted ? 4 : 0,
                      backgroundColor: calendarShifted ? "rgba(99, 102, 241, 0.08)" : "rgba(241, 245, 249, 1)",
                      color: calendarShifted ? "#4f46e5" : "#475569",
                      borderColor: calendarShifted ? "rgba(99, 102, 241, 0.2)" : "rgba(226, 232, 240, 1)"
                    }}
                    className="p-2.5 rounded-xl border flex items-center justify-between text-[10px] font-bold"
                  >
                    <span>{calendarShifted ? "3:30 PM - 4:00 PM: Buffer Break" : "2:30 PM - 3:00 PM: Buffer Break"}</span>
                    <span className="text-[8px] uppercase tracking-wider opacity-60">
                      {calendarShifted ? "shifted" : "active"}
                    </span>
                  </motion.div>
                </div>
              </div>

            </div>

            {/* Tasks list widgets */}
            <div className="p-4 rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-3 block">Task Queue</span>
              <div className="flex flex-col gap-2">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/50 hover:bg-slate-100/50 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                        task.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"
                      }`}>
                        {task.status === "done" && <CheckCircle2 className="w-2.5 h-2.5 text-white fill-current" />}
                      </div>
                      <span className={`text-xs font-bold ${
                        task.status === "done" ? "line-through text-slate-400 opacity-60" : "text-slate-700"
                      }`}>
                        {task.title}
                      </span>
                    </div>

                    <span className={`text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black ${
                      task.priority === "critical" 
                        ? "bg-red-100 text-red-600" 
                        : task.priority === "high" 
                        ? "bg-amber-100 text-amber-600" 
                        : "bg-slate-200 text-slate-500"
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Dynamic Notification Toast Overlay */}
        <AnimatePresence>
          {notifications.map((note, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-950 text-white text-xs font-bold shadow-xl border border-neutral-800 flex items-center gap-2 max-w-sm"
            >
              <Bell className="w-4 h-4 text-violet-400 shrink-0 animate-bounce" />
              <span>{note}</span>
            </motion.div>
          ))}
        </AnimatePresence>

      </div>
    </section>
  );
}
