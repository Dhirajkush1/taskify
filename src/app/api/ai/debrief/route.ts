import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebriefEngine } from "@/lib/ai/debrief-engine";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "daily"; // "daily" or "weekly"
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (type === "weekly") {
      const reflection = await DebriefEngine.getOrCreateWeeklyReflection(user.id);
      return NextResponse.json({ reflection });
    } else {
      const debrief = await DebriefEngine.getOrCreateDailyDebrief(user.id, dateStr);
      return NextResponse.json({ debrief });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { type, date } = body;

    if (type === "weekly") {
      const reflection = await DebriefEngine.getOrCreateWeeklyReflection(user.id);
      return NextResponse.json({ success: true, reflection });
    } else {
      const targetDate = date || new Date().toISOString().split("T")[0];
      const debrief = await DebriefEngine.getOrCreateDailyDebrief(user.id, targetDate);
      return NextResponse.json({ success: true, debrief });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
