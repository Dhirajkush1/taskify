import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoalPlannerEngine } from "@/lib/ai/goal-planner-engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dialogue, latestMessage } = await request.json();
    if (!dialogue || !latestMessage) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const result = await GoalPlannerEngine.processInterview(user.id, dialogue, latestMessage);

    // Save dialogue session trace for diagnostic audit
    if (result.completed && result.blueprint) {
      await supabase.from("goal_ai_sessions").insert({
        user_id: user.id,
        session_type: "interview",
        summary: `Goal interview successfully completed: ${result.blueprint.title}`,
        dialogue: [...dialogue, { role: "user", content: latestMessage }],
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
