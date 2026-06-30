import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { subMinutes } from "date-fns";

export const runtime = "nodejs";

/**
 * POST /api/calendar/events/[id]/action
 * Approve or reject a suggested task for a calendar event.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json(); // "approve" or "ignore"

    if (action !== "approve" && action !== "ignore") {
      return NextResponse.json({ error: "Invalid action. Expected 'approve' or 'ignore'." }, { status: 400 });
    }

    // 1. Fetch calendar event
    const { data: eventData, error: eventError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json({ error: "Calendar event not found." }, { status: 404 });
    }

    const event = eventData as any;
    const analysis = event.ai_analysis || {};

    if (action === "ignore") {
      analysis.suggestion_status = "ignored";
      await supabase
        .from("calendar_events")
        .update({ ai_analysis: analysis, updated_at: new Date().toISOString() })
        .eq("id", event.id);

      return NextResponse.json({ success: true, message: "Suggestion ignored." });
    }

    // Else: Action is "approve" -> create suggested tasks
    if (!analysis.suggested_tasks || analysis.suggested_tasks.length === 0) {
      return NextResponse.json({ error: "No suggested tasks available in AI analysis." }, { status: 400 });
    }

    const eventStart = new Date(event.start_time);
    let firstTaskId: string | null = null;

    for (const t of analysis.suggested_tasks) {
      const taskDeadline = subMinutes(eventStart, t.days_before_event * 24 * 60);

      // Prevent duplicate task inserts
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", t.title)
        .neq("status", "archived")
        .limit(1);

      if (existingTasks && existingTasks.length > 0) {
        if (!firstTaskId) firstTaskId = existingTasks[0].id;
        continue;
      }

      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: t.title,
          description: `Approved from Google Calendar event "${event.title}".\n${t.description}`,
          deadline: taskDeadline.toISOString(),
          priority: t.priority,
          status: "todo",
          estimated_duration: t.estimated_duration,
          risk_level: analysis.risk_level || "low",
          completion_probability: 100,
          source: "google_calendar"
        })
        .select()
        .single();

      if (!taskError && taskData) {
        if (!firstTaskId) firstTaskId = taskData.id;
      }
    }

    // Retrieve sync settings to verify if reminders should be created
    const { data: accountRecord } = await supabase
      .from("google_accounts")
      .select("sync_settings")
      .eq("user_id", user.id)
      .maybeSingle();

    const settings = (accountRecord as any)?.sync_settings || {};

    if (settings.reminder_creation !== false && firstTaskId) {
      const { ReminderService } = await import("@/lib/ai/reminder-service");
      await ReminderService.createReminder(
        user.id,
        {
          title: `Reminder: ${event.title}`,
          reminder_time: event.start_time,
          reminder_type: "specific_time",
          task_id: firstTaskId
        },
        supabase
      ).catch(err => {
        console.error(`[CalendarActionAPI] Failed to schedule reminder for "${event.title}":`, err);
      });
    }

    // Schedule Travel/Prep buffer blocks if auto AI planning is active
    if (settings.auto_ai_planning) {
      const { CalendarSyncService } = await import("@/lib/google-calendar/sync-service");

      if (analysis.travel_required && analysis.travel_time_minutes > 0) {
        const bufferStart = subMinutes(eventStart, Math.max(15, analysis.travel_time_minutes));
        const { data: bufferEvent } = await supabase
          .from("calendar_events")
          .insert({
            user_id: user.id,
            title: `🚗 Travel Buffer: ${event.title}`,
            description: `Travel buffer block of ${analysis.travel_time_minutes} minutes calculated by Clutch AI.`,
            location: event.location || null,
            start_time: bufferStart.toISOString(),
            end_time: event.start_time,
            timezone: event.timezone,
            event_type: "travel_buffer",
            status: "confirmed",
            visibility: "default",
            calendar_id: event.calendar_id
          })
          .select("id")
          .single();

        if (bufferEvent) {
          CalendarSyncService.pushLocalEventToGoogle(user.id, bufferEvent.id, supabase).catch(() => {});
        }
      }

      if (analysis.preparation_required && analysis.preparation_time_minutes > 0) {
        const offset = (analysis.travel_required && analysis.travel_time_minutes > 0) ? analysis.travel_time_minutes : 0;
        const prepStart = subMinutes(eventStart, offset + analysis.preparation_time_minutes);
        const prepEnd = subMinutes(eventStart, offset);

        const { data: prepEvent } = await supabase
          .from("calendar_events")
          .insert({
            user_id: user.id,
            title: `📝 Prep: ${event.title}`,
            description: `Preparation session of ${analysis.preparation_time_minutes} minutes booked by Clutch AI.`,
            start_time: prepStart.toISOString(),
            end_time: prepEnd.toISOString(),
            timezone: event.timezone,
            event_type: "meeting_prep",
            status: "confirmed",
            visibility: "default",
            calendar_id: event.calendar_id
          })
          .select("id")
          .single();

        if (prepEvent) {
          CalendarSyncService.pushLocalEventToGoogle(user.id, prepEvent.id, supabase).catch(() => {});
        }
      }
    }

    // Update analysis status to approved
    analysis.suggestion_status = "approved";
    await supabase
      .from("calendar_events")
      .update({
        ai_analysis: analysis,
        task_id: firstTaskId,
        updated_at: new Date().toISOString()
      })
      .eq("id", event.id);

    return NextResponse.json({ success: true, message: "Tasks approved and scheduled successfully." });
  } catch (err: any) {
    console.error("[CalendarActionAPI] Action failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
