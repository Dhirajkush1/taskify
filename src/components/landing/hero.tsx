"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Send, CheckCircle2, Calendar, Bell, 
  Send as TelegramIcon, ShieldAlert, Zap, Clock, 
  Play, Smartphone, Flame, LineChart, Target
} from "lucide-react";
import Link from "next/link";
import { AIBrain } from "./ai-brain";

// Icons map for the 12 orbiting modules
const iconsMap: Record<string, any> = {
  mission: Sparkles,
  calendar: Calendar,
  telegram: TelegramIcon,
  voice: Play,
  habits: Flame,
  rescue: ShieldAlert,
  planner: Clock,
  debrief: CheckCircle2,
  analytics: LineChart,
  whatif: Zap,
  reminders: Bell,
  goals: Target
};

// Colors map for orbiting module highlights
const colorsMap: Record<string, string> = {
  mission: "border-amber-200/50 bg-amber-500/5 text-amber-600 shadow-amber-100",
  calendar: "border-blue-200/50 bg-blue-500/5 text-blue-600 shadow-blue-100",
  telegram: "border-sky-200/50 bg-sky-500/5 text-sky-600 shadow-sky-100",
  voice: "border-rose-200/50 bg-rose-500/5 text-rose-600 shadow-rose-100",
  habits: "border-orange-200/50 bg-orange-500/5 text-orange-600 shadow-orange-100",
  rescue: "border-red-200/50 bg-red-500/5 text-red-600 shadow-red-100",
  planner: "border-violet-200/50 bg-violet-500/5 text-violet-600 shadow-violet-100",
  debrief: "border-emerald-200/50 bg-emerald-500/5 text-emerald-600 shadow-emerald-100",
  analytics: "border-teal-200/50 bg-teal-500/5 text-teal-600 shadow-teal-100",
  whatif: "border-pink-200/50 bg-pink-500/5 text-pink-600 shadow-pink-100",
  reminders: "border-indigo-200/50 bg-indigo-500/5 text-indigo-600 shadow-indigo-100",
  goals: "border-cyan-200/50 bg-cyan-500/5 text-cyan-600 shadow-cyan-100"
};

const orbitItems = [
  { id: "mission", label: "Mission Control" },
  { id: "calendar", label: "Calendar" },
  { id: "telegram", label: "Telegram Bot" },
  { id: "voice", label: "Voice Sync" },
  { id: "habits", label: "Habit Engine" },
  { id: "rescue", label: "Rescue Mode" },
  { id: "planner", label: "Daily Planner" },
  { id: "debrief", label: "Daily Debrief" },
  { id: "analytics", label: "Analytics OS" },
  { id: "whatif", label: "What-If Simulator" },
  { id: "reminders", label: "Smart Reminders" },
  { id: "goals", label: "Goal Tracker" },
];

export function Hero() {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; z: number; scale: number }>>({});
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Simulated AI Typing Cycle States
  const [simText, setSimText] = useState("");
  const [simIndex, setSimIndex] = useState(0);
  const [simPhase, setSimPhase] = useState<"typing" | "sending" | "processing" | "completed">("typing");
  const [resultsToShow, setResultsToShow] = useState<number>(0);

  const simPrompts = [
    {
      text: "Remind me to pay my credit card bill on June 30 at 9am.",
      module: "reminders",
      outputs: [
        { label: "Reminder Extracted", desc: "Pay credit card bill", icon: Bell, color: "text-indigo-500" },
        { label: "Calendar Blocked", desc: "June 30, 9:00 AM", icon: Calendar, color: "text-blue-500" },
        { label: "Telegram Sync Active", desc: "Notification linked", icon: TelegramIcon, color: "text-sky-500" },
        { label: "Success Probability", desc: "98% (No overlaps)", icon: Zap, color: "text-amber-500" }
      ]
    },
    {
      text: "I have too many tasks. Optimize my daily planner and clear working hours.",
      module: "planner",
      outputs: [
        { label: "Working Hours Parsed", desc: "9:00 AM - 5:00 PM", icon: Clock, color: "text-violet-500" },
        { label: "Focus Blocks Created", desc: "3 Deep work windows", icon: Zap, color: "text-orange-500" },
        { label: "Dynamic Buffer Shifted", desc: "90m meeting buffer", icon: Calendar, color: "text-blue-500" },
        { label: "Productivity Target", desc: "Score boosted +15%", icon: Target, color: "text-emerald-500" }
      ]
    },
    {
      text: "Emergency. I missed my 2 PM milestone deadline.",
      module: "rescue",
      outputs: [
        { label: "Rescue Mode Triggered", desc: "Deadline risk detected", icon: ShieldAlert, color: "text-red-500" },
        { label: "Time-Shifting Blocks", desc: "Pushed low priority task", icon: Clock, color: "text-violet-500" },
        { label: "Alert Sent", desc: "Telegram warning dispatched", icon: TelegramIcon, color: "text-sky-500" },
        { label: "Debrief Note", desc: "Burnout buffer injected", icon: CheckCircle2, color: "text-emerald-500" }
      ]
    }
  ];

  const currentPrompt = simPrompts[simIndex];

  // Simulated Typing Effect Loop
  useEffect(() => {
    let timer: any;
    if (simPhase === "typing") {
      setResultsToShow(0);
      setActiveModule(null);
      if (simText.length < currentPrompt.text.length) {
        timer = setTimeout(() => {
          setSimText(currentPrompt.text.slice(0, simText.length + 1));
        }, 45);
      } else {
        timer = setTimeout(() => {
          setSimPhase("sending");
        }, 1200);
      }
    } else if (simPhase === "sending") {
      // Trigger sending flash
      setActiveModule(currentPrompt.module);
      timer = setTimeout(() => {
        setSimPhase("processing");
      }, 800);
    } else if (simPhase === "processing") {
      // Show output cards one by one
      if (resultsToShow < currentPrompt.outputs.length) {
        timer = setTimeout(() => {
          setResultsToShow((prev) => prev + 1);
        }, 750);
      } else {
        timer = setTimeout(() => {
          setSimPhase("completed");
        }, 4000);
      }
    } else if (simPhase === "completed") {
      // Transition to next prompt
      timer = setTimeout(() => {
        setSimText("");
        setSimIndex((prev) => (prev + 1) % simPrompts.length);
        setSimPhase("typing");
      }, 1500);
    }

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simText, simPhase, simIndex, resultsToShow]);

  return (
    <section className="relative min-h-[105vh] bg-slate-50/20 flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden px-6">
      
      {/* Dynamic background gradients */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(168,85,247,0.06),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[350px] h-[350px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
        
        {/* Left Column - Hero Content & Prompt Sim */}
        <div className="lg:col-span-6 flex flex-col gap-6 text-left">
          
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 border border-slate-200 bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full w-max shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-500 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wide text-slate-700 uppercase">
              Meet Taskify AI OS
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-slate-900"
          >
            This is not a task manager. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600">
              This is your Second Brain.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-lg"
          >
            Taskify is an autonomous operating system that listens, reasons, schedules, and shifts priorities to protect your calendar from burnout.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex items-center gap-4 mt-2"
          >
            <Link href="/signup">
              <button className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all hover:-translate-y-0.5 cursor-pointer magnetic-btn">
                Launch System Control
              </button>
            </Link>
            <Link href="#features">
              <button className="px-5 py-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs shadow-sm hover:bg-slate-50 transition-all cursor-pointer magnetic-btn">
                Explore Simulator
              </button>
            </Link>
          </motion.div>

          {/* Interactive AI Prompt Demonstration Console */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.32 }}
            className="mt-6 border border-slate-200 bg-white/70 backdrop-blur-xl rounded-2xl p-5 shadow-xl shadow-slate-100 flex flex-col gap-4 relative"
          >
            <div className="absolute top-3 right-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            </div>

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
              Interactive AI OS Pipeline
            </div>

            {/* Prompt Input Area */}
            <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl flex items-center justify-between gap-3 relative min-h-[52px]">
              <span className="text-xs font-semibold text-slate-700 leading-relaxed pr-10">
                {simText}
                <span className="w-1.5 h-3.5 bg-violet-500 inline-block animate-pulse ml-0.5" />
              </span>

              <button
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  simPhase === "sending" || simPhase === "processing"
                    ? "bg-violet-600 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pipeline Outputs Block */}
            <div className="flex flex-col gap-2.5 min-h-[140px]">
              <AnimatePresence>
                {simPhase === "processing" && resultsToShow === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-6 gap-2"
                  >
                    <div className="w-6 h-6 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                      Brain processing intent...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-2.5">
                {currentPrompt.outputs.slice(0, resultsToShow).map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                      className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center gap-3"
                    >
                      <div className={`p-2 rounded-lg bg-slate-50 ${item.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                          {item.label}
                        </span>
                        <span className="text-xs font-bold text-slate-700 truncate block mt-0.5">
                          {item.desc}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - 3D Brain & Floating Orb Modules */}
        <div className="lg:col-span-6 h-[500px] lg:h-[650px] relative flex items-center justify-center">
          
          {/* Radial depth glow behind brain */}
          <div className="absolute w-[350px] h-[350px] rounded-full bg-violet-600/5 blur-[80px] pointer-events-none z-0" />

          {/* AI 3D Neural Sphere */}
          <AIBrain 
            activeModule={activeModule}
            hoveredModule={hoveredModule}
            onOrbitUpdate={setPositions}
          />

          {/* Orbit HTML Cards overlay */}
          {orbitItems.map((item) => {
            const pos = positions[item.id];
            if (!pos) return null;

            const Icon = iconsMap[item.id];
            const isHovered = hoveredModule === item.id;
            const isActive = activeModule === item.id;
            const colorClass = colorsMap[item.id] || "border-slate-100 bg-white/80";

            return (
              <motion.div
                key={item.id}
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  zIndex: Math.round(pos.z + 100),
                  transform: "translate(-50%, -50%)",
                }}
                className="pointer-events-auto"
              >
                <div
                  onMouseEnter={() => setHoveredModule(item.id)}
                  onMouseLeave={() => setHoveredModule(null)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm cursor-pointer transition-all duration-300 ${colorClass} ${
                    isHovered || isActive
                      ? "scale-110 shadow-md ring-2 ring-violet-500/20"
                      : "opacity-80 scale-95"
                  }`}
                  style={{
                    transform: `scale(${pos.scale * 0.95})`,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold tracking-tight select-none">
                    {item.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
