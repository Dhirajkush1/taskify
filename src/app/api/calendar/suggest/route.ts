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

    // Fetch calendar events with pending AI task suggestions
    const { data: suggestions } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, ai_analysis")
      .eq("user_id", user.id)
      .eq("ai_analysis->>suggestion_status", "pending_approval");

    return NextResponse.json({ data: conflicts, suggestions: suggestions || [] });
  } catch (err: any) {
    console.error("[SuggestAPI] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
