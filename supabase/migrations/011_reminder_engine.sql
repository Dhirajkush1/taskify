-- ============================================================
-- Clutch AI — Reminder Delivery Engine & Notification Center
-- Migration: 011_reminder_engine.sql
-- ============================================================

-- 1. Redesign Reminders Lifecycle Status Check & Add Tracking Columns
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_status_check;
ALTER TABLE public.reminders ADD CONSTRAINT reminders_status_check CHECK (
  status IN ('pending', 'scheduled', 'triggered', 'completed', 'expired', 'cancelled', 'archived', 'sending', 'sent', 'failed', 'skipped')
);

ALTER TABLE public.reminders 
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT false;

-- 2. Create NOTIFICATIONS Table (for Web Notification Center)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reminder', 'system', 'goal', 'task', 'follow_up')),
  read BOOLEAN NOT NULL DEFAULT false,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies
CREATE POLICY "Users can CRUD own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- 3. Add NOTIFICATIONS Table to Supabase Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'notifications' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
