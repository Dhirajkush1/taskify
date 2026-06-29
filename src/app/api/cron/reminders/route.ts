import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ReminderService } from "@/lib/ai/reminder-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleCron();
}

export async function POST(request: NextRequest) {
  return handleCron();
}

async function handleCron() {
  const timestamp = new Date().toISOString();
  console.log(`[ReminderCron] Trigger received at ${timestamp}`);
  
  try {
    const supabase = createServiceClient();

    // 1. Process due pending reminders & retries
    await ReminderService.dispatchPendingReminders(supabase);

    // 2. Process ignored reminders requiring follow-ups
    await ReminderService.checkAndTriggerFollowUps(supabase);

    // 3. Log execution run to activity_logs
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000", // System UUID placeholder
      action: "CronReminderRun",
      entity_type: "system",
      metadata: { status: "success", timestamp }
    });

    return NextResponse.json({ success: true, timestamp });
  } catch (err: any) {
    console.error("[ReminderCron] Execution failed:", err);
    return NextResponse.json({ 
      error: err.message || "Internal execution error", 
      timestamp 
    }, { status: 500 });
  }
}
