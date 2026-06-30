import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

    // Compute start and end range for the targeted day
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    // Query all entities in parallel
    const [
      personalTasksRes,
      projectTasksRes,
      goalTasksRes,
      remindersRes,
      habitsRes,
      eventsRes,
      inboxRes
    ] = await Promise.all([
      // 1. Personal / General tasks
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .or(`deadline.gte.${startIso},deadline.lte.${endIso},status.eq.in_progress`),
      // 2. Project tasks
      supabase
        .from("project_tasks")
        .select("*, projects(title)")
        .eq("user_id", user.id)
        .or(`due_date.gte.${startIso},due_date.lte.${endIso},status.eq.in_progress`),
      // 3. Goal tasks
      supabase
        .from("goal_tasks")
        .select("*, weekly_objectives(title, milestone_id(goal_id(title)))")
        .eq("user_id", user.id)
        .or(`deadline.gte.${startIso},deadline.lte.${endIso},status.eq.in_progress`),
      // 4. Reminders
      supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.id)
        .gte("reminder_time", startIso)
        .lte("reminder_time", endIso),
      // 5. Habits
      supabase
        .from("habits")
        .select("*, goals(title)")
        .eq("user_id", user.id),
      // 6. Calendar Events
      supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", startIso)
        .lte("start_time", endIso),
      // 7. Inbox Items for sidebar panel
      supabase
        .from("inbox_items")
        .select("*")
        .eq("user_id", user.id)
    ]);

    const personalTasks = (personalTasksRes.data || []).map((t: any) => ({
      ...t,
      origin: "task",
      originLabel: "Personal"
    }));

    const projectTasks = (projectTasksRes.data || []).map((t: any) => ({
      ...t,
      origin: "project_task",
      originLabel: `Project: ${t.projects?.title || "Unknown"}`
    }));

    // Resolve goal title nested joins
    const goalTasks = (goalTasksRes.data || []).map((t: any) => {
      const gTitle = t.weekly_objectives?.milestone_id?.goal_id?.title || "Goal";
      return {
        ...t,
        origin: "goal_task",
        originLabel: `Goal: ${gTitle}`
      };
    });

    const reminders = (remindersRes.data || []).map((r: any) => ({
      ...r,
      origin: "reminder",
      originLabel: "Reminder"
    }));

    // Filter habits based on current day of the week
    const currentDay = new Date(dateStr).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const filteredHabits = (habitsRes.data || []).filter((h: any) => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "weekdays" && currentDay >= 1 && currentDay <= 5) return true;
      if (h.frequency === "weekends" && (currentDay === 0 || currentDay === 6)) return true;
      return false;
    }).map((h: any) => ({
      ...h,
      origin: "habit",
      originLabel: `Habit: ${h.goals?.title || "General"}`
    }));

    const calendarEvents = (eventsRes.data || []).map((e: any) => ({
      ...e,
      origin: "calendar",
      originLabel: "Calendar"
    }));

    const inboxItems = (inboxRes.data || []).map((i: any) => ({
      ...i,
      origin: "inbox",
      originLabel: "Inbox"
    }));

    // Compile into daily planner visual categories
    const allActions = [...personalTasks, ...projectTasks, ...goalTasks];

    const priorities = allActions.filter(
      (a) => (a.priority === "critical" || a.priority === "high") && a.status !== "done"
    );

    const quickWins = allActions.filter(
      (a) =>
        a.estimated_duration &&
        a.estimated_duration <= 20 &&
        a.priority !== "critical" &&
        a.priority !== "high" &&
        a.status !== "done"
    );

    const ifTimePermits = allActions.filter(
      (a) => a.priority === "low" && a.status !== "done"
    );

    const plannerPayload = {
      date: dateStr,
      priorities,
      scheduled: calendarEvents,
      goalTasks: goalTasks.filter((gt: any) => gt.status !== "done"),
      projectTasks: projectTasks.filter((pt: any) => pt.status !== "done"),
      inbox: inboxItems,
      habits: filteredHabits,
      quickWins,
      ifTimePermits,
      reminders: reminders.filter((r: any) => r.status !== "completed"),
      allTasks: allActions // helper list containing details
    };

    return NextResponse.json(plannerPayload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
