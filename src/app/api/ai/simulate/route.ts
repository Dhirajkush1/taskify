import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SimulationEngine } from "@/lib/ai/simulation-engine";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { scenario } = body;

    if (!scenario) {
      return NextResponse.json({ error: "Scenario is required" }, { status: 400 });
    }

    const simulation = await SimulationEngine.runSimulation(user.id, scenario);
    if (!simulation) {
      return NextResponse.json({ error: "Failed to generate simulation" }, { status: 500 });
    }

    return NextResponse.json({ simulation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
