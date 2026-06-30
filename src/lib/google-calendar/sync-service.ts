import { SupabaseClient } from "@supabase/supabase-js";
import { GoogleCalendarClient, GoogleEventInput } from "./client";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

export class CalendarSyncService {
  
  /**
   * Performs an incremental or full sync of Google Calendar events to Taskify.
   */
  static async syncCalendarEvents(
    userId: string,
    calendarId: string,
    customSupabase?: SupabaseClient<Database>
  ): Promise<{ success: boolean; importedCount: number; deletedCount: number }> {
    const supabase = (customSupabase || createServiceClient()) as any;
    
    // 1. Fetch the calendar record to check for sync settings & sync token
    const { data: calRecord, error: calError } = await supabase
      .from("google_calendars")
      .select("*")
      .eq("user_id", userId)
      .eq("calendar_id", calendarId)
      .maybeSingle();

    if (calError || !calRecord) {
      console.error(`[SyncService] Calendar ${calendarId} not found in DB for user ${userId}`);
      return { success: false, importedCount: 0, deletedCount: 0 };
    }

    if (!calRecord.selected) {
      console.log(`[SyncService] Calendar ${calendarId} is not selected for sync. Skipping.`);
      return { success: true, importedCount: 0, deletedCount: 0 };
    }

    // Retrieve sync settings from google_accounts
    const { data: accountRecord } = await supabase
      .from("google_accounts")
      .select("sync_settings")
      .eq("user_id", userId)
      .maybeSingle();

    const settings = (accountRecord as any)?.sync_settings || {
      import_window: 90,
      import_historical: false,
      sync_recurring: false,
      meeting_detection: true,
      birthday_detection: false,
      holiday_detection: false,
      task_creation: "manual_suggest",
      reminder_creation: true,
      auto_ai_planning: false,
      sync_google_to_taskify: true,
      sync_taskify_to_google: true,
      auto_create_google_events: true,
      future_events_only: true,
      ignore_historical: true,
      background_sync: true
    };

    // If sync from Google to Taskify is disabled, exit early
    if (settings.sync_google_to_taskify === false) {
      console.log(`[SyncService] sync_google_to_taskify is disabled for user ${userId}. Skipping sync.`);
      return { success: true, importedCount: 0, deletedCount: 0 };
    }

    // Calculate time window for full/initial sync
    const now = new Date();
    let timeMin: string | undefined = undefined;
    let timeMax: string | undefined = undefined;

    if (!calRecord.sync_token) {
      const futureEventsOnly = settings.future_events_only !== false; // Default true
      const ignoreHistorical = settings.ignore_historical !== false; // Default true

      if (futureEventsOnly || ignoreHistorical) {
        timeMin = now.toISOString();
      } else if (settings.import_historical) {
        const histDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        timeMin = histDate.toISOString();
      } else {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        timeMin = startOfToday.toISOString();
      }

      // timeMax is now + 365 days
      const futureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      timeMax = futureDate.toISOString();
    }

    // 2. Fetch events from Google
    let eventsResponse;
    try {
      eventsResponse = await GoogleCalendarClient.listEvents(userId, calendarId, {
        syncToken: calRecord.sync_token || undefined,
        timeMin,
        timeMax,
        singleEvents: true,
      });
    } catch (err: any) {
      // Handle expired sync tokens (410 Gone)
      if (err.message?.includes("410") || err.message?.includes("Gone") || err.message?.includes("sync token is invalid")) {
        console.warn(`[SyncService] Sync token expired for calendar ${calendarId}. Resetting and performing full sync.`);
        
        await supabase
          .from("google_calendars")
          .update({ sync_token: null })
          .eq("id", calRecord.id);

        eventsResponse = await GoogleCalendarClient.listEvents(userId, calendarId, {
          singleEvents: true,
          timeMin,
          timeMax,
        });
      } else {
        console.error(`[SyncService] Failed to list events for calendar ${calendarId}:`, err);
        throw err;
      }
    }

    const items = eventsResponse.items || [];
    const nextSyncToken = eventsResponse.nextSyncToken;
    let importedCount = 0;
    let deletedCount = 0;

    console.log(`[SyncService] Syncing ${items.length} event updates from Google for calendar ${calendarId}`);

    const newExternalEvents: any[] = [];

    // 3. Process events
    for (const item of items) {
      const googleEventId = item.id;
      
      // If the event is cancelled/deleted
      if (item.status === "cancelled") {
        // Fetch from calendar_event_links mapping
        const { data: linkRecord } = await supabase
          .from("calendar_event_links")
          .select("*")
          .eq("google_event_id", googleEventId)
          .eq("user_id", userId)
          .maybeSingle();

        let taskId = linkRecord?.task_id;
        if (!taskId) {
          const { data: localEv } = await supabase
            .from("calendar_events")
            .select("id, task_id")
            .eq("user_id", userId)
            .eq("google_event_id", googleEventId)
            .maybeSingle();
          taskId = localEv?.task_id;
        }

        if (taskId) {
          await supabase
            .from("tasks")
            .update({ status: "archived" })
            .eq("id", taskId);
          console.log(`[SyncService] Archived linked task ${taskId} for deleted event ${googleEventId}`);
        }

        // Delete from mapping
        await supabase
          .from("calendar_event_links")
          .delete()
          .eq("google_event_id", googleEventId)
          .eq("user_id", userId);

        const { error: deleteError } = await supabase
          .from("calendar_events")
          .delete()
          .eq("user_id", userId)
          .eq("google_event_id", googleEventId);

        if (!deleteError) deletedCount++;
        continue;
      }

      // Parse start and end times
      const startIso = item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00Z` : null);
      const endIso = item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:59Z` : null);

      if (!startIso || !endIso) {
        continue; // skip malformed events
      }

      // Ignore old events: do not sync if event has already ended
      const endTimestamp = new Date(endIso).getTime();
      const futureEventsOnly = settings.future_events_only !== false; // Default true
      const ignoreHistorical = settings.ignore_historical !== false; // Default true

      if (endTimestamp < now.getTime() && (futureEventsOnly || ignoreHistorical)) {
        console.log(`[SyncService] Skipping historical event: "${item.summary || "Untitled Event"}"`);
        continue;
      }

      // Find primary meeting link
      const meetingLink = item.hangoutLink || 
                          item.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri ||
                          null;

      // Map attendees
      const guests = (item.attendees || []).map((att: any) => ({
        email: att.email,
        displayName: att.displayName || null,
        responseStatus: att.responseStatus || "needsAction",
        organizer: att.organizer || false,
      }));

      const eventPayload = {
        user_id: userId,
        title: item.summary || "Untitled Event",
        description: item.description || null,
        location: item.location || null,
        guests: guests,
        meeting_link: meetingLink,
        timezone: item.start?.timeZone || calRecord.description || "UTC",
        start_time: startIso,
        end_time: endIso,
        recurrence: item.recurrence || [],
        recurring_event_id: item.recurringEventId || null,
        original_start_time: item.originalStartTime?.dateTime || item.originalStartTime?.date || null,
        organizer: item.organizer ? { email: item.organizer.email, displayName: item.organizer.displayName || null } : {},
        attachments: (item.attachments || []).map((att: any) => ({ title: att.title, fileUrl: att.fileUrl, mimeType: att.mimeType })),
        status: item.status || "confirmed",
        visibility: item.visibility || "default",
        google_event_id: googleEventId,
        calendar_id: calendarId,
        event_type: "external" as const,
        updated_at: new Date().toISOString(),
      };

      // Check mapping first
      const { data: existingLink } = await supabase
        .from("calendar_event_links")
        .select("*")
        .eq("google_event_id", googleEventId)
        .eq("user_id", userId)
        .maybeSingle();

      // Check conflict (edited within 2 minutes)
      let skipSyncGoogleToTaskify = false;
      if (existingLink?.task_id) {
        const { data: linkedTask } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", existingLink.task_id)
          .maybeSingle();

        if (linkedTask) {
          const googleUpdated = item.updated ? new Date(item.updated).getTime() : 0;
          const taskUpdated = linkedTask.updated_at ? new Date(linkedTask.updated_at).getTime() : 0;
          const lastSynced = existingLink.last_synced_at ? new Date(existingLink.last_synced_at).getTime() : 0;

          const isGoogleEditedRecently = (googleUpdated - lastSynced) > 0 && (Date.now() - googleUpdated) < 120 * 1000;
          const isTaskEditedRecently = (taskUpdated - lastSynced) > 0 && (Date.now() - taskUpdated) < 120 * 1000;

          if (isGoogleEditedRecently && isTaskEditedRecently) {
            console.log(`[SyncService] Conflict detected for task ${linkedTask.id} and google event ${googleEventId}`);
            if (taskUpdated > googleUpdated) {
              console.log(`[SyncService] Taskify updates are newer. Overwriting Google Calendar.`);
              // Taskify wins. Skip sync to Taskify and push task update to Google Calendar.
              skipSyncGoogleToTaskify = true;
              CalendarSyncService.pushTaskToGoogle(userId, linkedTask.id, supabase).catch(err => {
                console.error("[SyncService] Failed to push task update to Google in conflict:", err);
              });
            } else {
              console.log(`[SyncService] Google Calendar updates are newer. Overwriting Taskify.`);
            }
          }
        }
      }

      if (skipSyncGoogleToTaskify) {
        continue;
      }

      // Check if event already exists in calendar_events
      const { data: existingEvent } = await supabase
        .from("calendar_events")
        .select("id, ai_analysis, task_id")
        .eq("user_id", userId)
        .eq("google_event_id", googleEventId)
        .maybeSingle();

      let savedEventId: string;
      if (existingEvent) {
        // Update existing event
        const { data: updatedEvent, error: updateError } = await supabase
          .from("calendar_events")
          .update(eventPayload)
          .eq("id", existingEvent.id)
          .select("id")
          .single();

        if (updateError) {
          console.error(`[SyncService] Error updating calendar event in DB: ${updateError.message}`);
          continue;
        }
        savedEventId = updatedEvent.id;
        importedCount++;
      } else {
        // Insert new event
        const { data: insertedEvent, error: insertError } = await supabase
          .from("calendar_events")
          .insert({
            ...eventPayload,
            event_type: "external"
          })
          .select("*")
          .single();

        if (insertError) {
          console.error(`[SyncService] Error inserting calendar event in DB: ${insertError.message}`);
          continue;
        }
        savedEventId = insertedEvent.id;
        importedCount++;

        // Track as new external event for AI understanding analysis
        newExternalEvents.push(insertedEvent);
      }

      // Upsert into calendar_event_links
      await supabase
        .from("calendar_event_links")
        .upsert({
          user_id: userId,
          task_id: existingLink?.task_id || existingEvent?.task_id || null,
          google_event_id: googleEventId,
          calendar_id: calendarId,
          sync_direction: "google_to_taskify",
          last_synced_at: new Date().toISOString(),
          etag: item.etag || null,
          status: "active"
        }, { onConflict: "task_id, google_event_id" });
    }

    // 4. Save the next sync token
    if (nextSyncToken) {
      await supabase
        .from("google_calendars")
        .update({
          sync_token: nextSyncToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", calRecord.id);
    }

    // 5. Trigger AI Event Understanding asynchronously on new events
    if (newExternalEvents.length > 0) {
      console.log(`[SyncService] Running AI Event Understanding on ${newExternalEvents.length} new external events.`);
      import("@/lib/ai/calendar-ai-service").then(({ CalendarAiService }) => {
        for (const event of newExternalEvents) {
          CalendarAiService.analyzeEventAndSync(userId, event, supabase, settings).catch((err) => {
            console.error(`[SyncService] AI Event reasoning failed for event ${event.id}:`, err);
          });
        }
      });
    }

    return { success: true, importedCount, deletedCount };
  }

  /**
   * Pushes a local event (e.g. deep-work focus block, travel buffer) to Google Calendar.
   */
  static async pushLocalEventToGoogle(
    userId: string,
    eventId: string,
    customSupabase?: SupabaseClient<Database>
  ): Promise<boolean> {
    const supabase = (customSupabase || createServiceClient()) as any;

    // 1. Fetch user's sync configurations
    const { data: account } = await supabase
      .from("google_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!account || !account.sync_enabled || account.sync_mode === "one_way_to_taskify") {
      return false; // Sync is disabled or is one-way from google to taskify
    }

    // 2. Fetch the target local event
    const { data: event, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error || !event) {
      console.error(`[SyncService] Local event ${eventId} not found`);
      return false;
    }

    if (event.event_type === "external") {
      return false; // Skip external events; they are managed from Google
    }

    // 3. Find the primary calendar ID
    const { data: primaryCal } = await supabase
      .from("google_calendars")
      .select("calendar_id")
      .eq("user_id", userId)
      .eq("primary", true)
      .maybeSingle();

    const calendarId = primaryCal?.calendar_id || "primary";

    // 4. Map the event to Google format
    const googleEventData: GoogleEventInput = {
      summary: event.title,
      description: event.description || `Taskify ${event.event_type} event.`,
      location: event.location || undefined,
      start: {
        dateTime: event.start_time,
        timeZone: event.timezone || "UTC",
      },
      end: {
        dateTime: event.end_time,
        timeZone: event.timezone || "UTC",
      },
    };

    try {
      if (event.google_event_id) {
        await GoogleCalendarClient.updateEvent(
          userId,
          calendarId,
          event.google_event_id,
          googleEventData
        );
        console.log(`[SyncService] Updated Google Calendar event ${event.google_event_id} for local event ${eventId}`);
      } else {
        const gEvent = await GoogleCalendarClient.createEvent(userId, calendarId, googleEventData);
        
        await supabase
          .from("calendar_events")
          .update({
            google_event_id: gEvent.id,
            calendar_id: calendarId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);
        
        console.log(`[SyncService] Created Google Calendar event ${gEvent.id} for local event ${eventId}`);
      }
      return true;
    } catch (err) {
      console.error(`[SyncService] Failed to push local event ${eventId} to Google:`, err);
      return false;
    }
  }

  /**
   * Deletes a local event from Google Calendar if it was linked.
   */
  static async deleteLocalEventFromGoogle(
    userId: string,
    googleEventId: string,
    calendarId: string
  ): Promise<boolean> {
    try {
      await GoogleCalendarClient.deleteEvent(userId, calendarId || "primary", googleEventId);
      console.log(`[SyncService] Deleted Google Calendar event ${googleEventId}`);
      return true;
    } catch (err) {
      console.error(`[SyncService] Failed to delete Google Calendar event ${googleEventId}:`, err);
      return false;
    }
  }

  /**
   * Subscribes Taskify to push webhook events from Google for a specific calendar.
   */
  static async watchCalendar(userId: string, calendarId: string): Promise<boolean> {
    const supabase = createServiceClient() as any;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
    }
    const webhookUrl = `${appUrl}/api/webhooks/google-calendar`;
    const channelId = crypto.randomUUID();

    try {
      const response = await GoogleCalendarClient.watchCalendar(userId, calendarId, webhookUrl, channelId);
      
      const expirationDate = response.expiration 
        ? new Date(Number(response.expiration)).toISOString()
        : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      await supabase
        .from("google_calendars")
        .update({
          webhook_channel_id: channelId,
          webhook_resource_id: response.resourceId,
          webhook_expiration: expirationDate,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("calendar_id", calendarId);

      console.log(`[SyncService] Subscribed to Google watch webhook for user ${userId}, calendar ${calendarId}`);
      return true;
    } catch (err) {
      console.error(`[SyncService] Webhook watch registration failed for calendar ${calendarId}:`, err);
      return false;
    }
  }

  /**
   * Pushes a Taskify task (creation or update) to Google Calendar if it has dates/deadlines.
   */
  static async pushTaskToGoogle(
    userId: string,
    taskId: string,
    customSupabase?: SupabaseClient<Database>
  ): Promise<boolean> {
    const supabase = (customSupabase || createServiceClient()) as any;

    try {
      // 1. Fetch user's sync configurations
      const { data: account } = await supabase
        .from("google_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!account || !account.sync_enabled) {
        return false;
      }

      const settings = account.sync_settings || {};
      const syncTaskifyToGoogle = settings.sync_taskify_to_google !== false; // Default true
      
      if (!syncTaskifyToGoogle) {
        return false;
      }

      // 2. Fetch the target task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (taskError || !task) {
        console.error(`[SyncService] Task ${taskId} not found:`, taskError?.message);
        return false;
      }

      // We only sync tasks that have deadlines
      if (!task.deadline) {
        console.log(`[SyncService] Task ${taskId} has no deadline. Skipping Google Calendar push.`);
        return false;
      }

      // 3. Find primary calendar ID
      const { data: primaryCal } = await supabase
        .from("google_calendars")
        .select("calendar_id")
        .eq("user_id", userId)
        .eq("primary", true)
        .maybeSingle();

      const calendarId = primaryCal?.calendar_id || "primary";

      // 4. Check mapping to see if Google Event already exists
      const { data: existingLink } = await supabase
        .from("calendar_event_links")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", userId)
        .maybeSingle();

      // Compute event duration
      const durationMins = task.estimated_duration || 60;
      const startStr = task.deadline;
      const endStr = new Date(new Date(startStr).getTime() + durationMins * 60 * 1000).toISOString();

      const googleEventData: GoogleEventInput = {
        summary: task.title,
        description: task.description || `Clutch AI Task. Status: ${task.status}. Priority: ${task.priority}`,
        start: {
          dateTime: startStr,
          timeZone: "UTC",
        },
        end: {
          dateTime: endStr,
          timeZone: "UTC",
        },
      };

      if (existingLink?.google_event_id) {
        await GoogleCalendarClient.updateEvent(
          userId,
          calendarId,
          existingLink.google_event_id,
          googleEventData
        );

        await supabase
          .from("calendar_event_links")
          .update({
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", existingLink.id);

        console.log(`[SyncService] Updated Google Calendar event ${existingLink.google_event_id} for task ${taskId}`);
      } else {
        const gEvent = await GoogleCalendarClient.createEvent(userId, calendarId, googleEventData);

        // Save mapping
        await supabase
          .from("calendar_event_links")
          .insert({
            user_id: userId,
            task_id: taskId,
            google_event_id: gEvent.id,
            calendar_id: calendarId,
            sync_direction: "taskify_to_google",
            last_synced_at: new Date().toISOString(),
            etag: gEvent.etag || null,
            status: "active"
          });

        console.log(`[SyncService] Created Google Calendar event ${gEvent.id} for task ${taskId}`);
      }

      return true;
    } catch (err) {
      console.error(`[SyncService] Failed to push task ${taskId} to Google Calendar:`, err);
      return false;
    }
  }

  /**
   * Deletes a Google Calendar event linked to a deleted Taskify task.
   */
  static async deleteTaskFromGoogle(
    userId: string,
    taskId: string,
    customSupabase?: SupabaseClient<Database>
  ): Promise<boolean> {
    const supabase = (customSupabase || createServiceClient()) as any;

    try {
      const { data: existingLink } = await supabase
        .from("calendar_event_links")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingLink?.google_event_id) {
        return false;
      }

      await GoogleCalendarClient.deleteEvent(
        userId,
        existingLink.calendar_id || "primary",
        existingLink.google_event_id
      );

      // Remove mapping
      await supabase
        .from("calendar_event_links")
        .delete()
        .eq("id", existingLink.id);

      console.log(`[SyncService] Deleted Google Calendar event ${existingLink.google_event_id} for task ${taskId}`);
      return true;
    } catch (err) {
      console.error(`[SyncService] Failed to delete Google Calendar event for task ${taskId}:`, err);
      return false;
    }
  }
}
