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
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "Date parameter is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    console.log(`[AvailabilityAPI] Fetching slots for date: ${dateStr}, user: ${user.id}`);
    const slots = await CalendarAiService.getAvailableSlots(user.id, targetDate, supabase);

    return NextResponse.json({ data: slots });
  } catch (err: any) {
    console.error("[AvailabilityAPI] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
