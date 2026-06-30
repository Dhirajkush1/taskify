import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  
  try {
    const { data, error } = await supabase
      .from("reminder_logs")
      .select("*, reminder:reminders(title)")
      .order("execution_time", { ascending: false })
      .limit(5);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data || []
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to query reminder logs"
    }, { status: 500 });
  }
}
