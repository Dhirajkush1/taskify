// ============================================================
// App-Level Types & Enums for Clutch AI
// ============================================================

import type { Database } from "./database.types";

// Re-export table row types for convenience
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
export type Settings = Database["public"]["Tables"]["settings"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type Habit = Database["public"]["Tables"]["habits"]["Row"];

// Insert/Update types
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
export type ConversationInsert =
  Database["public"]["Tables"]["conversations"]["Insert"];

// ============================================================
// Enums
// ============================================================
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "done" | "archived";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type MessageRole = "user" | "assistant";

// ============================================================
// Priority Config (for UI rendering)
// ============================================================
export interface PriorityConfig {
  label: string;
  color: string;
  bg: string;
  dotColor: string;
}

export const PRIORITY_CONFIG: Record<TaskPriority, PriorityConfig> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dotColor: "bg-red-400",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    dotColor: "bg-orange-400",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dotColor: "bg-yellow-400",
  },
  low: {
    label: "Low",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dotColor: "bg-emerald-400",
  },
};

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bg: string }
> = {
  todo: {
    label: "To Do",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  in_progress: {
    label: "In Progress",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  done: {
    label: "Done",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  archived: {
    label: "Archived",
    color: "text-slate-500",
    bg: "bg-slate-600/10 border-slate-600/20",
  },
};

export const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string }
> = {
  low: { label: "Low Risk", color: "text-emerald-400" },
  medium: { label: "Medium Risk", color: "text-yellow-400" },
  high: { label: "High Risk", color: "text-orange-400" },
  critical: { label: "Critical Risk", color: "text-red-400" },
};

// ============================================================
// API Response Types
// ============================================================
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

// ============================================================
// AI / Gemini Types
// ============================================================
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ExtractedTask {
  title: string;
  deadline?: string;
  priority?: TaskPriority;
  estimatedDuration?: number;
  description?: string;
}

export interface ExtractResponse {
  tasks: ExtractedTask[];
  rawText: string;
}

// ============================================================
// Dashboard Types
// ============================================================
export interface DashboardStats {
  totalTasks: number;
  completedToday: number;
  upcomingDeadlines: number;
  inProgress: number;
  streak: number;
}

// ============================================================
// Sidebar Navigation
// ============================================================
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
