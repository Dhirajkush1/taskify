"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, ListTodo, Target } from "lucide-react";
import { motion } from "framer-motion";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskForm } from "@/components/tasks/task-form";
import { GoalBoard } from "@/components/tasks/goal-board";
import type { Task } from "@/types/app.types";

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<"board" | "goals">("board");
  const [filters, setFilters] = useState<{
    status?: string;
    priority?: string;
    search?: string;
  }>({});
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useTasks(filters);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b pb-3.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab("board")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "board"
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25"
                : "text-neutral-400 hover:text-neutral-200 border border-transparent"
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            Active Board
          </button>
          <button
            onClick={() => setActiveTab("goals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "goals"
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25"
                : "text-neutral-400 hover:text-neutral-200 border border-transparent"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Strategic Goals
          </button>
        </div>

        {activeTab === "board" && (
          <motion.button
            id="create-task-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm"
            style={{ background: "var(--primary)" }}
          >
            <Plus className="w-4 h-4" />
            New Task
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "board" ? (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters */}
            <TaskFilters onFiltersChange={setFilters} />

            {/* Task List */}
            <TaskList tasks={tasks} isLoading={isLoading} onEdit={handleEdit} />
          </motion.div>
        ) : (
          <motion.div
            key="goals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GoalBoard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Form Modal */}
      <AnimatePresence>
        {showForm && (
          <TaskForm
            task={editingTask ?? undefined}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
