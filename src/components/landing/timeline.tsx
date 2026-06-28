"use client";

import { motion } from "framer-motion";
import { 
  Volume2, Brain, CheckSquare, Bell, Calendar, 
  ShieldAlert, Eye, Target, TrendingUp 
} from "lucide-react";

interface StepNode {
  title: string;
  desc: string;
  icon: any;
  color: string;
  bg: string;
}

const TIMELINE_STEPS: StepNode[] = [
  { 
    title: "User Speaks", 
    desc: "Voice message, Telegram chat, or plain text is received by the unified orchestrator.",
    icon: Volume2,
    color: "text-rose-500",
    bg: "bg-rose-50 border-rose-200/50"
  },
  { 
    title: "AI Understands Intent", 
    desc: "Gemini reasons about user intent, extracting context, time zones, and key objectives.",
    icon: Brain,
    color: "text-violet-500",
    bg: "bg-violet-50 border-violet-200/50"
  },
  { 
    title: "Extracts Tasks", 
    desc: "Identifies deliverables, estimated efforts, dependencies, and assigns priorities.",
    icon: CheckSquare,
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-200/50"
  },
  { 
    title: "Creates Reminders", 
    desc: "Generates custom push triggers, synced automatically to the Telegram linkage channel.",
    icon: Bell,
    color: "text-indigo-500",
    bg: "bg-indigo-50 border-indigo-200/50"
  },
  { 
    title: "Schedules Calendar", 
    desc: "Paints a daily execution plan on your calendar based on your configured working hours.",
    icon: Calendar,
    color: "text-sky-500",
    bg: "bg-sky-50 border-sky-200/50"
  },
  { 
    title: "Predicts Risk Rates", 
    desc: "Measures task overlaps, sleep values, and historical completion data to predict risk ratios.",
    icon: ShieldAlert,
    color: "text-orange-500",
    bg: "bg-orange-50 border-orange-200/50"
  },
  { 
    title: "Monitors Live Execution", 
    desc: "Taskify sits quietly in your background, waiting to self-heal conflicts if milestones get delayed.",
    icon: Eye,
    color: "text-teal-500",
    bg: "bg-teal-50 border-teal-200/50"
  },
  { 
    title: "Learns Work Behavior", 
    desc: "Tracks micro-wins, focus timer sessions, and peak execution windows.",
    icon: Target,
    color: "text-emerald-500",
    bg: "bg-emerald-50 border-emerald-200/50"
  },
  { 
    title: "Improves Tomorrow", 
    desc: "Prepares a nightly debrief to optimize tomorrow's plan before you even wake up.",
    icon: TrendingUp,
    color: "text-amber-500",
    bg: "bg-amber-50 border-amber-200/50"
  }
];

export function Timeline() {
  return (
    <section className="py-24 bg-white relative overflow-hidden px-6 border-t border-slate-100">
      
      {/* Decorative lines */}
      <div className="absolute right-0 top-1/4 w-[350px] h-[350px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute left-0 bottom-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative">
        
        {/* Section Header */}
        <div className="text-center mb-20 max-w-xl mx-auto flex flex-col gap-4">
          <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest block">
            The Autonomous Cycle
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-none">
            One Conversation. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
              Infinite Execution.
            </span>
          </h2>
          <p className="text-sm text-slate-500 font-semibold leading-relaxed">
            Watch how Taskify processes a single query into a continuous, self-correcting daily scheduling cycle.
          </p>
        </div>

        {/* Vertical Center Line */}
        <div className="absolute left-4 md:left-1/2 top-[240px] bottom-[80px] w-0.5 border-l-2 border-dashed border-slate-200 -translate-x-1/2 z-0" />

        {/* Nodes Wrapper */}
        <div className="space-y-12 relative z-10">
          {TIMELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isEven = idx % 2 === 0;

            return (
              <div 
                key={idx}
                className={`flex flex-col md:flex-row items-start md:items-center justify-between w-full relative ${
                  isEven ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Visual node marker */}
                <div className="absolute left-4 md:left-1/2 w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center -translate-x-1/2 shadow-md z-20">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                </div>

                {/* Left/Right Card Panel */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? -40 : 40, y: 15 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={`w-[calc(100%-48px)] ml-12 md:ml-0 md:w-[44%] p-5 rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex gap-4`}
                >
                  <div className={`p-2.5 rounded-xl border shrink-0 h-max ${step.bg} ${step.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Step 0{idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{step.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">{step.desc}</p>
                  </div>
                </motion.div>

                {/* Spacer on the opposite side to balance the grid layout */}
                <div className="hidden md:block w-[44%]" />
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
