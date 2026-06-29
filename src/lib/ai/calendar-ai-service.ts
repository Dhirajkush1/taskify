import { SupabaseClient } from "@supabase/supabase-js";
import { AIClient } from "./providers";
import { GoogleCalendarClient } from "../google-calendar/client";
import { CalendarSyncService } from "../google-calendar/sync-service";
import type { Database } from "@/types/database.types";
import { parseISO, addMinutes, subMinutes, format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

export interface AIAnalysisOutput {
  purpose: string;
  priority: "critical" | "high" | "medium" | "low";
  risk_level: "low" | "medium" | "high" | "critical";
  travel_required: boolean;
  travel_time_minutes: number;
  preparation_required: boolean;
  preparation_time_minutes: number;
  estimated_energy: "low" | "medium" | "high";
  suggested_focus_hours: number;
  dependencies: string[];
  suggested_tasks: Array<{
    title: string;
    description: string;
    estimated_duration: number; // minutes
    priority: "critical" | "high" | "medium" | "low";
    days_before_event: number; // when to complete
  }>;
}

export class CalendarAiService {

  /**
   * Run Gemini AI to understand an imported calendar event and auto-schedule preparation tasks,
   * travel buffers, or focus blocks.
   */
  static async analyzeEventAndSync(
    userId: string,
    event: any,
    supabase: any
  ): Promise<AIAnalysisOutput | null> {
    try {
      console.log(`[CalendarAIService] Running event analysis for event: "${event.title}"`);
      
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const eventDurationMinutes = Math.round((eventEnd.getTime() - eventStart.getTime()) / 60000);

      const systemPrompt = `You are Clutch AI's Calendar Intelligence Engine.
Analyze the following Google Calendar event details and output a detailed JSON analysis.
Evaluate the title, description, location, and guests.
Identify templates:
- If it's an Exam, return preparation study plans, revision timeline, focus sessions.
- If it's a Flight/Travel, calculate packing checklist, airport travel buffer, boarding reminder.
- If it's an Interview, return resume review, company research, practice questions.
- If it's a client/team Meeting, return document review, questions prep task.
- Otherwise, map it to a standard professional task or reminder list.

You MUST respond with a single, strictly valid JSON object matching the schema below. Output nothing else.

JSON SCHEMA:
{
  "purpose": "Brief summary of what this event is about",
  "priority": "critical" | "high" | "medium" | "low",
  "risk_level": "low" | "medium" | "high" | "critical",
  "travel_required": true/false (true if location implies physical travel like an airport, office across town, restaurant, etc.),
  "travel_time_minutes": integer (estimated travel time, e.g. 30, 45, 60 or 0 if travel_required is false),
  "preparation_required": true/false (true if this event requires reading, research, studying, or document review beforehand),
  "preparation_time_minutes": integer (estimated prep minutes required, e.g. 15, 30, 60, 120 or 0),
  "estimated_energy": "low" | "medium" | "high",
  "suggested_focus_hours": float (hours of focus blocks to book for prep),
  "dependencies": ["Any other calendar events or tasks this depends on"],
  "suggested_tasks": [
    {
      "title": "Actionable task name (e.g. Prepare presentation for X)",
      "description": "Short explanation",
      "estimated_duration": minutes (integer),
      "priority": "critical" | "high" | "medium" | "low",
      "days_before_event": integer (how many days before the event this task should be completed)
    }
  ]
}`;

      const eventContext = {
        title: event.title,
        description: event.description || "",
        location: event.location || "",
        duration_minutes: eventDurationMinutes,
        start_time: event.start_time,
        end_time: event.end_time,
        guests_count: event.guests?.length || 0,
      };

      const responseText = await AIClient.generateText(
        [
          { role: "user" as const, content: `Analyze this calendar event details:\n${JSON.stringify(eventContext, null, 2)}` }
        ],
        {
          provider: "gemini",
          model: "gemini-1.5-flash",
          systemPrompt,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      );

      const cleanedJson = responseText.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const analysis: AIAnalysisOutput = JSON.parse(cleanedJson);

      // Save AI analysis back to calendar_events
      await supabase
        .from("calendar_events")
        .update({
          ai_analysis: analysis as any,
          updated_at: new Date().toISOString()
        })
        .eq("id", event.id);

      console.log(`[CalendarAIService] Saved AI Analysis for event: "${event.title}". Risk: ${analysis.risk_level}, Prep Minutes: ${analysis.preparation_time_minutes}`);

      // 1. Create prep tasks suggested by AI
      if (analysis.suggested_tasks && analysis.suggested_tasks.length > 0) {
        for (const t of analysis.suggested_tasks) {
          const taskDeadline = subMinutes(eventStart, t.days_before_event * 24 * 60);
          
          const { data: taskData, error: taskError } = await supabase
            .from("tasks")
            .insert({
              user_id: userId,
              title: t.title,
              description: `Generated by Clutch AI for event "${event.title}".\n${t.description}`,
              deadline: taskDeadline.toISOString(),
              priority: t.priority,
              status: "todo",
              estimated_duration: t.estimated_duration,
              risk_level: analysis.risk_level,
              completion_probability: 100
            })
            .select()
            .single();

          if (taskError) {
            console.error(`[CalendarAIService] Failed to create prep task "${t.title}":`, taskError.message);
          } else {
            console.log(`[CalendarAIService] Created prep task: "${t.title}" for event "${event.title}"`);
          }
        }
      }

      // 2. Schedule Travel Buffer Block if travel is required
      if (analysis.travel_required && analysis.travel_time_minutes > 0) {
        const bufferStart = subMinutes(eventStart, Math.max(15, analysis.travel_time_minutes));
        const bufferEnd = eventStart;

        const { data: bufferEvent, error: bufferError } = await supabase
          .from("calendar_events")
          .insert({
            user_id: userId,
            title: `🚗 Travel Buffer: ${event.title}`,
            description: `Travel buffer block of ${analysis.travel_time_minutes} minutes calculated by Clutch AI.`,
            location: event.location || null,
            start_time: bufferStart.toISOString(),
            end_time: bufferEnd.toISOString(),
            timezone: event.timezone,
            event_type: "travel_buffer",
            status: "confirmed",
            visibility: "default",
            calendar_id: event.calendar_id
          })
          .select("id")
          .single();

        if (bufferError) {
          console.error(`[CalendarAIService] Failed to insert travel buffer event:`, bufferError.message);
        } else if (bufferEvent) {
          // Push to Google Calendar
          CalendarSyncService.pushLocalEventToGoogle(userId, bufferEvent.id, supabase).catch(err => {
            console.error("[CalendarAIService] Webhook sync travel buffer failed:", err);
          });
        }
      }

      // 3. Schedule Meeting Prep block if required
      if (analysis.preparation_required && analysis.preparation_time_minutes > 0) {
        // Meeting Prep blocks are placed directly before the travel buffer, or before the event itself
        const offsetMinutes = (analysis.travel_required && analysis.travel_time_minutes > 0) 
          ? analysis.travel_time_minutes 
          : 0;

        const prepStart = subMinutes(eventStart, offsetMinutes + analysis.preparation_time_minutes);
        const prepEnd = subMinutes(eventStart, offsetMinutes);

        const { data: prepEvent, error: prepError } = await supabase
          .from("calendar_events")
          .insert({
            user_id: userId,
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

        if (prepError) {
          console.error(`[CalendarAIService] Failed to insert prep event:`, prepError.message);
        } else if (prepEvent) {
          // Push to Google Calendar
          CalendarSyncService.pushLocalEventToGoogle(userId, prepEvent.id, supabase).catch(err => {
            console.error("[CalendarAIService] Webhook sync prep event failed:", err);
          });
        }
      }

      return analysis;
    } catch (err) {
      console.error(`[CalendarAIService] Event analysis failed:`, err);
      return null;
    }
  }

  /**
   * Programmatic Availability Calculation Engine.
   * Compares working hours with active event/meeting blocks to compute free time slots.
   */
  static async getAvailableSlots(
    userId: string,
    targetDate: Date,
    supabase: any
  ): Promise<Array<{ start: string; end: string }>> {
    // 1. Fetch user settings for working hours
    const { data: settings } = await supabase
      .from("settings")
      .select("working_hours_start, working_hours_end, timezone")
      .eq("user_id", userId)
      .maybeSingle();

    const timezone = settings?.timezone || "UTC";
    const startHourStr = settings?.working_hours_start || "09:00";
    const endHourStr = settings?.working_hours_end || "17:00";

    const [startHour, startMin] = startHourStr.split(":").map(Number);
    const [endHour, endMin] = endHourStr.split(":").map(Number);

    // 2. Define the bounds of preferred work hours for the target day in UTC
    const dateStr = format(targetDate, "yyyy-MM-dd");
    const workStart = new Date(`${dateStr}T${startHourStr}:00Z`); // Stored as ISO representation
    const workEnd = new Date(`${dateStr}T${endHourStr}:00Z`);

    // 3. Fetch busy events overlapping with this day
    const dayStart = startOfDay(targetDate).toISOString();
    const dayEnd = endOfDay(targetDate).toISOString();

    const { data: events } = await supabase
      .from("calendar_events")
      .select("start_time, end_time")
      .eq("user_id", userId)
      .gte("end_time", dayStart)
      .lte("start_time", dayEnd);

    const busyBlocks: Array<{ start: Date; end: Date }> = (events || [])
      .map((e: any) => ({
        start: new Date(e.start_time),
        end: new Date(e.end_time)
      }))
      // Sort busy blocks chronologically
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());

    // 4. Subtract busy blocks from the working hours interval
    const freeSlots: Array<{ start: Date; end: Date }> = [];
    let currentCursor = workStart;

    for (const block of busyBlocks) {
      // If busy block is after our work hours, we can ignore remaining blocks
      if (isAfter(block.start, workEnd)) {
        break;
      }
      // If busy block ends before our cursor starts, skip it
      if (isBefore(block.end, currentCursor)) {
        continue;
      }

      // If there's a free gap between currentCursor and block start
      if (isAfter(block.start, currentCursor)) {
        const gapStart = currentCursor;
        const gapEnd = isBefore(block.start, workEnd) ? block.start : workEnd;
        
        // Only include slots that are at least 15 minutes long
        if ((gapEnd.getTime() - gapStart.getTime()) >= 15 * 60 * 1000) {
          freeSlots.push({ start: gapStart, end: gapEnd });
        }
      }

      // Move cursor forward
      if (isAfter(block.end, currentCursor)) {
        currentCursor = block.end;
      }
    }

    // Add final slot if there's space remaining before workEnd
    if (isBefore(currentCursor, workEnd) && (workEnd.getTime() - currentCursor.getTime()) >= 15 * 60 * 1000) {
      freeSlots.push({ start: currentCursor, end: workEnd });
    }

    return freeSlots.map(s => ({
      start: s.start.toISOString(),
      end: s.end.toISOString()
    }));
  }

  /**
   * AI Focus Time Blocking scheduler.
   * Splits a task (e.g. 5 hours) into focus blocks (2h, 2h, 1h) and schedules them in free slots.
   */
  static async scheduleFocusBlocks(
    userId: string,
    taskId: string,
    supabase: any
  ): Promise<boolean> {
    try {
      // 1. Fetch Task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (taskError || !task) {
        console.error(`[FocusBlocking] Task ${taskId} not found:`, taskError?.message);
        return false;
      }

      const totalDuration = task.estimated_duration || 120; // fallback to 2 hours
      console.log(`[FocusBlocking] Auto-scheduling focus blocks for task "${task.title}" (${totalDuration} minutes)`);

      // 2. Split task into focus block sizes (e.g. max 120 minutes each)
      const maxBlockSize = 120; // 2 hours
      const blockDurations: number[] = [];
      let remaining = totalDuration;

      while (remaining > 0) {
        if (remaining >= maxBlockSize) {
          blockDurations.push(maxBlockSize);
          remaining -= maxBlockSize;
        } else {
          // If remaining time is tiny, append to the last block or push it
          if (remaining < 30 && blockDurations.length > 0) {
            blockDurations[blockDurations.length - 1] += remaining;
          } else {
            blockDurations.push(remaining);
          }
          remaining = 0;
        }
      }

      // 3. Search free slots over the next 5 days
      let daysSearched = 0;
      let scheduledCount = 0;
      const now = new Date();

      const primaryCal = await supabase
        .from("google_calendars")
        .select("calendar_id")
        .eq("user_id", userId)
        .eq("primary", true)
        .maybeSingle();
      
      const calendarId = primaryCal?.data?.calendar_id || "primary";

      while (daysSearched < 5 && blockDurations.length > 0) {
        const searchDate = new Date(now.getTime() + daysSearched * 24 * 60 * 60 * 1000);
        const freeSlots = await this.getAvailableSlots(userId, searchDate, supabase);

        for (const slot of freeSlots) {
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);
          let slotDuration = (slotEnd.getTime() - slotStart.getTime()) / 60000;

          let currentSlotCursor = slotStart;

          // Attempt to fit our blocks into this slot
          while (blockDurations.length > 0 && slotDuration >= 45) {
            const nextBlockDuration = blockDurations[0];
            
            if (slotDuration >= nextBlockDuration) {
              // Fit block completely
              const blockStart = currentSlotCursor;
              const blockEnd = addMinutes(blockStart, nextBlockDuration);

              // Save focus block event
              const { data: focusEvent, error: insertError } = await supabase
                .from("calendar_events")
                .insert({
                  user_id: userId,
                  title: `🧘 Focus: ${task.title}`,
                  description: `AI focus block scheduled by Clutch for task: ${task.title}.`,
                  start_time: blockStart.toISOString(),
                  end_time: blockEnd.toISOString(),
                  event_type: "focus_block",
                  task_id: task.id,
                  status: "confirmed",
                  visibility: "busy", // Mark as Busy in GCal
                  calendar_id: calendarId
                })
                .select("id")
                .single();

              if (!insertError && focusEvent) {
                // Sync back to Google Calendar
                CalendarSyncService.pushLocalEventToGoogle(userId, focusEvent.id, supabase).catch(err => {
                  console.error("[FocusBlocking] Failed to push focus event to Google:", err);
                });
                
                scheduledCount++;
              }

              // Update cursor
              currentSlotCursor = blockEnd;
              slotDuration -= nextBlockDuration;
              blockDurations.shift(); // Remove scheduled block
            } else {
              // Block is larger than slot. Split the block to fit the slot if slot is at least 60 mins
              if (slotDuration >= 60) {
                const blockStart = currentSlotCursor;
                const blockEnd = slotEnd;
                const fittedDuration = slotDuration;

                const { data: focusEvent, error: insertError } = await supabase
                  .from("calendar_events")
                  .insert({
                    user_id: userId,
                    title: `🧘 Focus: ${task.title} (Part)`,
                    description: `AI split focus block scheduled by Clutch for task: ${task.title}.`,
                    start_time: blockStart.toISOString(),
                    end_time: blockEnd.toISOString(),
                    event_type: "focus_block",
                    task_id: task.id,
                    status: "confirmed",
                    visibility: "busy",
                    calendar_id: calendarId
                  })
                  .select("id")
                  .single();

                if (!insertError && focusEvent) {
                  CalendarSyncService.pushLocalEventToGoogle(userId, focusEvent.id, supabase).catch(err => {
                    console.error("[FocusBlocking] Failed to push split focus event to Google:", err);
                  });
                  scheduledCount++;
                }

                // Adjust block duration
                blockDurations[0] -= fittedDuration;
                slotDuration = 0; // slot exhausted
              } else {
                // Slot too small for this block, check next slot
                break;
              }
            }
          }
        }
        daysSearched++;
      }

      console.log(`[FocusBlocking] Successfully scheduled ${scheduledCount} focus blocks for task: ${task.title}`);
      return blockDurations.length === 0;
    } catch (err) {
      console.error("[FocusBlocking] Scheduling engine crashed:", err);
      return false;
    }
  }

  /**
   * Conflict Detection Engine.
   * Scans events on a day and flags double bookings, late hours, back-to-backs, and overbooks.
   */
  static async detectConflicts(
    userId: string,
    targetDate: Date,
    supabase: any
  ): Promise<Array<{
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    affected_events: string[];
    action_suggestion: {
      action: "move" | "delay" | "split" | "decline";
      text: string;
      payload: any;
    };
  }>> {
    const dayStart = startOfDay(targetDate).toISOString();
    const dayEnd = endOfDay(targetDate).toISOString();

    // Fetch user settings
    const { data: settings } = await supabase
      .from("settings")
      .select("working_hours_start, working_hours_end")
      .eq("user_id", userId)
      .maybeSingle();

    const workStartStr = settings?.working_hours_start || "09:00";
    const workEndStr = settings?.working_hours_end || "17:00";

    const { data: events } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .gte("end_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time", { ascending: true });

    const conflicts: any[] = [];
    const activeEvents = events || [];

    if (activeEvents.length === 0) return conflicts;

    let totalMeetingMinutes = 0;
    let totalFocusMinutes = 0;

    // 1. Check double bookings & back-to-back overlaps
    for (let i = 0; i < activeEvents.length; i++) {
      const eA = activeEvents[i];
      const startA = new Date(eA.start_time);
      const endA = new Date(eA.end_time);
      
      const durationMins = (endA.getTime() - startA.getTime()) / 60000;
      if (eA.event_type === "external") {
        totalMeetingMinutes += durationMins;
      } else if (eA.event_type === "focus_block") {
        totalFocusMinutes += durationMins;
      }

      // Check for late night meetings
      const formattedStart = format(startA, "HH:mm");
      const formattedEnd = format(endA, "HH:mm");

      if (formattedStart < workStartStr || formattedEnd > workEndStr) {
        conflicts.push({
          type: "late_night",
          severity: "medium",
          title: `Late Meeting: "${eA.title}"`,
          description: `This event is scheduled outside of your preferred work hours (${workStartStr} - ${workEndStr}).`,
          affected_events: [eA.id],
          action_suggestion: {
            action: "move",
            text: "Reschedule to working hours",
            payload: { eventId: eA.id, moveType: "work_hours" }
          }
        });
      }

      for (let j = i + 1; j < activeEvents.length; j++) {
        const eB = activeEvents[j];
        const startB = new Date(eB.start_time);
        const endB = new Date(eB.end_time);

        // Check if there is an overlap
        if (isBefore(startB, endA) && isAfter(endB, startA)) {
          conflicts.push({
            type: "double_booking",
            severity: eA.event_type === "external" && eB.event_type === "external" ? "critical" : "high",
            title: `Overlap: "${eA.title}" & "${eB.title}"`,
            description: `You have overlapping commitments on this day.`,
            affected_events: [eA.id, eB.id],
            action_suggestion: {
              action: "move",
              text: `Move focus block or reschedule "${eB.title}"`,
              payload: { eventA: eA.id, eventB: eB.id }
            }
          });
        }

        // Check back-to-back meeting blocks (meetings starting immediately after one ends, with 0 min break)
        const gap = (startB.getTime() - endA.getTime()) / 60000;
        if (gap === 0 && eA.event_type === "external" && eB.event_type === "external") {
          conflicts.push({
            type: "back_to_back",
            severity: "low",
            title: `Back-to-Back: "${eA.title}" & "${eB.title}"`,
            description: `No rest time between these sessions. We suggest adding a 5-minute breather.`,
            affected_events: [eA.id, eB.id],
            action_suggestion: {
              action: "split",
              text: "Insert 5m buffer",
              payload: { eventA: eA.id, eventB: eB.id, bufferMinutes: 5 }
            }
          });
        }
      }
    }

    // 2. Check Overbooked day (total hours > 8 hrs of combined workload)
    const totalWorkloadHours = (totalMeetingMinutes + totalFocusMinutes) / 60;
    if (totalWorkloadHours > 8) {
      conflicts.push({
        type: "overbooked",
        severity: totalWorkloadHours > 10 ? "high" : "medium",
        title: "Overbooked Workday",
        description: `Your calendar is loaded with ${totalWorkloadHours.toFixed(1)} hours of commitments today, exceeding the 8h focus threshold.`,
        affected_events: [],
        action_suggestion: {
          action: "delay",
          text: "Delay low-priority focus tasks to tomorrow",
          payload: { totalHours: totalWorkloadHours }
        }
      });
    }

    // 3. Check for Lunch breaks (no 30m free gap between 12:00 PM and 2:00 PM)
    const lunchStart = new Date(`${format(targetDate, "yyyy-MM-dd")}T12:00:00Z`);
    const lunchEnd = new Date(`${format(targetDate, "yyyy-MM-dd")}T14:00:00Z`);
    
    let hasLunchGap = false;
    let cursor = lunchStart;
    
    // Sort events overlapping lunch hours
    const lunchBusy = activeEvents
      .map((e: any) => ({ start: new Date(e.start_time), end: new Date(e.end_time) }))
      .filter((e: any) => isBefore(e.start, lunchEnd) && isAfter(e.end, lunchStart))
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());

    for (const block of lunchBusy) {
      if (isBefore(block.end, cursor)) continue;
      if (isAfter(block.start, cursor)) {
        const gap = (block.start.getTime() - cursor.getTime()) / 60000;
        if (gap >= 30) {
          hasLunchGap = true;
          break;
        }
      }
      cursor = block.end;
    }
    if (!hasLunchGap && (lunchEnd.getTime() - cursor.getTime()) / 60000 >= 30) {
      hasLunchGap = true;
    }

    if (!hasLunchGap && activeEvents.length > 1) {
      conflicts.push({
        type: "no_lunch",
        severity: "medium",
        title: "No Lunch Break Scheduled",
        description: "You are booked straight through lunch hours (12 PM - 2 PM). Consider blocking 30 mins to recharge.",
        affected_events: [],
        action_suggestion: {
          action: "split",
          text: "Clear a 30m lunch slot",
          payload: { date: format(targetDate, "yyyy-MM-dd") }
        }
      });
    }

    return conflicts;
  }
}
