import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";
import { GoogleCalendarClient } from "@/lib/google-calendar/client";
import { PlannerService } from "@/lib/ai/planner-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleCronSync();
}

export async function POST(request: NextRequest) {
  return handleCronSync();
}

async function handleCronSync() {
  const timestamp = new Date().toISOString();
  console.log(`[CalendarSyncCron] Starting execution run at ${timestamp}`);
  const supabase = createServiceClient() as any;

  try {
    // 1. Fetch all users who have sync_enabled = true
    const { data: accounts, error: accountsError } = await supabase
      .from("google_accounts")
      .select("*")
      .eq("sync_enabled", true);

    if (accountsError) {
      throw new Error(`Failed to fetch active google accounts: ${accountsError.message}`);
    }

    let processedCount = 0;
    const nowTime = Date.now();

    for (const acct of accounts || []) {
      const userId = acct.user_id;
      const settings = acct.sync_settings || {};
      
      // Respect background_sync setting
      if (settings.background_sync === false) {
        continue;
      }

      processedCount++;

      // A. Force refresh token renewal via getValidAccessToken to prevent expiration errors
      try {
        await GoogleCalendarClient.getValidAccessToken(userId);
      } catch (tokenErr) {
        console.error(`[CalendarSyncCron] Token refresh failed for user ${userId}:`, tokenErr);
        continue;
      }

      // B. Fetch selected calendars for user
      const { data: calendars } = await supabase
        .from("google_calendars")
        .select("*")
        .eq("user_id", userId)
        .eq("selected", true);

      for (const cal of calendars || []) {
        const calendarId = cal.calendar_id;

        // C. Renew Webhook channel if it expires in less than 24 hours (or if it doesn't exist)
        const expirationTime = cal.webhook_expiration ? new Date(cal.webhook_expiration).getTime() : 0;
        const isExpiringSoon = (expirationTime - nowTime) < 24 * 60 * 60 * 1000;

        if (isExpiringSoon) {
          console.log(`[CalendarSyncCron] Webhook watch expiring soon for user ${userId}, calendar ${calendarId}. Renewing...`);
          
          // Stop current watch channel if details exist
          if (cal.webhook_channel_id && cal.webhook_resource_id) {
            try {
              await GoogleCalendarClient.stopWatch(userId, cal.webhook_channel_id, cal.webhook_resource_id);
            } catch (stopErr) {
              console.warn(`[CalendarSyncCron] Failed to stop watch channel ${cal.webhook_channel_id}:`, stopErr);
            }
          }

          // Register new watch channel
          await CalendarSyncService.watchCalendar(userId, calendarId);
        }

        // D. Trigger Delta Import Sync for changes
        try {
          const syncRes = await CalendarSyncService.syncCalendarEvents(userId, calendarId, supabase);
          console.log(`[CalendarSyncCron] Sync completed for user ${userId}, calendar ${calendarId}. Imported: ${syncRes.importedCount}, Deleted: ${syncRes.deletedCount}`);
        } catch (syncErr) {
          console.error(`[CalendarSyncCron] Sync failed for calendar ${calendarId}:`, syncErr);
        }
      }

      // E. Push any un-synced tasks to Google Calendar
      const syncTaskifyToGoogle = settings.sync_taskify_to_google !== false;
      if (syncTaskifyToGoogle) {
        try {
          // Fetch tasks that have deadlines but no active calendar link mappings
          const { data: unSyncedTasks } = await supabase
            .from("tasks")
            .select("id")
            .eq("user_id", userId)
            .neq("status", "archived")
            .not("deadline", "is", null);

          // Get already synced task IDs
          const { data: links } = await supabase
            .from("calendar_event_links")
            .select("task_id")
            .eq("user_id", userId)
            .not("task_id", "is", null);

          const syncedTaskIds = new Set((links || []).map((l: any) => l.task_id));
          const tasksToPush = (unSyncedTasks || []).filter((t: any) => !syncedTaskIds.has(t.id));

          if (tasksToPush.length > 0) {
            console.log(`[CalendarSyncCron] Pushing ${tasksToPush.length} un-synced tasks to Google Calendar for user ${userId}`);
            for (const task of tasksToPush) {
              await CalendarSyncService.pushTaskToGoogle(userId, task.id, supabase);
            }
          }
        } catch (pushErr) {
          console.error(`[CalendarSyncCron] Error pushing un-synced tasks for user ${userId}:`, pushErr);
        }
      }

      // F. Trigger AI planning regeneration after sync updates
      try {
        await PlannerService.regenerateTimeBlockPlan(userId);
      } catch (planErr) {
        console.error(`[CalendarSyncCron] AI planner regeneration failed for user ${userId}:`, planErr);
      }
    }

    // Log run
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "CronCalendarSyncRun",
      entity_type: "system",
      metadata: { status: "success", timestamp, processedCount }
    });

    return NextResponse.json({ success: true, timestamp, processedCount });
  } catch (err: any) {
    console.error("[CalendarSyncCron] Execution failed:", err);
    return NextResponse.json({ 
      error: err.message || "Internal execution error", 
      timestamp 
    }, { status: 500 });
  }
}
