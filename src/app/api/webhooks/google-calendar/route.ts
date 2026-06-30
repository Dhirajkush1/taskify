import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const headers = request.headers;
    const channelId = headers.get("x-goog-channel-id");
    const resourceId = headers.get("x-goog-resource-id");
    const resourceState = headers.get("x-goog-resource-state"); // 'sync', 'exists', 'not_exists'
    
    console.log(`[GoogleWebhook] Received push notification. ChannelId: ${channelId}, State: ${resourceState}`);

    // 1. Handle Google sync verification handshake
    if (resourceState === "sync") {
      console.log(`[GoogleWebhook] Handshake success for channel: ${channelId}`);
      return new Response("OK", { status: 200 });
    }

    if (!channelId || !resourceId) {
      return NextResponse.json({ error: "Missing required headers" }, { status: 400 });
    }

    // 2. Identify the calendar and user linked to this channel ID
    const supabase = createServiceClient();
    const { data: calendar, error } = await supabase
      .from("google_calendars")
      .select("user_id, calendar_id")
      .eq("webhook_channel_id", channelId)
      .eq("webhook_resource_id", resourceId)
      .maybeSingle();

    if (error || !calendar) {
      console.warn(`[GoogleWebhook] Unknown webhook channel: ${channelId}. Expired or unauthorized.`);
      // Return 200 so Google doesn't keep retrying failed old channels indefinitely
      return new Response("Webhook channel not active", { status: 200 });
    }

    const { user_id: userId, calendar_id: calendarId } = calendar;

    // 3. Trigger incremental synchronization
    console.log(`[GoogleWebhook] Triggering sync for user ${userId}, calendar ${calendarId}`);
    
    // We execute the sync process.
    const syncResult = await CalendarSyncService.syncCalendarEvents(userId, calendarId, supabase);
    console.log(`[GoogleWebhook] Sync complete. Imported: ${syncResult.importedCount}, Deleted: ${syncResult.deletedCount}`);

    // 4. Trigger AI replanning/auto-scheduling after event updates
    try {
      const { PlannerService } = await import("@/lib/ai/planner-service");
      // Asynchronously trigger time block regeneration
      PlannerService.regenerateTimeBlockPlan(userId).catch((err) => {
        console.error(`[GoogleWebhook] AI planning regeneration failed:`, err);
      });
    } catch (plannerErr) {
      console.error(`[GoogleWebhook] Failed to import planner service:`, plannerErr);
    }

    return new Response("Sync complete", { status: 200 });
  } catch (err: any) {
    console.error(`[GoogleWebhook] Fatal error processing webhook:`, err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
