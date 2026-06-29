import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { selectedCalendarIds } = await request.json();

    if (!Array.isArray(selectedCalendarIds)) {
      return NextResponse.json({ error: "selectedCalendarIds must be an array" }, { status: 400 });
    }

    // 1. Fetch currently selected calendars to find additions and removals
    const { data: existingCalendars } = await supabase
      .from("google_calendars")
      .select("calendar_id, selected")
      .eq("user_id", user.id);

    const previouslySelected = new Set(
      (existingCalendars || []).filter((c: any) => c.selected).map((c: any) => c.calendar_id)
    );

    // 2. Update database states
    // First, set all to unselected
    await supabase
      .from("google_calendars")
      .update({ selected: false })
      .eq("user_id", user.id);

    // Now, set specified calendars to selected
    if (selectedCalendarIds.length > 0) {
      await supabase
        .from("google_calendars")
        .update({ selected: true })
        .eq("user_id", user.id)
        .in("calendar_id", selectedCalendarIds);
    }

    // 3. For any calendar that is newly selected, trigger webhook watch and initial sync
    const newlySelected = selectedCalendarIds.filter(id => !previouslySelected.has(id));

    if (newlySelected.length > 0) {
      console.log(`[SelectCalendars] Setting up new calendars for user ${user.id}:`, newlySelected);
      // Run sync and webhooks setup asynchronously so we respond to user immediately
      Promise.all(
        newlySelected.map(async (calId) => {
          try {
            await CalendarSyncService.syncCalendarEvents(user.id, calId, supabase);
            await CalendarSyncService.watchCalendar(user.id, calId);
          } catch (calErr) {
            console.error(`[SelectCalendars] Error setting up calendar ${calId}:`, calErr);
          }
        })
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[SelectCalendars] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
