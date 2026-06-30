import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/utils/crypto";
import { CalendarSyncService } from "@/lib/google-calendar/sync-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Contains the user's ID
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = new URL("/settings", appUrl);

  if (error) {
    console.error("[OAuthCallback] Google returned an error:", error);
    settingsUrl.searchParams.set("google_connect", "error");
    settingsUrl.searchParams.set("msg", error);
    return NextResponse.redirect(settingsUrl.toString());
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("google_connect", "error");
    settingsUrl.searchParams.set("msg", "missing_code_or_state");
    return NextResponse.redirect(settingsUrl.toString());
  }

  try {
    // 1. Verify user is logged in and state matches user ID
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== state) {
      console.error("[OAuthCallback] State token verification failed. User mismatch.");
      settingsUrl.searchParams.set("google_connect", "error");
      settingsUrl.searchParams.set("msg", "state_verification_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // 2. Exchange code for access & refresh tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    // Structured logging for debugging
    console.log("[OAuthCallback] Token exchange parameters audit:", {
      APP_URL: appUrl,
      REDIRECT_URI: redirectUri,
      CLIENT_ID: clientId,
      VERCEL_URL: process.env.VERCEL_URL,
      NODE_ENV: process.env.NODE_ENV,
      Origin: request.nextUrl.origin,
      Host: request.headers.get("host"),
      Headers: Object.fromEntries(request.headers.entries()),
    });

    if (!clientId) {
      throw new Error("Missing required environment variable: GOOGLE_CLIENT_ID");
    }
    if (!clientSecret) {
      throw new Error("Missing required environment variable: GOOGLE_CLIENT_SECRET");
    }
    if (!redirectUri) {
      throw new Error("Missing required environment variable: GOOGLE_REDIRECT_URI");
    }

    console.log("[OAuthCallback] Exchanging authorization code for tokens...");
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[OAuthCallback] Token exchange failed: ${tokenResponse.status} - ${errorText}`);
      throw new Error(`Token exchange error: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!refreshToken) {
      console.warn("[OAuthCallback] WARNING: No refresh token returned. User may have already approved previously.");
    }

    // 3. Fetch user's Google profile email
    console.log("[OAuthCallback] Fetching user Google email profile...");
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let googleEmail = "unknown@gmail.com";
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      googleEmail = profileData.email || googleEmail;
    }

    // 4. Encrypt tokens and upsert into database
    console.log("[OAuthCallback] Storing encrypted tokens in Supabase...");
    const encryptedAccessToken = encryptToken(accessToken);
    
    let encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : "";
    if (!refreshToken) {
      const { data: existingAcct } = await supabase
        .from("google_accounts")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existingAcct?.refresh_token) {
        encryptedRefreshToken = existingAcct.refresh_token;
      } else {
        settingsUrl.searchParams.set("google_connect", "error");
        settingsUrl.searchParams.set("msg", "missing_refresh_token_retry");
        return NextResponse.redirect(settingsUrl.toString());
      }
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { data: googleAccount, error: dbError } = await supabase
      .from("google_accounts")
      .upsert({
        user_id: user.id,
        email: googleEmail,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (dbError || !googleAccount) {
      console.error("[OAuthCallback] Failed to store Google Account in DB:", dbError?.message);
      throw new Error(`Database error: ${dbError?.message}`);
    }

    // 5. Fetch and synchronize user's calendars list
    console.log("[OAuthCallback] Fetching Google Calendars list...");
    const calendarsResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text();
      console.error(`[OAuthCallback] Failed to fetch calendar list: ${calendarsResponse.status} - ${errorText}`);
      throw new Error(`Calendar list error: ${errorText}`);
    }

    const calendarListData = await calendarsResponse.json();
    const calendarsList = calendarListData.items || [];
    
    let primaryCalendarId = "primary";

    // Insert calendars in database
    for (const cal of calendarsList) {
      const isPrimary = cal.primary || cal.id === googleEmail;
      if (isPrimary) {
        primaryCalendarId = cal.id;
      }

      await supabase
        .from("google_calendars")
        .upsert({
          user_id: user.id,
          google_account_id: googleAccount.id,
          calendar_id: cal.id,
          summary: cal.summary || "Unnamed Calendar",
          description: cal.description || null,
          primary: isPrimary,
          selected: isPrimary,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id, calendar_id" });
    }

    // 6. Run initial event sync for the primary calendar
    console.log(`[OAuthCallback] Triggering initial events sync for ${primaryCalendarId}...`);
    await CalendarSyncService.syncCalendarEvents(user.id, primaryCalendarId, supabase);

    // 7. Subscribe to Google Calendar webhook watch updates
    console.log(`[OAuthCallback] Setting up calendar webhook watch subscription...`);
    await CalendarSyncService.watchCalendar(user.id, primaryCalendarId);

    // Redirect to settings page with success
    settingsUrl.searchParams.set("google_connect", "success");
    return NextResponse.redirect(settingsUrl.toString());

  } catch (err: any) {
    console.error("[OAuthCallback] Fatal error in Google callback handler:", err);
    settingsUrl.searchParams.set("google_connect", "error");
    settingsUrl.searchParams.set("msg", err.message || "unexpected_callback_error");
    return NextResponse.redirect(settingsUrl.toString());
  }
}
