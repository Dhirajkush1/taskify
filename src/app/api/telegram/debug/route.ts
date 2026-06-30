import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { TelegramBotService } from "@/lib/telegram/bot-service";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Instantiate Admin client for checking logs
    const supabaseAdmin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check database connectivity
    let dbStatus = "healthy";
    try {
      const { error } = await supabaseAdmin.from("users").select("count", { count: "exact", head: true });
      if (error) dbStatus = `unhealthy: ${error.message}`;
    } catch (e: any) {
      dbStatus = `unhealthy: ${e.message}`;
    }

    // 2. Fetch Bot details from Telegram API
    let botReachable = false;
    let botUsername = "unknown";
    try {
      const botMe = await TelegramBotService.getMe();
      if (botMe) {
        botReachable = true;
        botUsername = botMe.username;
      }
    } catch (err) {
      console.error("[TelegramDebug] Error checking bot me:", err);
    }

    // 3. Fetch Webhook registration details from Telegram API
    let webhookUrl = "none";
    let pendingUpdates = 0;
    try {
      const info = await TelegramBotService.getWebhookInfo();
      if (info) {
        webhookUrl = info.url;
        pendingUpdates = info.pending_update_count;
      }
    } catch (err) {
      console.error("[TelegramDebug] Error checking webhook info:", err);
    }

    // 4. Load Active User state if logged in
    let userDetails = null;
    let lastWebhook = null;

    if (user) {
      const { data: account } = await supabase
        .from("telegram_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      userDetails = {
        authenticated: true,
        userId: user.id,
        connected: account ? account.is_active : false,
        linkingCode: account ? account.linking_code : null,
        expiresAt: account ? account.linking_code_expires_at : null,
        telegramUserId: account ? account.telegram_user_id : null,
        chatId: account ? account.chat_id : null,
        linkedAt: account ? account.linked_at : null,
      };

      // Retrieve the latest logged webhook update payload for this user from activity_logs
      try {
        const { data: logs } = await supabaseAdmin
          .from("activity_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("action", "TelegramWebhookReceived")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (logs) {
          lastWebhook = {
            id: logs.id,
            receivedAt: logs.created_at,
            payload: logs.metadata
          };
        }
      } catch (err) {
        console.error("[TelegramDebug] Error retrieving last webhook from activity_logs:", err);
      }
    } else {
      userDetails = {
        authenticated: false,
        userId: null,
        connected: false,
        linkingCode: null,
      };
    }

    // 5. Build safe Env config check (without disclosing keys)
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "missing",
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? "configured" : "missing",
      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || "TaskifyAI_bot",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "not set (request origin fallback)"
    };

    return NextResponse.json({
      botReachable,
      botUsername,
      webhookUrl,
      pendingUpdates,
      dbStatus,
      envConfig: envCheck,
      userDetails,
      lastWebhookPayload: lastWebhook
    });

  } catch (err: any) {
    console.error("[TelegramDebugRoute] Critical error in debug router:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
