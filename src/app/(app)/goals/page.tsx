"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, Search, Target, Award, ShieldAlert, Sparkles, 
  Send, Loader2, ArrowRight, CheckCircle2, ChevronRight,
  TrendingUp, Activity, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  term: string;
  target_date: string;
  status: "active" | "completed" | "paused" | "cancelled";
  health_score: number;
  momentum_score: number;
  consistency: number;
  streak: number;
  forecast?: {
    success_probability: number;
    estimated_completion_date: string;
    risk_score: number;
  };
  milestones?: Array<{
    id: string;
    title: string;
    status: string;
    completion_percentage: number;
  }>;
}

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "archived">("active");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Chat Interview state
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "model"; content: string }>>([
    { role: "model", content: "Hello! I am your Clutch AI Goals Coach. What is the target you want to achieve? Describe it to me, and we will build your execution blueprint." }
  ]);
  const [submittingChat, setSubmittingChat] = useState(false);
  const [generatedBlueprint, setGeneratedBlueprint] = useState<any | null>(null);
  const [creatingGoal, setCreatingGoal] = useState(false);

  // Fetch Goals
  const fetchGoals = async () => {
    try {
      const res = await fetch("/api/goals");
      if (!res.ok) throw new Error("Failed to fetch goals");
      const data = await res.json();
      setGoals(data);
    } catch (err: any) {
      toast.error(err.message || "Error loading goals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  // Handle Interview dialogue submission
  const handleSendChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || submittingChat) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMessage }]);
    setSubmittingChat(true);

    try {
      const res = await fetch("/api/goals/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogue: chatHistory,
          latestMessage: userMessage,
        }),
      });

      if (!res.ok) throw new Error("Interview processing error");
      const data = await res.json();

      if (data.completed && data.blueprint) {
        setGeneratedBlueprint(data.blueprint);
        setChatHistory((prev) => [
          ...prev,
          { role: "model", content: "Perfect! I have compiled your customized Goal Blueprint based on your constraints. Please review the structured strategy details below to confirm." }
        ]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: "model", content: data.question || "Tell me a bit more about your availability." }
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to parse interview response");
    } finally {
      setSubmittingChat(false);
    }
  };

  // Instantiate the goal from blueprint
  const handleConfirmBlueprint = async () => {
    if (!generatedBlueprint || creatingGoal) return;
    setCreatingGoal(true);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: generatedBlueprint }),
      });

      if (!res.ok) throw new Error("Failed to instantiate goal");
      const data = await res.json();

      toast.success("Goal successfully initialized and scheduled!");
      setShowCreateModal(false);
      // Reset creation state
      setGeneratedBlueprint(null);
      setChatHistory([
        { role: "model", content: "Hello! I am your Clutch AI Goals Coach. What is the target you want to achieve? Describe it to me, and we will build your execution blueprint." }
      ]);
      router.push(`/goals/${data.goalId}`);
      fetchGoals();
    } catch (err: any) {
      toast.error(err.message || "Blueprint instantiation failed");
    } finally {
      setCreatingGoal(false);
    }
  };

  // Filtering
  const filteredGoals = goals.filter((g) => {
    const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          g.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === "active") return g.status === "active";
    if (activeTab === "completed") return g.status === "completed";
    return g.status === "paused" || g.status === "cancelled";
  });

  // Calculate high-level stats
  const activeCount = goals.filter((g) => g.status === "active").length;
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const averageConsistency = goals.length > 0 
    ? Math.round(goals.reduce((acc, g) => acc + (g.consistency || 0), 0) / goals.length) 
    : 0;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto" style={{ background: "var(--background)" }}>
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Active Roadmaps</p>
            <h2 className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>{activeCount}</h2>
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-100 text-violet-600">
            <Target className="w-6 h-6" />
          </div>
        </div>

        <div className="glass p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Completed Goals</p>
            <h2 className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>{completedCount}</h2>
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="glass p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Average Consistency</p>
            <h2 className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>{averageConsistency}%</h2>
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-200/50 border border-slate-200/30">
          {(["active", "completed", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer",
                activeTab === tab 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search goals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-xl border border-slate-200 bg-white/70 text-xs text-slate-800 focus:border-violet-500 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-violet-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Goal
          </button>
        </div>
      </div>

      {/* Goals grid list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
          <p className="text-xs text-slate-400 mt-2 font-semibold">Decrypting goal modules...</p>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-dashed border-slate-200">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-800">No goals found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Build your first autonomous goal roadmap by asking Clutch AI to organize your next destination.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-md cursor-pointer hover:bg-violet-700"
          >
            Start AI Interview
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGoals.map((goal) => {
            const healthColor = goal.health_score >= 80 ? "text-emerald-500 bg-emerald-50" : goal.health_score >= 50 ? "text-amber-500 bg-amber-50" : "text-rose-500 bg-rose-50";
            return (
              <Link key={goal.id} href={`/goals/${goal.id}`}>
                <div className="glass p-5 rounded-2xl hover:shadow-md transition-all border border-slate-200 bg-white hover:border-violet-500/50 cursor-pointer flex flex-col justify-between h-56">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {goal.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", healthColor)}>
                          Health: {goal.health_score}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-slate-800 mt-3 line-clamp-1">{goal.title}</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-1 line-clamp-2">{goal.description}</p>
                  </div>

                  {/* Progress info */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Success Probability</p>
                      <h4 className="text-base font-black text-violet-600 mt-0.5">
                        {goal.forecast?.success_probability ?? 85}%
                      </h4>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Consistency</p>
                      <h4 className="text-base font-black text-slate-800 mt-0.5">
                        {goal.consistency}%
                      </h4>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Conversational creation flow modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500 animate-pulse" />
                  <h3 className="text-sm font-black text-slate-800">Goal Coaching AI Facilitator</h3>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setGeneratedBlueprint(null);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]">
                {chatHistory.map((msg, index) => {
                  const isUser = msg.role === "user";
                  return (
                    <div 
                      key={index}
                      className={cn("flex", isUser ? "justify-end" : "justify-start")}
                    >
                      <div 
                        className={cn(
                          "max-w-md px-4 py-3 rounded-2xl text-xs font-semibold leading-relaxed",
                          isUser 
                            ? "bg-violet-600 text-white rounded-tr-none shadow-sm" 
                            : "bg-slate-100 text-slate-700 rounded-tl-none"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}

                {/* Submitting indicator */}
                {submittingChat && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reasoning...</span>
                    </div>
                  </div>
                )}

                {/* Show Blueprint summary if generated */}
                {generatedBlueprint && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-violet-100 bg-violet-50/20 p-5 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-violet-100 pb-2">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">AI Goal Blueprint Proposal</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                        Confidence: {generatedBlueprint.confidence_score}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Roadmap Name</span>
                        <p className="font-bold text-slate-800 mt-0.5">{generatedBlueprint.title}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Category / Term</span>
                        <p className="font-bold text-slate-800 mt-0.5 capitalize">{generatedBlueprint.category} ({generatedBlueprint.term?.replace("_", " ")})</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Total Duration</span>
                        <p className="font-bold text-slate-800 mt-0.5">{generatedBlueprint.duration_days} Days</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Weekly Commitment</span>
                        <p className="font-bold text-slate-800 mt-0.5">{generatedBlueprint.weekly_commitment_hours} Hours</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Success Chance</span>
                        <p className="font-bold text-emerald-600 mt-0.5">{generatedBlueprint.success_probability}%</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Plan Difficulty</span>
                        <p className="font-bold text-amber-600 mt-0.5 capitalize">{generatedBlueprint.difficulty}</p>
                      </div>
                    </div>

                    {/* Milestones Preview */}
                    <div className="border-t border-violet-100 pt-3">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Key Milestones</span>
                      <div className="space-y-1.5 mt-1.5">
                        {generatedBlueprint.milestones?.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-slate-100">
                            <span className="font-bold text-slate-700">{m.title}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">Day {m.target_day_offset}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Confirm Button */}
                    <button
                      onClick={handleConfirmBlueprint}
                      disabled={creatingGoal}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {creatingGoal ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scheduling Tasks & Syncing Calendar...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Blueprint & Initialize Goal
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Chat Input form */}
              {!generatedBlueprint && (
                <form 
                  onSubmit={handleSendChat}
                  className="p-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50 rounded-b-3xl"
                >
                  <input
                    type="text"
                    placeholder="Type your response here..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={submittingChat}
                    className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || submittingChat}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-600 text-white hover:bg-violet-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
