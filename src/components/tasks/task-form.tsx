"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { X, Loader2, Calendar, Clock } from "lucide-react";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/types/app.types";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["todo", "in_progress", "done", "archived"]),
  estimated_duration: z.number().min(1).optional().nullable(),
  completion_percentage: z.number().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  task?: Task;
  onClose: () => void;
}

export function TaskForm({ task, onClose }: TaskFormProps) {
  const isEditing = !!task;
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      deadline: task?.deadline
        ? new Date(task.deadline).toISOString().slice(0, 16)
        : "",
      priority: task?.priority || "medium",
      status: task?.status || "todo",
      estimated_duration: task?.estimated_duration || null,
      completion_percentage: task?.completion_percentage || 0,
      risk_level: task?.risk_level || "low",
    },
  });

  const onSubmit = async (data: TaskFormValues) => {
    const payload = {
      ...data,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      estimated_duration: data.estimated_duration || null,
    };

    if (isEditing) {
      await updateTask.mutateAsync({ id: task.id, updates: payload });
    } else {
      await createTask.mutateAsync(payload);
    }
    onClose();
  };

  const inputStyle = {
    background: "var(--surface-overlay)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    width: "100%",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: "6px",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
            {isEditing ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label style={labelStyle}>Task Title *</label>
            <input
              id="task-title"
              {...register("title")}
              placeholder="What needs to be done?"
              style={{
                ...inputStyle,
                border: `1px solid ${errors.title ? "var(--danger)" : "var(--border)"}`,
              }}
            />
            {errors.title && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              id="task-description"
              {...register("description")}
              placeholder="Add more context..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>

          {/* Row: Deadline + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Deadline
                </span>
              </label>
              <input
                id="task-deadline"
                type="datetime-local"
                {...register("deadline")}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Est. Duration (min)
                </span>
              </label>
              <input
                id="task-duration"
                type="number"
                min={1}
                placeholder="e.g. 60"
                {...register("estimated_duration", { valueAsNumber: true })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row: Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Priority</label>
              <select id="task-priority" {...register("priority")} style={inputStyle}>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select id="task-status" {...register("status")} style={inputStyle}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Row: Completion % + Risk */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Completion %</label>
              <input
                id="task-completion"
                type="number"
                min={0}
                max={100}
                {...register("completion_percentage", { valueAsNumber: true })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Risk Level</label>
              <select id="task-risk" {...register("risk_level")} style={inputStyle}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <motion.button
              id="task-form-submit"
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "white" }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                isEditing ? "Save Changes" : "Create Task"
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
