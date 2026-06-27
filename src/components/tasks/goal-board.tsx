"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Milestone, Plus, Calendar, Loader2, Sparkles, CheckCircle2, ChevronRight, ListTodo, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Goal {
  id: string;
  title: string;
  description: string;
  target_date: string;
  status: string;
}

interface MilestoneData {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  target_date: string;
  status: string;
}

interface TaskData {
  id: string;
  milestone_id: string;
  title: string;
  status: string;
  priority: string;
}

export function GoalBoard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);

  // Modals / forms
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalDate, setGoalDate] = useState("");

  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDesc, setMilestoneDesc] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [goalsRes, milestonesRes, tasksRes] = await Promise.all([
        supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("milestones").select("*").order("created_at", { ascending: true }),
        supabase.from("tasks").select("id, milestone_id, title, status, priority").eq("user_id", user.id),
      ]);

      setGoals(goalsRes.data || []);
      setMilestones(milestonesRes.data || []);
      setTasks(tasksRes.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("goals").insert({
        user_id: user.id,
        title: goalTitle,
        description: goalDesc || null,
        target_date: goalDate || null,
        status: "active",
      });

      if (!error) {
        setGoalTitle("");
        setGoalDesc("");
        setGoalDate("");
        setShowGoalForm(false);
        loadData();
      }
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle || !selectedGoalId) return;

    // 1. Insert Milestone
    const { data: milestoneData, error } = await supabase
      .from("milestones")
      .insert({
        goal_id: selectedGoalId,
        title: milestoneTitle,
        description: milestoneDesc || null,
        target_date: milestoneDate || null,
        status: "todo",
      })
      .select()
      .single();

    if (!error && milestoneData) {
      const newMilestoneId = milestoneData.id;
      const parentGoal = goals.find((g) => g.id === selectedGoalId);

      setMilestoneTitle("");
      setMilestoneDesc("");
      setMilestoneDate("");
      setShowMilestoneForm(false);
      
      // Load milestone instantly to UI
      await loadData();

      // 2. Trigger AI Auto-Decomposition
      if (parentGoal) {
        setDecomposingId(newMilestoneId);
        try {
          await fetch("/api/ai/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goalTitle: parentGoal.title,
              milestoneId: newMilestoneId,
              milestoneTitle: milestoneData.title,
              milestoneDescription: milestoneData.description,
            }),
          });
        } catch (err) {
          console.error("AI decomposition request failed:", err);
        } finally {
          setDecomposingId(null);
          loadData(); // Reload to fetch newly decomposed tasks!
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Goal Achievement Board</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Map high-level goals into milestones and AI-decomposed task tracks.</p>
        </div>
        <button
          onClick={() => setShowGoalForm(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02]"
          style={{ background: "var(--primary)" }}
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Forms Overlay */}
      <AnimatePresence>
        {showGoalForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleCreateGoal}
              className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl max-w-md w-full space-y-4"
            >
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-400" />
                Create New Goal
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Goal title (e.g., Pass IELTS Exam)"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-500"
                  required
                />
                <textarea
                  placeholder="Description..."
                  value={goalDesc}
                  onChange={(e) => setGoalDesc(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-500 h-20 resize-none"
                />
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoalForm(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  Create Goal
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {showMilestoneForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleCreateMilestone}
              className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl max-w-md w-full space-y-4"
            >
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <Milestone className="w-5 h-5 text-amber-400" />
                Add Milestone
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Milestone Title (e.g. Reading Practice)"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-500"
                  required
                />
                <textarea
                  placeholder="Description..."
                  value={milestoneDesc}
                  onChange={(e) => setMilestoneDesc(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-500 h-20 resize-none"
                />
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMilestoneForm(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  Add & Decompose
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Goal Cards Grid */}
      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center flex flex-col items-center justify-center gap-3">
          <Target className="w-10 h-10 text-neutral-600" />
          <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
            You haven&apos;t added any goals yet. Build a strategic vision by creating your first Goal!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const goalMilestones = milestones.filter((m) => m.goal_id === goal.id);

            return (
              <motion.div
                key={goal.id}
                whileHover={{ y: -2 }}
                className="rounded-2xl p-5 border flex flex-col gap-4"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Goal Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-400">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-neutral-100">{goal.title}</h3>
                      {goal.target_date && (
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> Due: {new Date(goal.target_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedGoalId(goal.id);
                      setShowMilestoneForm(true);
                    }}
                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-500/5 border border-violet-500/10 px-2.5 py-1 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Milestone
                  </button>
                </div>

                {/* Description */}
                {goal.description && (
                  <p className="text-xs text-neutral-400 leading-relaxed bg-white/5 p-3 rounded-xl">
                    {goal.description}
                  </p>
                )}

                {/* Milestones List */}
                <div className="space-y-3.5 mt-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Milestones & AI Tracks
                  </h4>

                  {goalMilestones.length === 0 ? (
                    <p className="text-[10px] italic text-neutral-600">No milestones defined yet.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {goalMilestones.map((milestone) => {
                        const childTasks = tasks.filter((t) => t.milestone_id === milestone.id);
                        const completed = childTasks.filter((t) => t.status === "done").length;
                        const percent = childTasks.length > 0 ? Math.round((completed / childTasks.length) * 100) : 0;
                        const isDecomposing = decomposingId === milestone.id;

                        return (
                          <div
                            key={milestone.id}
                            className="border border-neutral-800/60 p-3 rounded-xl bg-neutral-900/40 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Milestone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="text-xs font-bold text-neutral-200 leading-snug">
                                  {milestone.title}
                                </span>
                              </div>
                              <span className="text-[9px] text-neutral-500 font-extrabold">{percent}%</span>
                            </div>

                            {/* Milestone Progress bar */}
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>

                            {/* AI Tasks Loader */}
                            {isDecomposing && (
                              <div className="flex items-center gap-1.5 text-[9px] text-amber-400 font-semibold animate-pulse">
                                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                Clutch AI is decomposing into task tracks...
                              </div>
                            )}

                            {/* child tasks checklist */}
                            {childTasks.length > 0 && !isDecomposing && (
                              <ul className="flex flex-col gap-1.5 pt-1 border-t border-neutral-800/40 mt-1">
                                {childTasks.map((task) => (
                                  <li
                                    key={task.id}
                                    className="flex items-center justify-between text-[10px] text-neutral-400"
                                  >
                                    <span className="flex items-center gap-1.5 max-w-[80%]">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === "done" ? "bg-emerald-400" : "bg-neutral-600"}`} />
                                      <span className={task.status === "done" ? "line-through opacity-50" : ""}>{task.title}</span>
                                    </span>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                                      task.priority === "critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                      task.priority === "high" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "bg-neutral-800 text-neutral-400"
                                    }`}>
                                      {task.priority}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
