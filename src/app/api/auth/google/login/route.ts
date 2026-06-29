import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is logged in
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Build Google OAuth URL parameters
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Structured logging for debugging
    console.log("[OAuthLogin] Redirection parameters audit:", {
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
    if (!appUrl) {
      throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
    }
    
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ");

    // Use user ID as state to bind the OAuth exchange to this user session (CSRF protection)
    const state = user.id;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline"); // Crucial for getting a refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent screen to guarantee refresh token is returned
    authUrl.searchParams.set("state", state);

    console.log("[OAuthLogin] Generated Google OAuth Redirection URL:", authUrl.toString());

    return NextResponse.redirect(authUrl.toString());
  } catch (err: any) {
    console.error("[OAuthLogin] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
