import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/calendar/settings
 * Fetch calendar synchronization settings for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account, error } = await supabase
      .from("google_accounts")
      .select("sync_settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings = (account as any)?.sync_settings || {
      import_window: 90,
      import_historical: false,
      sync_recurring: false,
      meeting_detection: true,
      birthday_detection: false,
      holiday_detection: false,
      task_creation: "manual_suggest",
      reminder_creation: true,
      auto_ai_planning: false
    };

    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("[CalendarSettingsAPI] Fetch failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/calendar/settings
 * Update calendar synchronization settings for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    // Upsert or update google_accounts setting
    const { error } = await supabase
      .from("google_accounts")
      .update({
        sync_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error("[CalendarSettingsAPI] Update failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
