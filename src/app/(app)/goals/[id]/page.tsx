"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { 
  Target, Calendar, Flame, AlertCircle, Activity, 
  Sparkles, ShieldAlert, ArrowLeft, Loader2, HelpCircle,
  Plus, CheckSquare, Zap, Play, CheckCircle2, ChevronRight,
  ClipboardList
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  deadline?: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date: string;
  status: string;
  completion_percentage: number;
  reward?: string;
  risk?: string;
  tasks?: Task[];
}

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  term: string;
  target_date: string;
  status: string;
  health_score: number;
  momentum_score: number;
  consistency: number;
  streak: number;
  blueprint?: {
    difficulty: string;
    required_hours: number;
    weekly_commitment_hours: number;
    daily_commitment_minutes: number;
    potential_obstacles: string[];
    emergency_recovery_plan: string;
    confidence_score: number;
    summary: string;
  };
  forecast?: {
    success_probability: number;
    estimated_completion_date: string;
    risk_score: number;
  };
  milestones?: Milestone[];
  habits?: Array<{
    id: string;
    title: string;
    description: string;
    frequency: string;
    streak: number;
  }>;
}

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  // Checkin Modal state
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [moodEnergy, setMoodEnergy] = useState(5);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Simulation state
  const [simulationPrompt, setSimulationPrompt] = useState("");
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [runningSimulation, setRunningSimulation] = useState(false);

  // Replanning state
  const [replanPrompt, setReplanPrompt] = useState("");
  const [replanResult, setReplanResult] = useState<any | null>(null);
  const [runningReplan, setRunningReplan] = useState(false);

  const fetchGoalDetails = async () => {
    try {
      const res = await fetch(`/api/goals/${id}`);
      if (!res.ok) throw new Error("Goal not found");
      const data = await res.json();
      setGoal(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load goal details");
      router.push("/goals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoalDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Submit checkin
  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCheckin(true);

    try {
      const res = await fetch(`/api/goals/${id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood_energy: moodEnergy,
          notes: checkinNotes,
        }),
      });

      if (!res.ok) throw new Error("Failed to post checkin");
      
      toast.success("Daily check-in completed! Telemetry metrics updated.");
      setCheckinNotes("");
      setShowCheckinModal(false);
      fetchGoalDetails();
    } catch (err: any) {
      toast.error(err.message || "Check-in failed");
    } finally {
      setSubmittingCheckin(false);
    }
  };

  // Run Simulation
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulationPrompt.trim() || runningSimulation) return;
    setRunningSimulation(true);
    setSimulationResult(null);

    try {
      const res = await fetch(`/api/goals/${id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: simulationPrompt }),
      });

      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();
      setSimulationResult(data);
      toast.success("Simulation complete! Check the projected timeline impact.");
    } catch (err: any) {
      toast.error(err.message || "Scenario simulation failed");
    } finally {
      setRunningSimulation(false);
    }
  };

  // Adapt Plan
  const handleAdaptPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replanPrompt.trim() || runningReplan) return;
    setRunningReplan(true);
    setReplanResult(null);

    try {
      const res = await fetch(`/api/goals/${id}/replan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident: replanPrompt }),
      });

      if (!res.ok) throw new Error("Rescheduling failed");
      const data = await res.json();
      setReplanResult(data);
      toast.success("AI Replanner finished! Action items adapted to physical constraints.");
      setReplanPrompt("");
      fetchGoalDetails();
    } catch (err: any) {
      toast.error(err.message || "Replanning failed");
    } finally {
      setRunningReplan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
        <p className="text-xs text-slate-400 mt-2 font-semibold">Calibrating goals telemetry...</p>
      </div>
    );
  }

  if (!goal) return null;

  // Calculate high-level progress details
  const totalTasks = goal.milestones?.reduce((acc, m) => acc + (m.tasks?.length ?? 0), 0) ?? 0;
  const completedTasks = goal.milestones?.reduce((acc, m) => acc + (m.tasks?.filter((t) => t.status === "done").length ?? 0), 0) ?? 0;
  const taskProgressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const healthRating = goal.health_score >= 85 ? "Excellent" : goal.health_score >= 65 ? "Recoverable" : goal.health_score >= 45 ? "Danger" : "Critical";
  const healthBadgeColor = goal.health_score >= 85 ? "text-emerald-600 bg-emerald-50" : goal.health_score >= 65 ? "text-blue-600 bg-blue-50" : goal.health_score >= 45 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto" style={{ background: "var(--background)" }}>
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/goals" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Goals
        </Link>

        <button
          onClick={() => setShowCheckinModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
        >
          <CheckCircle2 className="w-4 h-4" />
          Daily Check-In
        </button>
      </div>

      {/* Main Goal info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Stats card */}
        <div className="glass p-6 rounded-2xl lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-400 capitalize">
                {goal.category}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 capitalize">
                {goal.term?.replace("_", " ")}
              </span>
            </div>

            <h2 className="text-xl font-black text-white mt-4">{goal.title}</h2>
            <p className="text-xs text-slate-400 font-semibold mt-1">{goal.description}</p>

            {/* Target dates */}
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mt-4">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Target Deadline: {goal.target_date}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/5 mt-6">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Goal Health</span>
              <p className={cn("text-sm font-black mt-0.5", healthBadgeColor.split(" ")[0])}>
                {goal.health_score} ({healthRating})
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Success Chance</span>
              <p className="text-sm font-black text-violet-600 mt-0.5">
                {goal.forecast?.success_probability ?? 85}%
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Consistency</span>
              <p className="text-sm font-black text-white mt-0.5">
                {goal.consistency}%
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Streak</span>
              <p className="text-sm font-black text-amber-600 mt-0.5 flex items-center gap-1">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                {goal.streak} days
              </p>
            </div>
          </div>
        </div>

        {/* AI Coach recommendation card */}
        <div className="glass p-6 rounded-2xl border border-white/10 bg-violet-950/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">AI Goal Coach</h3>
          </div>

          <div className="flex-1 py-4 flex flex-col justify-center">
            <blockquote className="text-xs italic text-slate-300 leading-relaxed font-semibold">
              &ldquo;
              {goal.health_score >= 80 
                ? "Excellent consistency! Your current momentum guarantees we hit our milestone deadlines early. Maintain the water and habit routine." 
                : goal.health_score >= 50
                ? "We are falling slightly behind on our milestone target dates. Skipping tasks today reduces success probability. Focus on critical tasks."
                : "Emergency mode required. Missed tasks have pushed progress into risk zones. Run the Adaptive Replanner below to modify requirements."}
              &rdquo;
            </blockquote>
          </div>

          <div className="text-[10px] text-slate-400 font-bold uppercase">
            Forecasted Finish: {goal.forecast?.estimated_completion_date ?? goal.target_date}
          </div>
        </div>
      </div>

      {/* Timeline & Actions Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Vertical Timeline Card (Milestones + Tasks) */}
        <div className="glass p-6 rounded-2xl border border-white/10 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-400" />
              <h3 className="text-sm font-black text-white">Milestone Roadmap Timeline</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500">
              Tasks: {completedTasks} / {totalTasks} ({taskProgressPct}%)
            </span>
          </div>

          <div className="space-y-6 relative pl-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
            {goal.milestones?.map((ms, index) => {
              const msDone = ms.status === "done";
              return (
                <div key={ms.id} className="relative space-y-3">
                  {/* Circle dot on line */}
                  <div 
                    className={cn(
                      "absolute -left-[21px] top-1 w-4 h-4 rounded-full border-2 bg-slate-900 flex items-center justify-center",
                      msDone ? "border-emerald-500 bg-emerald-50" : "border-slate-750"
                    )}
                  >
                    {msDone && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />}
                  </div>

                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className={cn("text-xs font-black", msDone ? "text-slate-500 line-through" : "text-white")}>
                        {ms.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Target: {ms.target_date}
                      </span>
                    </div>
                    {ms.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{ms.description}</p>
                    )}
                  </div>

                  {/* Tasks nested inside milestones */}
                  {ms.tasks && ms.tasks.length > 0 && (
                    <div className="space-y-2 pl-4">
                      {ms.tasks.map((task) => {
                        const taskDone = task.status === "done";
                        return (
                          <div 
                            key={task.id} 
                            className="flex items-start justify-between p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-xs"
                          >
                            <div className="flex items-start gap-2">
                              <CheckSquare className={cn("w-4 h-4 mt-0.5", taskDone ? "text-emerald-500" : "text-slate-500")} />
                              <div>
                                <p className={cn("font-bold text-slate-200", taskDone && "text-slate-500 line-through")}>
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">{task.description}</p>
                                )}
                              </div>
                            </div>

                            {task.priority === "critical" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 uppercase">
                                Critical
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Micro reward and risk block */}
                  {(ms.reward || ms.risk) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 pt-1">
                      {ms.reward && (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                          <span className="font-bold uppercase tracking-wider block mb-0.5">Achievement Reward</span>
                          {ms.reward}
                        </div>
                      )}
                      {ms.risk && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400">
                          <span className="font-bold uppercase tracking-wider block mb-0.5">Risk Warning</span>
                          {ms.risk}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive What-If Simulation and Replanning panels */}
        <div className="space-y-6">
          {/* What-If Panel */}
          <div className="glass p-6 rounded-2xl border border-white/10 bg-white/5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">What-If Simulation</h3>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. What if I skip work for 3 days?"
                value={simulationPrompt}
                onChange={(e) => setSimulationPrompt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-white focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={!simulationPrompt.trim() || runningSimulation}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50"
              >
                {runningSimulation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Run Scenario Prediction
                  </>
                )}
              </button>
            </form>

            {/* Simulation output */}
            <AnimatePresence>
              {simulationResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/10 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Simulated Chance</span>
                      <p className="font-bold text-indigo-600 mt-0.5">{simulationResult.successProbability}%</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Simulated Completion</span>
                      <p className="font-bold text-slate-800 mt-0.5">{simulationResult.forecastedCompletion}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Timeline Impact</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">{simulationResult.impactText}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-2 text-[10px] text-indigo-700">
                    <span className="font-bold uppercase tracking-wide block">AI Recovery Route</span>
                    {simulationResult.alternative}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Adaptive Replanning Panel */}
          <div className="glass p-6 rounded-2xl border border-white/10 bg-white/5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
              <h3 className="text-xs font-extrabold text-white tracking-wider uppercase">Adaptive Replanner</h3>
            </div>

            <form onSubmit={handleAdaptPlan} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. I injured my shoulder / I travel tomorrow"
                value={replanPrompt}
                onChange={(e) => setReplanPrompt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-white focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={!replanPrompt.trim() || runningReplan}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
              >
                {runningReplan ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Rescheduling Timeline...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Adapt Plan Parameters
                  </>
                )}
              </button>
            </form>

            <AnimatePresence>
              {replanResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/10 space-y-2"
                >
                  <span className="text-emerald-700 font-bold uppercase tracking-wider text-[9px] block">AI Reschedule Actions</span>
                  <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                    {replanResult.adjustmentsSummary}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Check-In Modal overlay */}
      <AnimatePresence>
        {showCheckinModal && (
          <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-black text-white">Goal Progress Check-In</h3>
                <button 
                  onClick={() => setShowCheckinModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCheckinSubmit} className="space-y-4">
                {/* Mood Energy slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Mood / Energy Level</span>
                    <span className="text-violet-600">{moodEnergy} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={moodEnergy}
                    onChange={(e) => setMoodEnergy(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </div>

                {/* notes */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Progress Notes / Journal</label>
                  <textarea
                    rows={3}
                    placeholder="Describe how your roadmap is executing, weight updates, or challenges today..."
                    value={checkinNotes}
                    onChange={(e) => setCheckinNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submittingCheckin}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingCheckin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Computing metrics...
                    </>
                  ) : (
                    "Submit Daily Check-In"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
