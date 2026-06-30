import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ReminderService } from "@/lib/ai/reminder-service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, reminderId } = body;

    if (!action || !reminderId) {
      return NextResponse.json({ error: "Missing action or reminderId" }, { status: 400 });
    }

    const result = await ReminderService.handleReminderAction(
      user.id,
      action,
      reminderId,
      supabase
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: any) {
    console.error("[RemindersActionRoute] Error handling action:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
