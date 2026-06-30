import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoalRiskEngine, GoalForecastEngine } from "@/lib/ai/goal-analytics-engines";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { metrics, notes, mood_energy } = await request.json();

    // 1. Insert check-in log
    const { data: checkin, error: checkinError } = await supabase
      .from("goal_checkins")
      .insert({
        goal_id: id,
        metrics: metrics || {},
        notes: notes || null,
        mood_energy: mood_energy || 5,
      })
      .select()
      .single();

    if (checkinError) {
      return NextResponse.json({ error: checkinError.message }, { status: 500 });
    }

    // 2. Trigger analytics engines
    await GoalRiskEngine.calculateGoalHealth(id);
    await GoalForecastEngine.runForecast(id);

    return NextResponse.json({ success: true, checkin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
