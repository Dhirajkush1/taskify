import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoalAdaptiveEngine, GoalScheduler } from "@/lib/ai/goal-analytics-engines";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { incident } = await request.json();
    if (!incident) {
      return NextResponse.json({ error: "Missing incident parameter" }, { status: 400 });
    }

    const result = await GoalAdaptiveEngine.adaptPlan(user.id, id, incident);

    // If successful, schedule tasks for active milestones in calendar
    if (result.success) {
      const { data: milestones } = await supabase
        .from("milestones")
        .select("id")
        .eq("goal_id", id)
        .eq("status", "todo");

      const todoMilestones = milestones || [];
      for (const ms of todoMilestones) {
        await GoalScheduler.scheduleMilestoneTasks(user.id, ms.id);
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
