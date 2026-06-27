import { createClient } from "@/lib/supabase/server";
import { MemoryService } from "./memory-service";

export interface CompiledContext {
  promptContextString: string;
  personality: string;
}

export class ContextBuilder {
  /**
   * Automatically builds a relevant, minimal, and high-fidelity context prompt
   * using database states, unfinished tasks, schedules, memories, and active personality.
   */
  static async buildContext(userId: string, queryText: string): Promise<CompiledContext> {
    const supabase = await createClient();

    // Fetch data in parallel
    const [
      { data: tasks },
      { data: plan },
      { data: settingsRow },
      relevantMemories
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
        .select("ai_personality")
        .eq("user_id", userId)
        .maybeSingle(),
      MemoryService.getRelevantMemories(userId, queryText)
    ]);

    const activeTasks = tasks || [];
    const activePlan = (plan?.plan_data as { today?: string[] } | null) || null;
    const personality = settingsRow?.ai_personality || "friendly_coach";

    // 1. Compile User Memories Section
    let memoriesStr = "";
    if (relevantMemories.length > 0) {
      memoriesStr = "\nUSER PREFERENCES & MEMORIES:\n" + 
        relevantMemories.map(m => `- ${m.memory_key.replace("_", " ")}: "${m.memory_value}"`).join("\n") + "\n";
    }

    // 2. Compile Unfinished Tasks Section
    let tasksStr = "";
    if (activeTasks.length > 0) {
      tasksStr = "\nCURRENT UNFINISHED TASKS:\n" +
        activeTasks.map(t => 
          `- Task: "${t.title}" | Priority Score: ${t.priority_score}% | Status: ${t.status} | Effort: ${t.estimated_duration || 30} mins | Deadline: ${t.deadline || "None"} | Risk: ${t.risk_level} | Dependencies: [${((t.dependencies as string[] | null) || []).join(", ")}]`
        ).join("\n") + "\n";
    } else {
      tasksStr = "\nNo current unfinished tasks in queue.\n";
    }

    // 3. Compile Active Work Blocks / Schedule Section
    let planStr = "";
    if (activePlan && activePlan.today && activePlan.today.length > 0) {
      planStr = "\nTODAY'S ACTIVE EXECUTION SCHEDULE:\n" +
        activePlan.today.map((b: string) => `- ${b}`).join("\n") + "\n";
    }

    // 4. Compile Personality Instruction Prompt Overlay
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
Integrate these details seamlessly to customize your schedules, plans, coach remarks, and task estimations.
${personalityPrompt}
${memoriesStr}
${tasksStr}
${planStr}
==============================
`;

    return {
      promptContextString,
      personality
    };
  }
}
