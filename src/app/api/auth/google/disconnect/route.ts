import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleCalendarClient } from "@/lib/google-calendar/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is logged in
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch the google account to get access token to revoke
    const { data: account } = await supabase
      .from("google_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (account) {
      try {
        // Try to revoke the access token
        const validAccessToken = await GoogleCalendarClient.getValidAccessToken(user.id);
        
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(validAccessToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        
        console.log(`[OAuthDisconnect] Successfully revoked Google token for user ${user.id}`);
      } catch (revokeErr) {
        console.warn(`[OAuthDisconnect] Non-blocking error revoking Google token:`, revokeErr);
      }

      // Stop any active watch webhook channels first if they exist
      try {
        const { data: calendars } = await supabase
          .from("google_calendars")
          .select("webhook_channel_id, webhook_resource_id")
          .eq("user_id", user.id);

        if (calendars) {
          for (const cal of calendars) {
            if (cal.webhook_channel_id && cal.webhook_resource_id) {
              await GoogleCalendarClient.stopWatch(user.id, cal.webhook_channel_id, cal.webhook_resource_id);
            }
          }
        }
      } catch (watchStopErr) {
        console.warn("[OAuthDisconnect] Non-blocking error stopping watch channels:", watchStopErr);
      }
    }

    // 3. Delete Google Account database record (cascades to delete google_calendars)
    console.log(`[OAuthDisconnect] Deleting google account records for user ${user.id}`);
    await supabase
      .from("google_accounts")
      .delete()
      .eq("user_id", user.id);

    // 4. Clean up imported external calendar events
    console.log(`[OAuthDisconnect] Cleaning up imported external calendar events for user ${user.id}`);
    await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_type", "external");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[OAuthDisconnect] Fatal error disconnecting Google account:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
