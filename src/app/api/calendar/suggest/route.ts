import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CalendarAiService } from "@/lib/ai/calendar-ai-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    console.log(`[SuggestAPI] Running conflict analysis for date: ${dateStr}, user: ${user.id}`);
    const conflicts = await CalendarAiService.detectConflicts(user.id, targetDate, supabase);

    return NextResponse.json({ data: conflicts });
  } catch (err: any) {
    console.error("[SuggestAPI] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
