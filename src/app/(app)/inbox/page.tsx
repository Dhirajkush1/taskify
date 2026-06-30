"use client";

import { useEffect, useState } from "react";
import { 
  Inbox, Plus, Trash2, Loader2, Sparkles, X, Target, FolderKanban, Clock, Bell, Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

interface InboxItem {
  id: string;
  title: string;
  description?: string;
  created_at: string;
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureDesc, setCaptureDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Conversion state
  const [convertingItem, setConvertingItem] = useState<InboxItem | null>(null);
  const [targetType, setTargetType] = useState<"project_task" | "goal_task" | "reminder" | "habit" | "task">("project_task");
  
  // Conversion target data
  const [projects, setProjects] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [weeklyObjectives, setWeeklyObjectives] = useState<any[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState("");
  
  const [taskPriority, setTaskPriority] = useState<"critical" | "high" | "medium" | "low">("medium");
  const [taskDate, setTaskDate] = useState("");
  const [habitFrequency, setHabitFrequency] = useState<"daily" | "weekly" | "weekdays" | "weekends">("daily");

  const loadInboxItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inbox");
      if (res.ok) {
        const data = await res.json();
        setItems(data || []);
      }
    } catch (err) {
      toast.error("Failed to load inbox items.");
    } finally {
      setLoading(false);
    }
  };

  const loadConversionTargets = async () => {
    try {
      const [projRes, goalRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/goals")
      ]);

      if (projRes.ok) {
        const projs = await projRes.json();
        setProjects(projs || []);
        if (projs && projs.length > 0) setSelectedProjectId(projs[0].id);
      }
      if (goalRes.ok) {
        const gls = await goalRes.json();
        setGoals(gls || []);
        if (gls && gls.length > 0) setSelectedGoalId(gls[0].id);
      }
    } catch (err) {
      console.warn("Failed to load projects/goals for conversion.");
    }
  };

  // Fetch weekly objectives when goal changes
  useEffect(() => {
    if (selectedGoalId) {
      const fetchObjectives = async () => {
        try {
          const res = await fetch(`/api/goals/${selectedGoalId}`);
          if (res.ok) {
            const data = await res.json();
            // Get all objectives from milestones
            const objectives: any[] = [];
            (data.milestones || []).forEach((m: any) => {
              (m.weekly_objectives || []).forEach((obj: any) => {
                objectives.push({
                  id: obj.id,
                  title: `${m.title} - ${obj.title}`
                });
              });
            });
            setWeeklyObjectives(objectives);
            if (objectives.length > 0) setSelectedObjectiveId(objectives[0].id);
          }
        } catch (err) {
          console.warn("Failed to load weekly objectives.");
        }
      };
      fetchObjectives();
    } else {
      setWeeklyObjectives([]);
    }
  }, [selectedGoalId]);

  useEffect(() => {
    loadInboxItems();
    loadConversionTargets();
  }, []);

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureTitle.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: captureTitle.trim(), description: captureDesc.trim() })
      });
      if (res.ok) {
        toast.success("Captured!");
        setCaptureTitle("");
        setCaptureDesc("");
        loadInboxItems();
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Failed to capture ideas.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/inbox?id=${itemId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Removed item.");
        loadInboxItems();
      }
    } catch (err) {
      toast.error("Failed to delete item.");
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingItem || submitting) return;
    setSubmitting(true);

    // Build target data payload
    let targetData: any = {
      title: convertingItem.title,
      description: convertingItem.description
    };

    if (targetType === "project_task") {
      targetData.project_id = selectedProjectId;
      targetData.priority = taskPriority;
      targetData.due_date = taskDate || null;
    } else if (targetType === "goal_task") {
      targetData.objective_id = selectedObjectiveId;
      targetData.priority = taskPriority;
      targetData.deadline = taskDate || null;
    } else if (targetType === "reminder") {
      if (!taskDate) {
        toast.error("Please pick a reminder execution time.");
        setSubmitting(false);
        return;
      }
      targetData.reminder_time = new Date(taskDate).toISOString();
    } else if (targetType === "habit") {
      targetData.frequency = habitFrequency;
      targetData.goal_id = selectedGoalId || null;
    } else if (targetType === "task") {
      targetData.priority = taskPriority;
      targetData.deadline = taskDate || null;
    }

    try {
      const res = await fetch("/api/inbox/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxItemId: convertingItem.id,
          targetType,
          targetData
        })
      });

      if (res.ok) {
        toast.success(`Successfully converted to ${targetType.replace("_", " ")}!`);
        setConvertingItem(null);
        setTaskDate("");
        loadInboxItems();
      } else {
        const payload = await res.json();
        throw new Error(payload.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to convert item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto flex-1 flex flex-col h-screen overflow-hidden">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b pb-5 border-neutral-900">
        <div>
          <h1 className="text-xl font-black text-neutral-100 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-violet-400 animate-pulse" />
            Quick Capture Inbox
          </h1>
          <p className="text-xs text-neutral-500 mt-1">Capture tasks, raw notes, or items here first. AI or you can organize them later.</p>
        </div>
      </div>

      {/* Quick capture form input */}
      <form onSubmit={handleCapture} className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/20 shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <input 
            type="text"
            value={captureTitle}
            onChange={(e) => setCaptureTitle(e.target.value)}
            placeholder="Quick capture an idea or thought..."
            required
            className="flex-1 text-xs bg-neutral-900 border border-neutral-800 text-neutral-100 p-2.5 rounded-xl outline-none"
          />
          <button 
            type="submit"
            disabled={submitting || !captureTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold rounded-xl text-white shadow shrink-0 cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Capture</>}
          </button>
        </div>
        
        <input 
          type="text"
          value={captureDesc}
          onChange={(e) => setCaptureDesc(e.target.value)}
          placeholder="Details or notes (optional)..."
          className="w-full text-[10px] bg-neutral-950 border border-neutral-900 text-neutral-400 p-2 rounded-lg outline-none"
        />
      </form>

      {/* Captured items list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-24 gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-xs text-neutral-500">Loading inbox queue...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20 flex-1 flex flex-col justify-center">
          <Inbox className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
          <h4 className="text-sm font-semibold text-neutral-400">Inbox is Clean!</h4>
          <p className="text-xs text-neutral-600 mt-1">No captured raw ideas remain. Everything has been processed and scheduled.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {items.map((item) => (
            <div 
              key={item.id}
              className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-900 bg-neutral-950/40 hover:bg-neutral-900/20 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-neutral-200 truncate">{item.title}</h4>
                {item.description && (
                  <p className="text-[10px] text-neutral-500 mt-1">{item.description}</p>
                )}
                <span className="text-[8px] text-neutral-600 font-bold block mt-1.5 uppercase">Captured: {format(new Date(item.created_at), "MMM d, h:mm a")}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => {
                    setConvertingItem(item);
                    setTargetType("project_task");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-[10px] font-bold text-violet-400 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Organize
                </button>
                
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 rounded-lg bg-neutral-900 hover:bg-red-950/20 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Convert Item Dialog Drawer */}
      <AnimatePresence>
        {convertingItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleConvert}
              className="w-full max-w-sm rounded-2xl bg-neutral-950 border border-neutral-900 p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-violet-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Organize: &quot;{convertingItem.title}&quot;
                </span>
                <button type="button" onClick={() => setConvertingItem(null)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Convert Type Selection */}
                <div>
                  <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Convert Destination</span>
                  <div className="grid grid-cols-3 gap-1">
                    <button 
                      type="button" 
                      onClick={() => setTargetType("project_task")}
                      className={`py-1 rounded text-[8px] font-bold uppercase ${targetType === "project_task" ? "bg-violet-500/10 text-violet-400 border border-violet-500/25" : "bg-neutral-900 border border-transparent text-neutral-400"}`}
                    >
                      Project Task
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTargetType("goal_task")}
                      className={`py-1 rounded text-[8px] font-bold uppercase ${targetType === "goal_task" ? "bg-violet-500/10 text-violet-400 border border-violet-500/25" : "bg-neutral-900 border border-transparent text-neutral-400"}`}
                    >
                      Goal Task
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTargetType("task")}
                      className={`py-1 rounded text-[8px] font-bold uppercase ${targetType === "task" ? "bg-violet-500/10 text-violet-400 border border-violet-500/25" : "bg-neutral-900 border border-transparent text-neutral-400"}`}
                    >
                      Personal Task
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button 
                      type="button" 
                      onClick={() => setTargetType("habit")}
                      className={`py-1 rounded text-[8px] font-bold uppercase ${targetType === "habit" ? "bg-violet-500/10 text-violet-400 border border-violet-500/25" : "bg-neutral-900 border border-transparent text-neutral-400"}`}
                    >
                      Habit Tracker
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTargetType("reminder")}
                      className={`py-1 rounded text-[8px] font-bold uppercase ${targetType === "reminder" ? "bg-violet-500/10 text-violet-400 border border-violet-500/25" : "bg-neutral-900 border border-transparent text-neutral-400"}`}
                    >
                      Reminder alert
                    </button>
                  </div>
                </div>

                {/* Sub-selectors depending on type selection */}
                {targetType === "project_task" && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Target Project board</span>
                      <select 
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-lg outline-none"
                      >
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Priority</span>
                        <select 
                          value={taskPriority}
                          onChange={(e) => setTaskPriority(e.target.value as any)}
                          className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1.5 rounded-lg"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Due Date</span>
                        <input 
                          type="date"
                          value={taskDate}
                          onChange={(e) => setTaskDate(e.target.value)}
                          className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {targetType === "goal_task" && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Target Goal Roadmap</span>
                      <select 
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-lg outline-none"
                      >
                        {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    </div>

                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Weekly Objective / Milestone</span>
                      <select 
                        value={selectedObjectiveId}
                        onChange={(e) => setSelectedObjectiveId(e.target.value)}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-lg outline-none"
                      >
                        {weeklyObjectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                        {weeklyObjectives.length === 0 && <option value="">No objectives found</option>}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Priority</span>
                        <select 
                          value={taskPriority}
                          onChange={(e) => setTaskPriority(e.target.value as any)}
                          className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1.5 rounded-lg"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Deadline Date</span>
                        <input 
                          type="date"
                          value={taskDate}
                          onChange={(e) => setTaskDate(e.target.value)}
                          className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {targetType === "task" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Priority</span>
                      <select 
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as any)}
                        className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1.5 rounded-lg"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Schedule Date</span>
                      <input 
                        type="date"
                        value={taskDate}
                        onChange={(e) => setTaskDate(e.target.value)}
                        className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {targetType === "habit" && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Linked Goal roadmap</span>
                      <select 
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-lg outline-none"
                      >
                        <option value="">None</option>
                        {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Frequency Schedule</span>
                      <select 
                        value={habitFrequency}
                        onChange={(e) => setHabitFrequency(e.target.value as any)}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-lg outline-none"
                      >
                        <option value="daily">Everyday</option>
                        <option value="weekdays">Weekdays (Mon-Fri)</option>
                        <option value="weekends">Weekends (Sat-Sun)</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </div>
                )}

                {targetType === "reminder" && (
                  <div>
                    <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Alert Trigger Time</span>
                    <input 
                      type="datetime-local"
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      required
                      className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2.5 rounded-xl outline-none"
                    />
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl cursor-pointer flex items-center justify-center gap-1"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete Conversion"}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
