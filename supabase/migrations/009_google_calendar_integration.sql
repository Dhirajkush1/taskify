-- ============================================================
-- Clutch AI — Google Calendar & Event Sync Extensions
-- Migration: 009_google_calendar_integration.sql
-- ============================================================

-- 1. Create Google Accounts Table hh
CREATE TABLE IF NOT EXISTS public.google_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_mode TEXT NOT NULL DEFAULT 'two_way' CHECK (sync_mode IN ('one_way_to_taskify', 'one_way_to_google', 'two_way')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for google_accounts
CREATE INDEX IF NOT EXISTS google_accounts_user_id_idx ON public.google_accounts(user_id);

-- Trigger for updated_at on google_accounts
CREATE TRIGGER google_accounts_updated_at
  BEFORE UPDATE ON public.google_accounts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS for google_accounts
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_accounts
DROP POLICY IF EXISTS "Users can CRUD own google account" ON public.google_accounts;
CREATE POLICY "Users can CRUD own google account" ON public.google_accounts 
  FOR ALL USING (auth.uid() = user_id);


-- 2. Create Google Calendars Table
CREATE TABLE IF NOT EXISTS public.google_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  google_account_id UUID NOT NULL REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  selected BOOLEAN NOT NULL DEFAULT true,
  sync_token TEXT,
  webhook_channel_id TEXT,
  webhook_resource_id TEXT,
  webhook_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_calendar UNIQUE (user_id, calendar_id)
);

-- Indexes for google_calendars
CREATE INDEX IF NOT EXISTS google_calendars_user_id_idx ON public.google_calendars(user_id);
CREATE INDEX IF NOT EXISTS google_calendars_calendar_id_idx ON public.google_calendars(calendar_id);

-- Trigger for updated_at on google_calendars
CREATE TRIGGER google_calendars_updated_at
  BEFORE UPDATE ON public.google_calendars
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS for google_calendars
ALTER TABLE public.google_calendars ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_calendars
DROP POLICY IF EXISTS "Users can CRUD own google calendars" ON public.google_calendars;
CREATE POLICY "Users can CRUD own google calendars" ON public.google_calendars 
  FOR ALL USING (auth.uid() = user_id);


-- 3. Create Calendar Events Table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  guests JSONB DEFAULT '[]'::jsonb,
  meeting_link TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  recurrence TEXT[] DEFAULT '{}'::text[],
  recurring_event_id TEXT,
  original_start_time TIMESTAMPTZ,
  organizer JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'confirmed',
  visibility TEXT NOT NULL DEFAULT 'default',
  google_event_id TEXT,
  calendar_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('external', 'focus_block', 'travel_buffer', 'meeting_prep', 'task_block')),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_google_event UNIQUE (user_id, google_event_id)
);

-- Indexes for calendar_events
CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS calendar_events_end_time_idx ON public.calendar_events(end_time);
CREATE INDEX IF NOT EXISTS calendar_events_google_event_id_idx ON public.calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS calendar_events_task_id_idx ON public.calendar_events(task_id);

-- Trigger for updated_at on calendar_events
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS for calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
DROP POLICY IF EXISTS "Users can CRUD own calendar events" ON public.calendar_events;
CREATE POLICY "Users can CRUD own calendar events" ON public.calendar_events 
  FOR ALL USING (auth.uid() = user_id);


-- 4. Enable Realtime Publications safely for the new tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'google_accounts' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'google_calendars' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_calendars;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'calendar_events' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
  END IF;
END $$;
