import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 1. Check if it is an overlaid Task
    if (id.startsWith("task-")) {
      const taskId = id.replace("task-", "");
      
      const updatePayload: any = {};
      if (body.start_time) {
        updatePayload.deadline = body.start_time;
      }
      
      const { data: updatedTask, error } = await supabase
        .from("tasks")
        .update(updatePayload)
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("[EventsIdAPI] Failed to update overlaid task deadline:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: updatedTask });
    }

    // 2. Otherwise, update the calendar_events table
    const { data: existingEvent } = await supabase
      .from("calendar_events")
      .select("google_event_id, calendar_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { data: updatedEvent, error } = await supabase
      .from("calendar_events")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !updatedEvent) {
      console.error("[EventsIdAPI] Database update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Push changes to Google Calendar asynchronously
    CalendarSyncService.pushLocalEventToGoogle(user.id, updatedEvent.id, supabase).catch(err => {
      console.error(`[EventsIdAPI] Failed to sync updated event ${updatedEvent.id} to Google Calendar:`, err);
    });

    return NextResponse.json({ data: updatedEvent });
  } catch (err: any) {
    console.error("[EventsIdAPI] Fatal error in PATCH:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. If it is an overlaid task, we don't delete the task here (tasks have their own CRUD page)
    if (id.startsWith("task-")) {
      return NextResponse.json({ error: "Cannot delete task from calendar events endpoint directly" }, { status: 400 });
    }

    // 2. Fetch the event details first to get the google_event_id & calendar_id
    const { data: event, error: fetchError } = await supabase
      .from("calendar_events")
      .select("google_event_id, calendar_id, event_type")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // 3. Delete from local database
    const { error: deleteError } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[EventsIdAPI] Database delete error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 4. Delete from Google Calendar asynchronously if linked
    if (event.google_event_id && event.event_type !== "external") {
      CalendarSyncService.deleteLocalEventFromGoogle(
        user.id,
        event.google_event_id,
        event.calendar_id || "primary"
      ).catch(err => {
        console.error(`[EventsIdAPI] Failed to delete event ${event.google_event_id} from Google:`, err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[EventsIdAPI] Fatal error in DELETE:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
