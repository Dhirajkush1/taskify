-- ============================================================
-- Clutch AI — Telegram Integration Schema Extension
-- Migration: 007_telegram_integration.sql
-- ============================================================

-- 1. Create Telegram Accounts Table
CREATE TABLE IF NOT EXISTS public.telegram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT UNIQUE,
  chat_id BIGINT,
  linking_code TEXT UNIQUE,
  linking_code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS telegram_accounts_user_id_idx ON public.telegram_accounts(user_id);
CREATE INDEX IF NOT EXISTS telegram_accounts_telegram_user_id_idx ON public.telegram_accounts(telegram_user_id);
CREATE INDEX IF NOT EXISTS telegram_accounts_linking_code_idx ON public.telegram_accounts(linking_code);

-- Trigger for updating updated_at on telegram_accounts
CREATE TRIGGER telegram_accounts_updated_at
  BEFORE UPDATE ON public.telegram_accounts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 2. Create Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_debrief_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_reflection_enabled BOOLEAN NOT NULL DEFAULT true,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  emergency_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  focus_session_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx ON public.notification_preferences(user_id);

-- Trigger for updating updated_at on notification_preferences
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Auto-create notification_preferences on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists first
DROP TRIGGER IF EXISTS on_user_created_notification_preferences ON public.users;
CREATE TRIGGER on_user_created_notification_preferences
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_notification_preferences();

-- Seed notification_preferences for all existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 3. Create Telegram Notifications (Log) Table
CREATE TABLE IF NOT EXISTS public.telegram_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_account_id UUID REFERENCES public.telegram_accounts(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS telegram_notifications_user_id_idx ON public.telegram_notifications(user_id);
CREATE INDEX IF NOT EXISTS telegram_notifications_sent_at_idx ON public.telegram_notifications(sent_at DESC);

-- 4. Extend Messages Table with Source Column
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'
  CONSTRAINT messages_source_check CHECK (source IN ('web', 'telegram', 'whatsapp', 'discord'));

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.telegram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Telegram Accounts
DROP POLICY IF EXISTS "Users can CRUD own telegram account" ON public.telegram_accounts;
CREATE POLICY "Users can CRUD own telegram account" ON public.telegram_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Notification Preferences
DROP POLICY IF EXISTS "Users can CRUD own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can CRUD own notification preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Telegram Notifications (Log)
DROP POLICY IF EXISTS "Users can view own telegram notification logs" ON public.telegram_notifications;
CREATE POLICY "Users can view own telegram notification logs" ON public.telegram_notifications
  FOR SELECT USING (auth.uid() = user_id);
