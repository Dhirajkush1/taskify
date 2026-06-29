import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";
import { PlannerService } from "@/lib/ai/planner-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch selected calendars for user
    const { data: calendars, error } = await supabase
      .from("google_calendars")
      .select("calendar_id")
      .eq("user_id", user.id)
      .eq("selected", true);

    if (error) {
      console.error("[ManualSyncAPI] Failed to fetch selected calendars:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!calendars || calendars.length === 0) {
      return NextResponse.json({ success: true, message: "No selected calendars to sync." });
    }

    console.log(`[ManualSyncAPI] Synchronizing ${calendars.length} calendars for user ${user.id}...`);
    
    const results = await Promise.all(
      calendars.map(async (cal: any) => {
        try {
          const res = await CalendarSyncService.syncCalendarEvents(user.id, cal.calendar_id, supabase);
          return { calendarId: cal.calendar_id, ...res };
        } catch (calErr: any) {
          console.error(`[ManualSyncAPI] Sync failed for calendar ${cal.calendar_id}:`, calErr);
          return { calendarId: cal.calendar_id, success: false, error: calErr.message || "Unknown error" };
        }
      })
    );

    // 3. Trigger AI replanning/time block generation after synchronization
    try {
      console.log(`[ManualSyncAPI] Regenerating time block execution plan for user ${user.id}...`);
      await PlannerService.regenerateTimeBlockPlan(user.id);
    } catch (plannerErr) {
      console.error("[ManualSyncAPI] Planner replanning failed:", plannerErr);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[ManualSyncAPI] Fatal error during manual sync:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
