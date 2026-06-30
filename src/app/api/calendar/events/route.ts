import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .order("start_time", { ascending: true });

    if (startStr) {
      query = query.gte("end_time", startStr);
    }
    if (endStr) {
      query = query.lte("start_time", endStr);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("[EventsAPI] Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch calendar event links to identify linked tasks
    const { data: links } = await supabase
      .from("calendar_event_links")
      .select("task_id")
      .eq("user_id", user.id)
      .not("task_id", "is", null);

    const linkedTaskIds = new Set((links || []).map((l: any) => l.task_id));

    const mappedEvents = (events || []).map((e: any) => ({
      ...e,
      is_linked: !!e.task_id
    }));

    // Optionally overlay tasks as deadline milestones on the calendar
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, deadline, priority, status, estimated_duration")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .not("deadline", "is", null);

    const mappedTasks = (tasks || []).map((t: any) => {
      const durationMins = t.estimated_duration || 60;
      const start = new Date(t.deadline!);
      const end = new Date(start.getTime() + durationMins * 60 * 1000);
      return {
        id: `task-${t.id}`,
        user_id: user.id,
        title: `🏁 DEADLINE: ${t.title}`,
        description: `Task status: ${t.status}. Priority: ${t.priority}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        event_type: "task_block",
        task_id: t.id,
        status: t.status === "done" ? "completed" : "confirmed",
        visibility: "default",
        is_linked: linkedTaskIds.has(t.id),
      };
    });

    const combinedEvents = [...mappedEvents, ...mappedTasks];

    return NextResponse.json({ data: combinedEvents });
  } catch (err: any) {
    console.error("[EventsAPI] Fatal error in GET:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.start_time || !body.end_time || !body.event_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: newEvent, error } = await supabase
      .from("calendar_events")
      .insert({
        ...body,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !newEvent) {
      console.error("[EventsAPI] Database insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger push to Google Calendar asynchronously
    CalendarSyncService.pushLocalEventToGoogle(user.id, newEvent.id, supabase).catch(err => {
      console.error(`[EventsAPI] Failed to sync new local event ${newEvent.id} to Google Calendar:`, err);
    });

    return NextResponse.json({ data: newEvent }, { status: 201 });
  } catch (err: any) {
    console.error("[EventsAPI] Fatal error in POST:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
