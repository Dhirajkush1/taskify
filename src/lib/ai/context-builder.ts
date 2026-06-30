import { createClient } from "@/lib/supabase/server";
import { MemoryService } from "./memory-service";
import type { Task } from "@/types/app.types";

export interface CompiledContext {
  promptContextString: string;
  personality: string;
  settings: {
    timezone: string;
    locale: string;
    country: string;
    working_hours_start: string;
    working_hours_end: string;
    week_start: number;
    preferred_focus_hours_start: string;
    preferred_focus_hours_end: string;
  };
}

export class ContextBuilder {
  /**
   * Automatically builds a relevant, minimal, and high-fidelity context prompt
   * using database states, unfinished tasks, schedules, memories, and active personality.
   */
  static async buildContext(userId: string, queryText: string, supabaseClient?: any): Promise<CompiledContext> {
    const supabase = supabaseClient || (await createClient());

    // Fetch data in parallel
    const [
      { data: tasks },
      { data: plan },
      { data: settingsRow },
      relevantMemories,
      { data: calendarEvents }
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, description, deadline, priority, status, estimated_duration, priority_score, risk_level, completion_probability, dependencies, milestone_id")
        .eq("user_id", userId)
        .neq("status", "done")
        .neq("status", "archived")
        .order("priority_score", { ascending: false }),
      supabase
        .from("execution_plans")
        .select("plan_data")
        .eq("user_id", userId)
        .eq("plan_type", "daily")
        .maybeSingle(),
      supabase
        .from("settings")
        .select("ai_personality, timezone, locale, country, working_hours_start, working_hours_end, week_start, preferred_focus_hours_start, preferred_focus_hours_end")
        .eq("user_id", userId)
        .maybeSingle(),
      MemoryService.getRelevantMemories(userId, queryText, supabaseClient),
      supabase
        .from("calendar_events")
        .select("title, start_time, end_time, event_type, location")
        .eq("user_id", userId)
        .gte("end_time", new Date(Date.now() - 12 * 3600 * 1000).toISOString()) // from 12 hours ago
        .lte("start_time", new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString()) // up to 5 days ahead
        .order("start_time", { ascending: true })
    ]);

    const activeTasks = tasks || [];
    const activePlan = (plan?.plan_data as { today?: string[] } | null) || null;
    const personality = settingsRow?.ai_personality || "friendly_coach";
    const activeCalendarEvents = calendarEvents || [];

    const settings = {
      timezone: settingsRow?.timezone || "UTC",
      locale: settingsRow?.locale || "en-US",
      country: settingsRow?.country || "US",
      working_hours_start: settingsRow?.working_hours_start || "09:00",
      working_hours_end: settingsRow?.working_hours_end || "17:00",
      week_start: settingsRow?.week_start ?? 1,
      preferred_focus_hours_start: settingsRow?.preferred_focus_hours_start || "10:00",
      preferred_focus_hours_end: settingsRow?.preferred_focus_hours_end || "12:00"
    };

    // 1. Calculate user's current local time in their configured timezone
    let userLocalTimeStr = new Date().toISOString();
    try {
      userLocalTimeStr = new Date().toLocaleString("en-US", {
        timeZone: settings.timezone,
        dateStyle: "full",
        timeStyle: "long"
      });
    } catch (e) {
      console.warn(`[ContextBuilder] Invalid timezone "${settings.timezone}", defaulting to UTC.`);
    }

    // 2. Compile User Memories Section
    let memoriesStr = "";
    if (relevantMemories.length > 0) {
      memoriesStr = "\nUSER PREFERENCES & MEMORIES:\n" + 
        relevantMemories.map(m => `- ${m.memory_key.replace("_", " ")}: "${m.memory_value}"`).join("\n") + "\n";
    }

    // 3. Compile Calendar & Timezone Preferences
    const prefStr = `\nUSER CALENDAR & TIMEZONE CONFIGURATION:
- User Timezone (IANA): ${settings.timezone}
- Current Local Time for User: ${userLocalTimeStr}
- Locale/Country: ${settings.locale} / ${settings.country}
- Standard Working Hours: ${settings.working_hours_start} to ${settings.working_hours_end}
- Preferred Daily Focus Window: ${settings.preferred_focus_hours_start} to ${settings.preferred_focus_hours_end}
- Week Starts On Index: ${settings.week_start} (1=Monday, 0=Sunday)
`;

    // 4. Compile Unfinished Tasks Section
    let tasksStr = "";
    if (activeTasks.length > 0) {
      tasksStr = "\nCURRENT UNFINISHED TASKS:\n" +
        activeTasks.map((t: Task) => 
          `- Task: "${t.title}" | Priority Score: ${t.priority_score}% | Status: ${t.status} | Effort: ${t.estimated_duration || 30} mins | Deadline: ${t.deadline || "None"} | Risk: ${t.risk_level} | Dependencies: [${((t.dependencies as string[] | null) || []).join(", ")}]`
        ).join("\n") + "\n";
    } else {
      tasksStr = "\nNo current unfinished tasks in queue.\n";
    }

    // 5. Compile Active Work Blocks / Schedule Section
    let planStr = "";
    if (activePlan && activePlan.today && activePlan.today.length > 0) {
      planStr = "\nTODAY'S ACTIVE EXECUTION SCHEDULE:\n" +
        activePlan.today.map((b: string) => `- ${b}`).join("\n") + "\n";
    }

    // 5.5. Compile Calendar Events
    let calendarStr = "";
    if (activeCalendarEvents.length > 0) {
      calendarStr = "\nUSER'S CALENDAR COMMITMENTS (Meetings & Work blocks):\n" +
        activeCalendarEvents.map((e: any) => 
          `- "${e.title}" | Type: ${e.event_type} | Start: ${e.start_time} | End: ${e.end_time} | Location: ${e.location || "None"}`
        ).join("\n") + "\n";
    }

    // 6. Compile Personality Instruction Prompt Overlay
    let personalityPrompt = "";
    switch (personality) {
      case "strict_coach":
        personalityPrompt = `PERSONALITY: STRICT COACH
- Tone: Extremely direct, firm, high-discipline, and no-excuses.
- Style: You treat productivity like athletic training. Command focus, highlight delays strictly, push them to cut procrastination, and use short, punchy language.`;
        break;
      case "minimal_assistant":
        personalityPrompt = `PERSONALITY: MINIMAL ASSISTANT
- Tone: Highly concise, objective, ultra-professional, and quiet.
- Style: Minimize conversational chatter. Provide structural plans, clean bullet points, and direct answers without excessive pleasantries or emojis.`;
        break;
      case "student_mentor":
        personalityPrompt = `PERSONALITY: STUDENT MENTOR
- Tone: Warm, highly supportive, relatable, peer-to-peer, and collaborative.
- Style: Use student-friendly language. Focus on stress relief, exam prep balances, study-break cycles (e.g., Pomodoros), and balancing social life with academics.`;
        break;
      case "professional_planner":
        personalityPrompt = `PERSONALITY: PROFESSIONAL PLANNER
- Tone: Strategic, analytical, structured, and business-focused.
- Style: Focus on resource allocation, deadline risks, critical paths, dependency blockages, and high-performance metrics. Organize plans like corporate sprints.`;
        break;
      default: // friendly_coach
        personalityPrompt = `PERSONALITY: FRIENDLY COACH
- Tone: Warm, highly encouraging, empathetic, positive, and supportive.
- Style: Focus on building small habits, celebrating wins, reducing stress, and offering comforting advice when overdue tasks happen. Use warm emojis and active encouragement.`;
    }

    // Compile everything into a structured prompt context block
    const promptContextString = `
=== CLUTCH CONTEXT COMMAND ===
The following is active, live context retrieved from Clutch's database about this user. 
Integrate these details seamlessly to customize your schedules, plans, coach remarks, task estimations, and timezone calculations.
${personalityPrompt}
${prefStr}
${memoriesStr}
${tasksStr}
${planStr}
${calendarStr}
==============================
`;

    return {
      promptContextString,
      personality,
      settings
    };
  }
}
