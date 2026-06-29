import type { Task, TaskInsert, TaskUpdate, TaskStatus, TaskPriority } from "@/types/app.types";
import { createClient } from "@/lib/supabase/client";

export async function fetchTasks(
  userId: string,
  filters?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    search?: string;
  }
): Promise<Task[]> {
  const supabase = createClient();
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function computePriority(title: string, deadlineStr?: string | null): "critical" | "high" | "medium" | "low" {
  const cleanTitle = title.toLowerCase();
  
  // Safety or Medical keywords
  const safetyKeywords = ["safety", "emergency", "danger", "hazard", "injury", "hurt", "hospital", "doctor", "medical", "accident", "gas", "fire"];
  if (safetyKeywords.some(keyword => cleanTitle.includes(keyword))) {
    return "critical";
  }

  if (deadlineStr) {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();

    // Deadline within 30 minutes
    if (diffMs > 0 && diffMs <= 30 * 60 * 1000) {
      return "critical";
    }

    // Today (within 24 hours of now, or same calendar day)
    const isToday = deadline.toDateString() === now.toDateString() || (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000);
    if (isToday) {
      return "high";
    }

    // This week (within 7 days)
    if (diffMs > 0 && diffMs <= 7 * 24 * 60 * 60 * 1000) {
      return "medium";
    }
  }

  return "low";
}

export async function createTask(task: TaskInsert): Promise<Task> {
  const supabase = createClient();
  const calculatedPriority = computePriority(task.title, task.deadline);
  const taskPayload = {
    ...task,
    priority: calculatedPriority
  } as any;

  const { data, error } = await supabase
    .from("tasks")
    .insert(taskPayload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateTask(
  id: string,
  updates: TaskUpdate
): Promise<Task> {
  const supabase = createClient();
  const finalUpdates = { ...updates } as any;

  if (updates.title !== undefined || updates.deadline !== undefined) {
    const current = await fetchTask(id);
    const finalTitle = updates.title !== undefined ? updates.title : current.title;
    const finalDeadline = updates.deadline !== undefined ? updates.deadline : current.deadline;
    finalUpdates.priority = computePriority(finalTitle, finalDeadline);
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(finalUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function completeTask(id: string): Promise<Task> {
  const task = await fetchTask(id);
  const isEmergency = (task as any).category === "Emergency";
  const finalStatus = isEmergency ? "archived" : "done";
  return updateTask(id, { status: finalStatus, completion_percentage: 100 });
}

export async function archiveTask(id: string): Promise<Task> {
  return updateTask(id, { status: "archived" });
}

export async function fetchTask(id: string): Promise<Task> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDashboardStats(userId: string) {
  const supabase = createClient();

  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [total, completedToday, inProgress, upcoming] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "archived"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("updated_at", todayStart)
      .lte("updated_at", todayEnd),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "in_progress"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("deadline", weekEnd)
      .neq("status", "done")
      .neq("status", "archived"),
  ]);

  return {
    totalTasks: total.count ?? 0,
    completedToday: completedToday.count ?? 0,
    inProgress: inProgress.count ?? 0,
    upcomingDeadlines: upcoming.count ?? 0,
    streak: 0, // Computed from activity_logs in production
  };
}
