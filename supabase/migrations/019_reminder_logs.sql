-- ============================================================
-- Clutch AI — Reminder Execution Logging Schema
-- Migration: 019_reminder_logs.sql
-- ============================================================

-- 1. Create REMINDER_LOGS Table
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  execution_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  telegram_response JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS reminder_logs_reminder_id_idx ON public.reminder_logs(reminder_id);
CREATE INDEX IF NOT EXISTS reminder_logs_execution_time_idx ON public.reminder_logs(execution_time DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- 4. Define RLS Policies
CREATE POLICY "Users can view own reminder logs" ON public.reminder_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.reminders WHERE id = reminder_id
    )
  );
