"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock,
  Calendar, Inbox, Target, FolderKanban, Zap, Bell, Sparkles,
  Plus, Check, Loader2, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, addDays, subDays, parseISO } from "date-fns";
import Link from "next/link";

interface PlannerItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  estimated_duration?: number;
  deadline?: string;
  due_date?: string;
  reminder_time?: string;
  start_time?: string;
  end_time?: string;
  origin: "task" | "project_task" | "goal_task" | "reminder" | "habit" | "calendar" | "inbox";
  originLabel: string;
  last_completed_at?: string;
}

export default function DailyPlannerPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [plannerData, setPlannerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Quick Capture State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"inbox" | "task">("inbox");
  const [submitting, setSubmitting] = useState(false);

  const fetchPlannerData = useCallback(async () => {
    setLoading(true);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    try {
      const res = await fetch(`/api/planner?date=${dateStr}`);
      if (!res.ok) throw new Error("Failed to load planner data");
      const data = await res.json();
      setPlannerData(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load planner aggregation.");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchPlannerData();
  }, [fetchPlannerData]);

  // Navigate Date
  const handlePrevDay = () => setCurrentDate((prev) => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate((prev) => addDays(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Checkbox complete toggle action
  const handleToggleComplete = async (item: PlannerItem) => {
    setCompletingId(item.id);
    
    // Determine target API and completed status
    let endpoint = "";
    let body: any = {};
    let isCompleted = false;

    if (item.origin === "task") {
      endpoint = `/api/tasks/${item.id}`;
      isCompleted = item.status !== "done";
      body = { status: isCompleted ? "done" : "todo" };
    } else if (item.origin === "project_task") {
      endpoint = `/api/projects/tasks/${item.id}`;
      isCompleted = item.status !== "done";
      body = { status: isCompleted ? "done" : "todo" };
    } else if (item.origin === "goal_task") {
      endpoint = `/api/goals/tasks/${item.id}`;
      isCompleted = item.status !== "done";
      body = { status: isCompleted ? "done" : "todo" };
    } else if (item.origin === "reminder") {
      endpoint = `/api/reminders/action`;
      isCompleted = item.status !== "completed";
      body = { reminderId: item.id, action: isCompleted ? "complete" : "snooze" };
    } else if (item.origin === "habit") {
      endpoint = `/api/habits/${item.id}/log`;
      // Check if logged today
      const completedToday = item.last_completed_at && 
        new Date(item.last_completed_at).toDateString() === new Date().toDateString();
      isCompleted = !completedToday;
      body = { completed: isCompleted };
    } else {
      setCompletingId(null);
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST", // Reminders action and habit log use POST
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Task & project detail API use PATCH in our backend
      if (!res.ok && (item.origin === "task" || item.origin === "project_task" || item.origin === "goal_task")) {
        const patchRes = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!patchRes.ok) throw new Error();
      } else if (!res.ok) {
        throw new Error();
      }

      toast.success(isCompleted ? "Item marked completed!" : "Item reset to incomplete.");
      fetchPlannerData();
    } catch (err) {
      toast.error("Failed to update status.");
    } finally {
      setCompletingId(null);
    }
  };

  // Submit quick capture
  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);

    try {
      const endpoint = newType === "inbox" ? "/api/inbox" : "/api/tasks";
      const body = newType === "inbox" 
        ? { title: newTitle.trim(), description: newDesc.trim() }
        : { title: newTitle.trim(), description: newDesc.trim(), deadline: currentDate.toISOString(), priority: "medium" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error();
      toast.success(newType === "inbox" ? "Quick captured into Inbox!" : "Task scheduled for today!");
      setNewTitle("");
      setNewDesc("");
      setShowAddForm(false);
      fetchPlannerData();
    } catch (err) {
      toast.error("Failed to capture item.");
    } finally {
      setSubmitting(false);
    }
  };

  const getOriginIcon = (origin: string) => {
    switch (origin) {
      case "project_task": return <FolderKanban className="w-3.5 h-3.5" />;
      case "goal_task": return <Target className="w-3.5 h-3.5" />;
      case "reminder": return <Bell className="w-3.5 h-3.5" />;
      case "habit": return <Clock className="w-3.5 h-3.5" />;
      case "calendar": return <Calendar className="w-3.5 h-3.5" />;
      default: return <Inbox className="w-3.5 h-3.5" />;
    }
  };

  const renderItemRow = (item: PlannerItem) => {
    const isHabitDone = item.origin === "habit" && item.last_completed_at && 
      new Date(item.last_completed_at).toDateString() === new Date().toDateString();
    const isDone = item.status === "done" || item.status === "completed" || isHabitDone;

    return (
      <div 
        key={item.id}
        className="flex items-center gap-3.5 p-3.5 rounded-xl border border-neutral-900 bg-neutral-950/40 hover:bg-neutral-900/40 transition-all group"
      >
        {/* Toggle Box */}
        {item.origin !== "calendar" ? (
          <button 
            onClick={() => handleToggleComplete(item)}
            disabled={completingId === item.id}
            className="text-neutral-500 hover:text-violet-400 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
          >
            {completingId === item.id ? (
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            ) : isDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        ) : (
          <Calendar className="w-5 h-5 text-blue-400 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <h4 className={`text-xs font-semibold truncate ${isDone ? "text-neutral-500 line-through" : "text-neutral-100"}`}>
            {item.title}
          </h4>
          {item.description && (
            <p className="text-[10px] text-neutral-500 mt-0.5 truncate">{item.description}</p>
          )}
        </div>

        {/* Origin Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-900 border border-neutral-800 text-neutral-400">
            {getOriginIcon(item.origin)}
            {item.originLabel}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Date Header Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-neutral-900">
        <div>
          <h1 className="text-xl font-black text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
            Daily Planner
          </h1>
          <p className="text-xs text-neutral-500 mt-1">Your computed productivity agenda. Clutch AI orchestrates your workload.</p>
        </div>

        {/* Calendar Nav */}
        <div className="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 self-start sm:self-center">
          <button 
            onClick={handlePrevDay} 
            className="p-1 rounded hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span onClick={handleToday} className="text-xs font-bold text-neutral-200 px-3 cursor-pointer select-none hover:text-violet-400 transition-colors">
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </span>
          <button 
            onClick={handleNextDay} 
            className="p-1 rounded hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-xs text-neutral-500">Compiling execution agenda...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Agenda Grid */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Top Priorities Section */}
            {plannerData?.priorities?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-red-400 flex items-center gap-1.5 pl-1">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  🔥 Top Priorities
                </h3>
                <div className="space-y-1.5">
                  {plannerData.priorities.map((item: any) => renderItemRow(item))}
                </div>
              </div>
            )}

            {/* Scheduled Events */}
            {plannerData?.scheduled?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-blue-400 flex items-center gap-1.5 pl-1">
                  <Calendar className="w-3.5 h-3.5" />
                  🗓 Scheduled commitments
                </h3>
                <div className="space-y-1.5">
                  {plannerData.scheduled.map((item: any) => renderItemRow(item))}
                </div>
              </div>
            )}

            {/* Goal Tasks Section */}
            {plannerData?.goalTasks?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-violet-400 flex items-center gap-1.5 pl-1">
                  <Target className="w-3.5 h-3.5" />
                  🎯 Goal Objectives
                </h3>
                <div className="space-y-1.5">
                  {plannerData.goalTasks.map((item: any) => renderItemRow(item))}
                </div>
              </div>
            )}

            {/* Project Tasks Section */}
            {plannerData?.projectTasks?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 pl-1">
                  <FolderKanban className="w-3.5 h-3.5" />
                  📁 Project Work items
                </h3>
                <div className="space-y-1.5">
                  {plannerData.projectTasks.map((item: any) => renderItemRow(item))}
                </div>
              </div>
            )}

            {/* Quick Wins */}
            {plannerData?.quickWins?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 flex items-center gap-1.5 pl-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  ⚡ Quick Wins (Low Effort)
                </h3>
                <div className="space-y-1.5">
                  {plannerData.quickWins.map((item: any) => renderItemRow(item))}
                </div>
              </div>
            )}

            {/* If Time Permits */}
            {plannerData?.ifTimePermits?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5 pl-1">
                  <Clock className="w-3.5 h-3.5" />
                  🕒 If Time Permits
                </h3>
                <div className="space-y-1.5">
                  {plannerData.ifTimePermits.map((item: any) => renderItemRow(item))}
                </div>
              </div>
            )}

            {/* Empty state check */}
            {plannerData?.allTasks?.length === 0 && plannerData?.scheduled?.length === 0 && (
              <div className="text-center py-20 border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20">
                <CheckCircle2 className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
                <h4 className="text-sm font-semibold text-neutral-400">All Clear for Today!</h4>
                <p className="text-xs text-neutral-600 mt-1">No tasks or commitments are scheduled on this date.</p>
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-xs font-bold rounded-lg text-violet-400 hover:bg-neutral-800 hover:text-violet-200 cursor-pointer"
                >
                  Schedule Something
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Modules (Habits & Quick Capture) */}
          <div className="space-y-6">
            
            {/* Habits tracker widget */}
            <div className="glass p-5 rounded-2xl border border-neutral-900 bg-neutral-950/20 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-violet-400 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-neutral-300">🔁 Habits Due</h3>
              </div>
              
              {plannerData?.habits?.length > 0 ? (
                <div className="space-y-2">
                  {plannerData.habits.map((h: any) => {
                    const completedToday = h.last_completed_at && 
                      new Date(h.last_completed_at).toDateString() === new Date().toDateString();
                    return (
                      <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-900 bg-neutral-950/40">
                        <div className="min-w-0 flex-1">
                          <span className={`text-[11px] font-semibold truncate block ${completedToday ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
                            {h.title}
                          </span>
                          <span className="text-[8px] text-violet-400 font-bold block mt-0.5">Streak: {h.streak} 🔥</span>
                        </div>
                        
                        <button 
                          onClick={() => handleToggleComplete(h)}
                          disabled={completingId === h.id}
                          className="shrink-0 text-neutral-500 hover:text-violet-400 transition-all cursor-pointer"
                        >
                          {completedToday ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-neutral-600 italic">No habits scheduled for today.</p>
              )}
            </div>

            {/* Quick Capture Panel */}
            <div className="glass p-5 rounded-2xl border border-neutral-900 bg-neutral-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-violet-400" />
                  Quick Capture
                </h3>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="w-5 h-5 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:bg-neutral-800 text-neutral-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleQuickCapture} className="space-y-3 p-3 rounded-xl border border-neutral-900 bg-neutral-950/80">
                  <div className="flex items-center gap-2 pb-1 border-b border-neutral-900">
                    <button 
                      type="button" 
                      onClick={() => setNewType("inbox")} 
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer ${newType === "inbox" ? "bg-violet-500/10 text-violet-400" : "text-neutral-500"}`}
                    >
                      Inbox
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewType("task")} 
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer ${newType === "task" ? "bg-violet-500/10 text-violet-400" : "text-neutral-500"}`}
                    >
                      Task
                    </button>
                  </div>

                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={newType === "inbox" ? "Quick capture idea..." : "Today's task title..."}
                    required
                    className="w-full text-xs bg-neutral-950 border border-neutral-900 text-neutral-200 p-2 rounded outline-none"
                  />
                  
                  <textarea 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Details or notes (optional)..."
                    rows={2}
                    className="w-full text-[10px] bg-neutral-950 border border-neutral-900 text-neutral-400 p-2 rounded outline-none resize-none"
                  />

                  <button 
                    type="submit" 
                    disabled={submitting || !newTitle.trim()}
                    className="w-full py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[10px] font-bold text-white rounded cursor-pointer flex items-center justify-center gap-1"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Capture"}
                  </button>
                </form>
              )}

              {/* Inbox teaser list */}
              {plannerData?.inbox?.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[8px] font-bold text-neutral-500 uppercase tracking-widest pl-1">
                    <span>Inbox Items ({plannerData.inbox.length})</span>
                    <Link href="/inbox" className="hover:text-violet-400 transition-colors flex items-center gap-0.5">
                      Open Inbox <ArrowRight className="w-2 h-2" />
                    </Link>
                  </div>
                  {plannerData.inbox.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="p-2 rounded-lg border border-neutral-900/60 bg-neutral-950/20 text-[10px] font-medium text-neutral-400 truncate">
                      {item.title}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-neutral-600 italic">Inbox is empty. Everything organized!</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
