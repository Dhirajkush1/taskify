"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Volume2, ShieldAlert, CheckCircle2, 
  Smartphone, MessageSquare, Flame, Sparkles, 
  Plus, Minus, RefreshCw, BarChart
} from "lucide-react";

export function Features() {
  // Voice Simulator State
  const [voiceText, setVoiceText] = useState("");
  const [voicePhase, setVoicePhase] = useState<"idle" | "listening" | "transcribing" | "completed">("listening");
  
  // Telegram Simulator State
  const [tgMessages, setTgMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([]);
  const [tgCycle, setTgCycle] = useState(0);

  // Rescue Mode State
  const [rescueActive, setRescueActive] = useState(false);
  const [riskProgress, setRiskProgress] = useState(85);

  // What-if Simulator State
  const [sleepHrs, setSleepHrs] = useState(7.5);
  const [meetingHrs, setMeetingHrs] = useState(3);
  const [hasBuffer, setHasBuffer] = useState(false);
  const [probValue, setProbValue] = useState(74);

  // 1. Voice Loop Simulator
  useEffect(() => {
    let timer: any;
    const fullText = "Schedule a deep focus session this afternoon at 3:00 PM.";
    
    if (voicePhase === "listening") {
      timer = setTimeout(() => {
        setVoicePhase("transcribing");
      }, 2000);
    } else if (voicePhase === "transcribing") {
      if (voiceText.length < fullText.length) {
        timer = setTimeout(() => {
          setVoiceText(fullText.slice(0, voiceText.length + 1));
        }, 50);
      } else {
        timer = setTimeout(() => {
          setVoicePhase("completed");
        }, 1200);
      }
    } else if (voicePhase === "completed") {
      timer = setTimeout(() => {
        setVoiceText("");
        setVoicePhase("listening");
      }, 3500);
    }

    return () => clearTimeout(timer);
  }, [voiceText, voicePhase]);

  // 2. Telegram message simulation
  useEffect(() => {
    let timer: any;
    const conversation = [
      { sender: "user" as const, text: "/add Finish layout review today at 4:30 PM" },
      { sender: "bot" as const, text: "🤖 Task added! 'Finish layout review'. Priority: High. I will message you here on Telegram 15 minutes before the deadline." }
    ];

    if (tgCycle === 0) {
      setTgMessages([]);
      timer = setTimeout(() => {
        setTgMessages([conversation[0]]);
        setTgCycle(1);
      }, 1500);
    } else if (tgCycle === 1) {
      timer = setTimeout(() => {
        setTgMessages(prev => [...prev, conversation[1]]);
        setTgCycle(2);
      }, 2000);
    } else if (tgCycle === 2) {
      timer = setTimeout(() => {
        setTgCycle(0);
      }, 4500);
    }

    return () => clearTimeout(timer);
  }, [tgCycle]);

  // 3. Rescue Mode simulation
  useEffect(() => {
    let timer: any;
    if (!rescueActive) {
      timer = setTimeout(() => {
        setRescueActive(true);
        setRiskProgress(95); // High risk alert
      }, 3000);
    } else {
      timer = setTimeout(() => {
        setRiskProgress(24); // Safe after automatic rescheduling
        setRescueActive(false);
      }, 4500);
    }
    return () => clearTimeout(timer);
  }, [rescueActive]);

  // 4. Calculate what-if probability dynamically
  useEffect(() => {
    // Base math simulation
    let base = 65;
    base += (sleepHrs - 6) * 8; // More sleep is better
    base -= (meetingHrs) * 6;   // More meetings is worse
    if (hasBuffer) base += 15;  // Buffers increase success rate
    
    // Clamp to 5-99%
    const finalProb = Math.min(99, Math.max(5, Math.round(base)));
    setProbValue(finalProb);
  }, [sleepHrs, meetingHrs, hasBuffer]);

  return (
    <section id="features" className="py-24 bg-slate-50/10 relative px-6 border-t border-slate-100">
      
      {/* Decorative center orb */}
      <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto flex flex-col gap-4">
          <span className="text-[11px] font-bold text-violet-600 uppercase tracking-widest block">
            System Capabilities
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
            An operating system built to <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">execute</span>.
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Taskify replaces standard task cards with live automated pipelines that predict, shifting calendar schedules dynamically before deadlines trigger.
          </p>
        </div>

        {/* 2x2 Interactive Feature Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Card 1: Voice Sync Waveform Simulator */}
          <div className="p-6 md:p-8 rounded-3xl border border-slate-200/60 bg-white shadow-md shadow-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/5 border border-rose-200/50 text-rose-500">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Adaptive Voice Control</h3>
                <p className="text-[11px] text-slate-500 font-medium">Talk naturally. Watch Taskify transcript-parse on the fly.</p>
              </div>
            </div>

            {/* Simulated Waveform & Console */}
            <div className="bg-slate-950 rounded-2xl p-5 flex flex-col gap-4 relative min-h-[160px] justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-500">Voice Feed Input</span>
                <span className={`text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold ${
                  voicePhase === "listening" ? "bg-rose-500/10 text-rose-400 animate-pulse" : "bg-neutral-800 text-neutral-400"
                }`}>
                  {voicePhase === "listening" ? "Listening..." : voicePhase === "transcribing" ? "Transcribing..." : "Done"}
                </span>
              </div>

              {/* Soundwaves Canvas Simulation */}
              <div className="flex items-center justify-center gap-1.5 h-10">
                {Array.from({ length: 16 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: voicePhase === "listening" 
                        ? [12, Math.sin(i) * 35 + 20, 12] 
                        : voicePhase === "transcribing" 
                        ? [6, 12, 6] 
                        : 4
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.05,
                      ease: "easeInOut"
                    }}
                    className={`w-1 rounded-full ${
                      voicePhase === "listening" ? "bg-rose-500" : voicePhase === "transcribing" ? "bg-rose-500/50" : "bg-neutral-800"
                    }`}
                  />
                ))}
              </div>

              {/* Typed Result Bubble */}
              <div className="text-xs font-semibold text-neutral-200 bg-neutral-900 border border-neutral-850 p-3 rounded-xl min-h-[46px]">
                {voiceText}
                {voicePhase === "transcribing" && <span className="w-1.5 h-3 bg-rose-500 inline-block animate-pulse ml-0.5" />}
                {voicePhase === "completed" && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 text-emerald-400 text-[10px] mt-1 font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 fill-current text-emerald-500" /> Action Registered
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Telegram Link Mockup Phone */}
          <div className="p-6 md:p-8 rounded-3xl border border-slate-200/60 bg-white shadow-md shadow-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/5 border border-sky-200/50 text-sky-500">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Telegram Link Handshake</h3>
                <p className="text-[11px] text-slate-500 font-medium">Add, schedule, and receive warning signals from chat.</p>
              </div>
            </div>

            {/* Mobile Phone mock inside Web Page */}
            <div className="bg-slate-100 rounded-2xl p-4 flex flex-col justify-between relative min-h-[160px] border border-slate-200/60">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-[9px] font-bold text-slate-600">Telegram App</span>
                </div>
                <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">TaskifyAI Bot</span>
              </div>

              {/* Message Log */}
              <div className="flex flex-col gap-2 mt-3 flex-1 min-h-[90px]">
                {tgMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.sender === "user" ? 25 : -25 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`max-w-[85%] p-2.5 rounded-2xl text-[10px] font-medium leading-relaxed ${
                      msg.sender === "user"
                        ? "self-end bg-sky-500 text-white rounded-tr-none"
                        : "self-start bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Dynamic Rescue Mode shift simulator */}
          <div className="p-6 md:p-8 rounded-3xl border border-slate-200/60 bg-white shadow-md shadow-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-500/5 border border-red-200/50 text-red-500">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deadline Rescue Engine</h3>
                <p className="text-[11px] text-slate-500 font-medium">Automatic buffer re-allocation to protect at-risk milestones.</p>
              </div>
            </div>

            {/* Rescue simulation grid */}
            <div className="bg-slate-950 rounded-2xl p-5 flex flex-col gap-4 relative min-h-[160px] justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-500">Emergency Handler</span>
                <span className={`text-[8px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-black ${
                  rescueActive ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  {rescueActive ? "Conflict Active" : "Schedule Safe"}
                </span>
              </div>

              {/* Shifting Schedule Mock */}
              <div className="flex flex-col gap-2">
                <div className="p-3 rounded-xl border border-neutral-900 bg-neutral-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-200 block">Prepare Product Demo</span>
                    <span className="text-[9px] text-neutral-500 uppercase font-black block mt-0.5">Due today at 3:00 PM</span>
                  </div>
                  <div className="text-[10px] font-black text-rose-400">At Risk</div>
                </div>

                <motion.div 
                  animate={{
                    x: rescueActive ? [0, 45, 0] : 0,
                    borderColor: rescueActive ? "rgba(139, 92, 246, 0.4)" : "rgba(255, 255, 255, 0.05)"
                  }}
                  className="p-3 rounded-xl border border-neutral-900 bg-neutral-900/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-neutral-200 block">Routine Email Declutter</span>
                    <span className="text-[9px] text-neutral-500 uppercase font-black block mt-0.5">
                      {rescueActive ? "Shifted to Tomorrow 9 AM" : "Scheduled Today at 2:00 PM"}
                    </span>
                  </div>
                  <div className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${
                    rescueActive ? "bg-violet-500/20 text-violet-400" : "bg-neutral-800 text-neutral-400"
                  }`}>
                    {rescueActive ? "Rescheduled" : "Active"}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Card 4: What-If Success Probability Simulator */}
          <div className="p-6 md:p-8 rounded-3xl border border-slate-200/60 bg-white shadow-md shadow-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-orange-500/5 border border-orange-200/50 text-orange-500">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">What-If Risk Analytics</h3>
                <p className="text-[11px] text-slate-500 font-medium">Dynamically calculate your likelihood of meeting targets.</p>
              </div>
            </div>

            {/* Config & Probability score gauge */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between min-h-[160px]">
              
              {/* Interactive controller sliders */}
              <div className="flex flex-col gap-3 w-full md:w-[60%]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300">Sleep Hours</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setSleepHrs(prev => Math.max(4, prev - 0.5))} className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[10px] hover:bg-slate-700">-</button>
                    <span className="text-[10px] font-mono font-bold w-8 text-center">{sleepHrs}h</span>
                    <button onClick={() => setSleepHrs(prev => Math.min(10, prev + 0.5))} className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[10px] hover:bg-slate-700">+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300">Meetings</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setMeetingHrs(prev => Math.max(0, prev - 1))} className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[10px] hover:bg-slate-700">-</button>
                    <span className="text-[10px] font-mono font-bold w-8 text-center">{meetingHrs}h</span>
                    <button onClick={() => setMeetingHrs(prev => Math.min(8, prev + 1))} className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[10px] hover:bg-slate-700">+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300">Risk Buffer</span>
                  <button 
                    onClick={() => setHasBuffer(!hasBuffer)}
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider transition-all ${
                      hasBuffer ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {hasBuffer ? "Injected" : "None"}
                  </button>
                </div>
              </div>

              {/* Gauge display */}
              <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-neutral-800 relative select-none">
                <span className="text-xl font-black text-white">{probValue}%</span>
                <span className="text-[8px] text-neutral-500 uppercase font-black">Success Rate</span>
                
                {/* Glowing border ring */}
                <div 
                  className={`absolute -inset-1 rounded-full border-2 filter blur-sm pointer-events-none transition-all duration-300 ${
                    probValue > 85 ? "border-emerald-400" : probValue > 60 ? "border-amber-400" : "border-red-400"
                  }`} 
                />
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
