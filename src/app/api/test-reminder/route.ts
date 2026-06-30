import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ReminderService } from "@/lib/ai/reminder-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let userId = searchParams.get("userId");

  const supabase = createServiceClient();

  if (!userId) {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (user?.id) {
      userId = user.id;
    }
  }

  if (!userId) {
    return NextResponse.json({
      success: false,
      error: "No active user found or provided for testing.",
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }

  const targetTime = new Date(Date.now() + 60 * 1000).toISOString();
  
  try {
    const reminder = await ReminderService.createReminder(
      userId,
      {
        title: "🧪 Pipeline Test (due in 1 min)",
        description: "Checking that background cron worker dispatches reminders and inserts logs.",
        reminder_time: targetTime,
        reminder_type: "smart",
        created_from: "ai"
      },
      supabase
    );

    return NextResponse.json({
      success: true,
      userId,
      reminder_id: reminder.id,
      due_at: (reminder as any).due_at || reminder.reminder_time,
      status: reminder.status,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[TestReminderAPI] Failed to create diagnostic reminder:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Execution error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
