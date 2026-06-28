import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Generate a cryptographically secure-looking alphanumeric code (e.g., CL-8F3A)
function generateLinkingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omit confusing chars like O, 0, I, 1
  let code = "CL-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GET /api/telegram/link
 * Retrieves connection status or generates a new linking code.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- SELF-HEALING DATABASE BLOCK ---
    // Check if the user profile exists in public.users. If it's missing, insert it.
    // This prevents foreign key violations (telegram_accounts_user_id_fkey) for new users.
    const { data: publicUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!publicUser) {
      console.log(`[Self-Healing] Public profile missing in public.users for ID ${user.id} in Telegram linking. Creating...`);
      const { error: insertUserError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url || null,
        });

      if (insertUserError) {
        console.error("[Self-Healing] Failed to create public user profile:", insertUserError.message);
      } else {
        console.log("[Self-Healing] Public user profile self-healed successfully!");
        // Also ensure settings record exists for the new user profile
        await supabase.from("settings").insert({ user_id: user.id });
      }
    }
    // -----------------------------------

    // Fetch telegram account mapping
    const { data: account, error: accountError } = await supabase
      .from("telegram_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch notification preferences
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (account && account.is_active) {
      return NextResponse.json({
        connected: true,
        telegramUserId: account.telegram_user_id,
        chatId: account.chat_id,
        linkedAt: account.linked_at,
        preferences: preferences || {}
      });
    }

    // Check if there is already an unexpired code
    if (account && account.linking_code && account.linking_code_expires_at) {
      const expiresAt = new Date(account.linking_code_expires_at).getTime();
      if (expiresAt > Date.now()) {
        return NextResponse.json({
          connected: false,
          linkingCode: account.linking_code,
          expiresAt: account.linking_code_expires_at,
          botUsername: process.env.TELEGRAM_BOT_USERNAME || "TaskifyAI_bot"
        });
      }
    }

    // Generate and save a new code
    const code = generateLinkingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    const { error: upsertError } = await supabase
      .from("telegram_accounts")
      .upsert({
        user_id: user.id,
        linking_code: code,
        linking_code_expires_at: expiresAt,
        is_active: false,
        telegram_user_id: null,
        chat_id: null,
        linked_at: null
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[TelegramLinkRoute] Error generating linking code:", upsertError.message);
      return NextResponse.json({ error: "Failed to generate linking code" }, { status: 500 });
    }

    return NextResponse.json({
      connected: false,
      linkingCode: code,
      expiresAt: expiresAt,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || "TaskifyAI_bot"
    });
  } catch (err: any) {
    console.error("[TelegramLinkRoute] Critical error in GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/telegram/link
 * Disconnects the user's Telegram integration.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from("telegram_accounts")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[TelegramLinkRoute] Error deleting telegram account:", deleteError.message);
      return NextResponse.json({ error: "Failed to disconnect Telegram" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Telegram account successfully disconnected." });
  } catch (err: any) {
    console.error("[TelegramLinkRoute] Critical error in POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
