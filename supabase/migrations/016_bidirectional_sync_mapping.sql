-- ============================================================
-- Clutch AI — Google Calendar Bidirectional Sync Extensions
-- Migration: 016_bidirectional_sync_mapping.sql
-- ============================================================

-- 1. Create Mapping Table
CREATE TABLE IF NOT EXISTS public.calendar_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'both' CHECK (sync_direction IN ('google_to_taskify', 'taskify_to_google', 'both')),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  etag TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_link_task_google UNIQUE (task_id, google_event_id)
);

-- Indexes for calendar_event_links
CREATE INDEX IF NOT EXISTS calendar_event_links_user_id_idx ON public.calendar_event_links(user_id);
CREATE INDEX IF NOT EXISTS calendar_event_links_task_id_idx ON public.calendar_event_links(task_id);
CREATE INDEX IF NOT EXISTS calendar_event_links_google_event_id_idx ON public.calendar_event_links(google_event_id);

-- Trigger for updated_at on calendar_event_links
CREATE TRIGGER calendar_event_links_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS for calendar_event_links
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_event_links
DROP POLICY IF EXISTS "Users can CRUD own calendar event links" ON public.calendar_event_links;
CREATE POLICY "Users can CRUD own calendar event links" ON public.calendar_event_links 
  FOR ALL USING (auth.uid() = user_id);

-- 2. Add safe table publications mapping for Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND c.relname = 'calendar_event_links' AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_links;
  END IF;
END $$;
