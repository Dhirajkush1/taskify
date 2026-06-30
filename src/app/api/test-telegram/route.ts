import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { TelegramBotService } from "@/lib/telegram/bot-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetChatId = searchParams.get("chatId");
  const targetUserId = searchParams.get("userId");

  let chatId = targetChatId;
  let logText = "";

  const supabase = createServiceClient();

  if (!chatId && targetUserId) {
    const { data } = await supabase
      .from("telegram_accounts")
      .select("chat_id")
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (data?.chat_id) {
      chatId = String(data.chat_id);
    } else {
      logText = `Telegram account not linked for user ${targetUserId}. `;
    }
  }

  if (!chatId) {
    // Get the first active account for testing convenience
    const { data } = await supabase
      .from("telegram_accounts")
      .select("chat_id, user_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (data?.chat_id) {
      chatId = String(data.chat_id);
      logText += `Using fallback active account for user ${data.user_id}. `;
    }
  }

  if (!chatId) {
    return NextResponse.json({
      success: false,
      error: logText || "No active Telegram chat ID found. Connect account in Settings first.",
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }

  console.log(`[TestTelegramAPI] Triggering test dispatch to chat ${chatId}...`);
  const messageText = `🧪 <b>Taskify Pipeline Test</b>\n\nThis is a diagnostic message checking your Telegram bot delivery integration.\n\nTime: <code>${new Date().toISOString()}</code>\nStatus: <b>OK</b>`;

  const result = await TelegramBotService.sendMessageWithResponse(chatId, messageText);

  return NextResponse.json({
    success: result.success,
    chatId,
    telegram_response: result.data || null,
    error: result.error || null,
    diagnostics: logText || "Direct parameter matching",
    timestamp: new Date().toISOString()
  });
}
