"use client";

import { useEffect, useState } from "react";
import { 
  FolderKanban, Plus, Clock, AlertCircle, Sparkles, ChevronDown,
  Trash2, Edit, Loader2, ArrowRight, Check, X, ShieldAlert, Target
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
}

interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "blocked" | "review" | "done";
  priority: "critical" | "high" | "medium" | "low";
  due_date?: string;
  estimated_duration?: number;
  ai_summary?: string;
  linked_goal_id?: string;
}

const COLUMNS = [
  { id: "todo", label: "To Do", border: "border-neutral-800" },
  { id: "in_progress", label: "In Progress", border: "border-violet-500/30" },
  { id: "blocked", label: "Blocked", border: "border-red-500/30" },
  { id: "review", label: "Review", border: "border-amber-500/30" },
  { id: "done", label: "Done", border: "border-emerald-500/30" }
] as const;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Modals / Creators
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [creatingProj, setCreatingProj] = useState(false);

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"critical" | "high" | "medium" | "low">("medium");
  const [newTaskStatus, setNewTaskStatus] = useState<any>("todo");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  // Selected task card detail drawer
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [goals, setGoals] = useState<any[]>([]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);
        if (data && data.length > 0) {
          // Keep active project or set first
          setActiveProject(prev => {
            const stillExists = data.find((p: any) => p.id === prev?.id);
            return stillExists || data[0];
          });
        }
      }
    } catch (err) {
      toast.error("Failed to load projects list.");
    } finally {
      setLoading(false);
    }
  };

  const loadProjectTasks = async (projId: string) => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/projects/${projId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data || []);
      }
    } catch (err) {
      toast.error("Failed to load project tasks.");
    } finally {
      setTasksLoading(false);
    }
  };

  const loadGoals = async () => {
    try {
      const res = await fetch("/api/goals");
      if (res.ok) {
        const data = await res.json();
        setGoals(data || []);
      }
    } catch (err) {
      console.warn("Goals load failed.");
    }
  };

  useEffect(() => {
    loadProjects();
    loadGoals();
  }, []);

  useEffect(() => {
    if (activeProject) {
      loadProjectTasks(activeProject.id);
    } else {
      setTasks([]);
    }
  }, [activeProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim() || creatingProj) return;
    setCreatingProj(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newProjTitle.trim(), description: newProjDesc.trim() })
      });
      if (res.ok) {
        toast.success("New Project created successfully!");
        setNewProjTitle("");
        setNewProjDesc("");
        setShowNewProjModal(false);
        loadProjects();
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Failed to create project.");
    } finally {
      setCreatingProj(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeProject || creatingTask) return;
    setCreatingTask(true);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          priority: newTaskPriority,
          status: newTaskStatus,
          due_date: newTaskDueDate || null
        })
      });

      if (res.ok) {
        toast.success("Task added to Kanban Board!");
        setNewTaskTitle("");
        setNewTaskDesc("");
        setNewTaskDueDate("");
        setShowNewTaskModal(false);
        loadProjectTasks(activeProject.id);
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Failed to create task.");
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Task moved to ${status.replace("_", " ")}`);
        if (activeProject) loadProjectTasks(activeProject.id);
        if (selectedTask?.id === taskId) {
          setSelectedTask(prev => prev ? { ...prev, status: status as any } : null);
        }
      }
    } catch (err) {
      toast.error("Failed to move card.");
    }
  };

  const handleUpdateTaskDetails = async (taskId: string, updates: Partial<ProjectTask>) => {
    try {
      const res = await fetch(`/api/projects/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        toast.success("Task details saved.");
        if (activeProject) loadProjectTasks(activeProject.id);
        setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      toast.error("Failed to save details.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`/api/projects/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Task removed from Project.");
        setSelectedTask(null);
        if (activeProject) loadProjectTasks(activeProject.id);
      }
    } catch (err) {
      toast.error("Failed to delete task.");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "text-red-400 bg-red-950/40 border-red-900/50";
      case "high": return "text-orange-400 bg-orange-950/40 border-orange-900/50";
      case "medium": return "text-violet-400 bg-violet-950/40 border-violet-900/50";
      default: return "text-neutral-400 bg-neutral-900 border-neutral-800";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto flex-1 flex flex-col h-screen overflow-hidden">
      {/* Top Workspace Picker Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b pb-5 border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          
          {/* Dropdown Projects Selector */}
          <div>
            <div className="flex items-center gap-1.5 cursor-pointer group">
              <span className="text-lg font-black text-neutral-100 group-hover:text-violet-400 transition-colors">
                {activeProject?.title || "No active projects"}
              </span>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5">{activeProject?.description || "Select or initialize a Kanban space"}</p>
          </div>
        </div>

        {/* Project Options */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowNewProjModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold rounded-xl text-neutral-200 border border-neutral-800 cursor-pointer"
          >
            New Project
          </button>
          
          {activeProject && (
            <button 
              onClick={() => {
                setNewTaskStatus("todo");
                setShowNewTaskModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-xl text-white shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          )}
        </div>
      </div>

      {/* Main Boards Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-32 gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-xs text-neutral-500 font-medium">Loading workspace layout...</p>
        </div>
      ) : !activeProject ? (
        <div className="text-center py-32 border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20 flex-1 flex flex-col justify-center max-w-lg mx-auto">
          <FolderKanban className="w-12 h-12 mx-auto text-neutral-700 mb-3 animate-bounce" />
          <h4 className="text-sm font-semibold text-neutral-400">Initialize a Project</h4>
          <p className="text-xs text-neutral-600 mt-1.5 px-6">Every project contains its own Kanban sprint board. Decouple your checklist workloads here.</p>
          <button 
            onClick={() => setShowNewProjModal(true)}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-lg text-white mx-auto cursor-pointer"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="flex-1 flex gap-5 overflow-x-auto pb-4 items-start select-none">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div 
                key={col.id} 
                className="w-72 shrink-0 flex flex-col max-h-[80vh] rounded-2xl bg-neutral-950/40 border border-neutral-900/60 p-4"
              >
                {/* Column Title */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-300">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[50px]">
                  {colTasks.map((task) => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-3.5 rounded-xl border bg-neutral-950/60 hover:bg-neutral-900/40 cursor-pointer transition-all border-neutral-900 hover:${col.border} space-y-2.5`}
                    >
                      <div className="space-y-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <h4 className="text-xs font-semibold text-neutral-100 truncate pt-1">{task.title}</h4>
                      </div>
                      
                      {task.description && (
                        <p className="text-[10px] text-neutral-500 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between text-[9px] text-neutral-500 border-t border-neutral-900/60 pt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.due_date ? format(new Date(task.due_date), "MMM d") : "No due date"}
                        </span>
                        {task.linked_goal_id && (
                          <span className="text-violet-400 flex items-center gap-0.5">
                            <Target className="w-3 h-3" /> Goal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Empty state add task */}
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-[10px] text-neutral-600 italic">
                      Empty column.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Task Details Drawer Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="w-full max-w-md h-full bg-neutral-950 border-l border-neutral-900 p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                {/* Header controls */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Task Settings</span>
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="p-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Edit Section */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">Title</span>
                    <input 
                      type="text" 
                      value={selectedTask.title}
                      onChange={(e) => handleUpdateTaskDetails(selectedTask.id, { title: e.target.value })}
                      className="w-full text-xs font-semibold bg-neutral-900 border border-neutral-800 text-neutral-100 p-2.5 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">Description</span>
                    <textarea 
                      value={selectedTask.description || ""}
                      onChange={(e) => handleUpdateTaskDetails(selectedTask.id, { description: e.target.value })}
                      placeholder="Add descriptions..."
                      rows={3}
                      className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2.5 rounded-xl outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">Status</span>
                      <select 
                        value={selectedTask.status}
                        onChange={(e) => handleUpdateTaskStatus(selectedTask.id, e.target.value)}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-xl outline-none"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">Priority</span>
                      <select 
                        value={selectedTask.priority}
                        onChange={(e) => handleUpdateTaskDetails(selectedTask.id, { priority: e.target.value as any })}
                        className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-xl outline-none"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">Due Date</span>
                    <input 
                      type="date" 
                      value={selectedTask.due_date ? selectedTask.due_date.split("T")[0] : ""}
                      onChange={(e) => handleUpdateTaskDetails(selectedTask.id, { due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">Linked Goal roadmap</span>
                    <select 
                      value={selectedTask.linked_goal_id || ""}
                      onChange={(e) => handleUpdateTaskDetails(selectedTask.id, { linked_goal_id: e.target.value || undefined })}
                      className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2 rounded-xl outline-none"
                    >
                      <option value="">None</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action operations */}
              <div className="pt-6 border-t border-neutral-900 flex justify-between gap-3">
                <button 
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-red-900/60 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-bold cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete Task
                </button>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold rounded-xl text-neutral-200 border border-neutral-800 cursor-pointer"
                >
                  Close Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Project Dialog Modal */}
      <AnimatePresence>
        {showNewProjModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleCreateProject}
              className="w-full max-w-sm rounded-2xl bg-neutral-950 border border-neutral-900 p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-violet-400">Initialize Sprint Project</span>
                <button type="button" onClick={() => setShowNewProjModal(false)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={newProjTitle}
                  onChange={(e) => setNewProjTitle(e.target.value)}
                  placeholder="Project Board Title..."
                  required
                  className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2.5 rounded-xl outline-none"
                />
                
                <textarea 
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  placeholder="Goals or sprint description..."
                  rows={3}
                  className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2.5 rounded-xl outline-none resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={creatingProj || !newProjTitle.trim()}
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl cursor-pointer flex items-center justify-center gap-1"
              >
                {creatingProj ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Project"}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* New Task Dialog Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleCreateTask}
              className="w-full max-w-sm rounded-2xl bg-neutral-950 border border-neutral-900 p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-violet-400">Add Kanban task</span>
                <button type="button" onClick={() => setShowNewTaskModal(false)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  required
                  className="w-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 p-2.5 rounded-xl outline-none"
                />
                
                <textarea 
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Descriptions..."
                  rows={2}
                  className="w-full text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-400 p-2.5 rounded-xl outline-none resize-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Priority</span>
                    <select 
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1.5 rounded-lg outline-none"
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
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-200 p-1 rounded-lg outline-none"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={creatingTask || !newTaskTitle.trim()}
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl cursor-pointer flex items-center justify-center gap-1"
              >
                {creatingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Task Card"}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
