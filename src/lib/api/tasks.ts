import type { Task, TaskInsert, TaskUpdate } from "@/types/app.types";
import { createClient } from "@/lib/supabase/client";

export async function fetchTasks(
  userId: string,
  filters?: {
    status?: string;
    priority?: string;
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

export async function createTask(task: TaskInsert): Promise<Task> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
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
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
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
  return updateTask(id, { status: "done", completion_percentage: 100 });
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
