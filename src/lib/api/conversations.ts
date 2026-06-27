import type { Conversation, ConversationInsert, Message, MessageInsert } from "@/types/app.types";
import { createClient } from "@/lib/supabase/client";

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createConversation(conversation: ConversationInsert): Promise<Conversation> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .insert(conversation)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveMessage(message: MessageInsert): Promise<Message> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert(message)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
