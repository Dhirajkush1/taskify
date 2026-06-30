import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DashboardService } from "@/lib/ai/dashboard-service";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = { title: "Dashboard" };

// Force dynamic rendering to bypass Next.js route caching.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  // Retrieve the single, unified database dashboard state
  const [
    dashboardData,
    tasksRes,
    projectTasksRes,
    goalTasksRes,
    goalsRes,
    habitsRes,
    eventsRes,
    sessionsRes,
    remindersRes,
    profileRes
  ] = await Promise.all([
    DashboardService.getDashboardData(user.id),
    supabase.from("tasks").select("*").eq("user_id", user.id).neq("status", "archived"),
    supabase.from("project_tasks").select("*, projects(title)").eq("user_id", user.id),
    supabase.from("goal_tasks").select("*, weekly_objectives(title, milestone_id(goal_id(title)))").eq("user_id", user.id),
    supabase.from("goals").select("*").eq("user_id", user.id).neq("status", "cancelled"),
    supabase.from("habits").select("*, goals(title)").eq("user_id", user.id),
    supabase.from("calendar_events").select("*").eq("user_id", user.id).gte("start_time", monthStart).lte("start_time", monthEnd),
    supabase.from("focus_sessions").select("*").eq("user_id", user.id),
    supabase.from("reminders").select("*").eq("user_id", user.id),
    supabase.from("users").select("full_name").eq("id", user.id).single()
  ]);

  const personalTasks = (tasksRes.data || []).map((t: any) => ({ ...t, type: "personal" }));
  const projectTasks = (projectTasksRes.data || []).map((t: any) => ({ ...t, type: "project" }));
  const goalTasks = (goalTasksRes.data || []).map((t: any) => ({ ...t, type: "goal" }));

  return (
    <DashboardClient
      user={user}
      profile={profileRes.data || null}
      dashboardData={dashboardData}
      personalTasks={personalTasks}
      projectTasks={projectTasks}
      goalTasks={goalTasks}
      goals={goalsRes.data || []}
      habits={habitsRes.data || []}
      calendarEvents={eventsRes.data || []}
      focusSessions={sessionsRes.data || []}
      reminders={remindersRes.data || []}
    />
  );
}
