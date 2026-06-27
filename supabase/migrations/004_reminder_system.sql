-- ============================================================
-- Clutch AI — Reminder System Schema Extension
-- Migration: 004_reminder_system.sql
-- ============================================================

-- 1. Create REMINDERS Table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reminder_time TIMESTAMPTZ NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'specific_time' CHECK (reminder_type IN ('specific_time', 'relative_time', 'recurring', 'deadline', 'smart')),
  recurrence_pattern TEXT, -- e.g. 'daily', 'weekly', null
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_task_id_idx ON public.reminders(task_id);
CREATE INDEX IF NOT EXISTS reminders_reminder_time_idx ON public.reminders(reminder_time);

-- 3. Create Trigger for updated_at
CREATE TRIGGER reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies
CREATE POLICY "Users can CRUD own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id);
