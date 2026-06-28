-- ============================================================
-- Clutch AI — Unified Calendar, Reminders & Timezone Extensions
-- Migration: 008_unified_calendar_reminders.sql
-- ============================================================

-- 1. Alter Settings Table to Store Timezone and Focus Hours
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS working_hours_start TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS working_hours_end TEXT NOT NULL DEFAULT '17:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS week_start INTEGER NOT NULL DEFAULT 1; -- 1 = Monday
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS preferred_focus_hours_start TEXT NOT NULL DEFAULT '10:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS preferred_focus_hours_end TEXT NOT NULL DEFAULT '12:00';

-- 2. Update handle_new_user_settings() Trigger to Read Metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.settings (
    user_id,
    timezone,
    locale,
    country
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC'),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-US'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'US')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redesign Reminders Lifecycle Status Check
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_status_check;
UPDATE public.reminders 
SET status = 'triggered' 
WHERE status NOT IN ('pending', 'scheduled', 'triggered', 'completed', 'expired', 'cancelled', 'archived');
ALTER TABLE public.reminders ADD CONSTRAINT reminders_status_check CHECK (status IN ('pending', 'scheduled', 'triggered', 'completed', 'expired', 'cancelled', 'archived'));

-- 4. Create Habits Table
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'weekdays', 'weekends')),
  streak INTEGER NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for habits
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits(user_id);

-- Update trigger for habits
CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS for habits
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies for habits
CREATE POLICY "Users can CRUD own habits" ON public.habits FOR ALL USING (auth.uid() = user_id);

-- 5. Automate Task Completion Triggers
-- Completing a task completes any associated reminders & notifies other channels
CREATE OR REPLACE FUNCTION public.handle_task_completion_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    -- Complete corresponding reminders
    UPDATE public.reminders
    SET status = 'completed', updated_at = now()
    WHERE task_id = NEW.id AND status NOT IN ('completed', 'archived', 'cancelled');
    
    -- Log activity
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.user_id, 'task_completed', 'task', NEW.id, jsonb_build_object('automatic_sync', true));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_completed_sync ON public.tasks;
CREATE TRIGGER on_task_completed_sync
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_task_completion_sync();

-- 6. Automate Reminder Completion Transitions (Auto-Archiving one-time completed reminders)
CREATE OR REPLACE FUNCTION public.handle_reminder_completion_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.reminder_type != 'recurring' THEN
    NEW.status := 'archived';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_reminder_completed_sync ON public.reminders;
CREATE TRIGGER on_reminder_completed_sync
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE PROCEDURE public.handle_reminder_completion_sync();

-- 7. Enable Realtime Publications Safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'tasks' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'reminders' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'goals' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'settings' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'execution_plans' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.execution_plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'activity_logs' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'habits' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.habits;
  END IF;
END $$;
