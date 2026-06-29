import { decryptToken, encryptToken } from "@/lib/utils/crypto";
import { createServiceClient } from "@/lib/supabase/service";

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  recurrence?: string[];
  attendees?: Array<{ email: string; responseStatus?: string }>;
}

export class GoogleCalendarClient {
  private static get clientCredentials() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId) {
      throw new Error("Missing required environment variable: GOOGLE_CLIENT_ID");
    }
    if (!clientSecret) {
      throw new Error("Missing required environment variable: GOOGLE_CLIENT_SECRET");
    }
    return { clientId, clientSecret };
  }

  /**
   * Fetches and returns a valid, active access token for the given user.
   * If the token is expired or expiring in less than 5 minutes, it refreshes it automatically.
   */
  static async getValidAccessToken(userId: string): Promise<string> {
    const supabase = createServiceClient() as any;
    
    // Fetch user's Google account tokens
    const { data: account, error } = await supabase
      .from("google_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !account) {
      throw new Error(`Google account not connected for user: ${userId}`);
    }

    const expiresAt = new Date(account.expires_at).getTime();
    const now = Date.now();
    
    // If the token is valid for another 5 minutes (300,000 ms), return it
    if (expiresAt - now > 300 * 1000) {
      return decryptToken(account.access_token);
    }

    console.log(`[GoogleCalendarClient] Access token expired or expiring soon for user ${userId}. Refreshing...`);
    
    // Decrypt the refresh token
    const decryptedRefreshToken = decryptToken(account.refresh_token);
    const { clientId, clientSecret } = this.clientCredentials;

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: decryptedRefreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GoogleCalendarClient] Refresh token exchange failed: ${response.status} - ${errorText}`);
        throw new Error("Failed to refresh Google access token");
      }

      const tokenData = await response.json();
      const newAccessToken = tokenData.access_token;
      const expiresInSeconds = tokenData.expires_in || 3600;
      
      const encryptedAccessToken = encryptToken(newAccessToken);
      const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      
      // Update tokens in public.google_accounts
      const { error: updateError } = await supabase
        .from("google_accounts")
        .update({
          access_token: encryptedAccessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error(`[GoogleCalendarClient] Failed to save refreshed tokens to database: ${updateError.message}`);
      }

      return newAccessToken;
    } catch (err: any) {
      console.error(`[GoogleCalendarClient] Fatal error during token refresh:`, err);
      throw err;
    }
  }

  /**
   * Utility to execute HTTP requests to the Google Calendar API.
   */
  private static async request(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const accessToken = await this.getValidAccessToken(userId);
    const url = `https://www.googleapis.com/calendar/v3${endpoint}`;
    
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[GoogleCalendarClient] Request to ${endpoint} failed. Status: ${response.status}. Error: ${text}`);
      throw new Error(`Google Calendar API Error: ${response.status} - ${text}`);
    }

    return response.json();
  }

  /**
   * Fetch all calendars of the authenticated user.
   */
  static async listCalendars(userId: string) {
    return this.request(userId, "/users/me/calendarList");
  }

  /**
   * Fetch events from a calendar. Supports syncToken for delta sync.
   */
  static async listEvents(
    userId: string,
    calendarId: string,
    params: {
      syncToken?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
    } = {}
  ) {
    const queryParams = new URLSearchParams();
    if (params.syncToken) {
      queryParams.set("syncToken", params.syncToken);
    } else {
      if (params.timeMin) queryParams.set("timeMin", params.timeMin);
      if (params.timeMax) queryParams.set("timeMax", params.timeMax);
    }
    
    queryParams.set("singleEvents", (params.singleEvents !== false).toString());
    if (params.maxResults) {
      queryParams.set("maxResults", params.maxResults.toString());
    } else {
      queryParams.set("maxResults", "250");
    }

    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events?${queryParams.toString()}`;
    return this.request(userId, endpoint);
  }

  /**
   * Insert a new event into Google Calendar.
   */
  static async createEvent(
    userId: string,
    calendarId: string,
    eventData: GoogleEventInput
  ) {
    return this.request(userId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(eventData),
    });
  }

  /**
   * Update an existing event in Google Calendar.
   */
  static async updateEvent(
    userId: string,
    calendarId: string,
    googleEventId: string,
    eventData: GoogleEventInput
  ) {
    return this.request(
      userId,
      `/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
      {
        method: "PUT",
        body: JSON.stringify(eventData),
      }
    );
  }

  /**
   * Delete an event from Google Calendar.
   */
  static async deleteEvent(userId: string, calendarId: string, googleEventId: string) {
    return this.request(
      userId,
      `/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Subscribe to event changes on a calendar (Webhook watch channel).
   */
  static async watchCalendar(
    userId: string,
    calendarId: string,
    webhookUrl: string,
    channelId: string
  ) {
    return this.request(userId, `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      }),
    });
  }

  /**
   * Stop an active watch channel subscription.
   */
  static async stopWatch(userId: string, channelId: string, resourceId: string) {
    return this.request(userId, "/channels/stop", {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        resourceId: resourceId,
      }),
    });
  }
}
