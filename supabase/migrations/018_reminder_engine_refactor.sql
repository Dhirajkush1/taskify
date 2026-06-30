-- ============================================================
-- Clutch AI — Centralized Reminder Engine Schema & Status Overhaul
-- Migration: 018_reminder_engine_refactor.sql
-- ============================================================

-- 1. Add extra metadata and tracking columns if not exist
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT '{"telegram", "web"}'::TEXT[],
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_from TEXT CHECK (created_from IN ('telegram', 'dashboard', 'calendar', 'ai', 'voice'));

-- 2. Backfill existing row values for continuity
UPDATE public.reminders
  SET due_at = COALESCE(due_at, reminder_time),
      delivered_at = COALESCE(delivered_at, sent_at);

-- Set due_at to NOT NULL after backfilling
ALTER TABLE public.reminders ALTER COLUMN due_at SET NOT NULL;

-- 3. Drop legacy status check constraint to allow mapping values
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_status_check;

-- 4. Map legacy statuses to fit the new strict list
-- Legacy: pending, scheduled, triggered, completed, expired, cancelled, archived, sending, sent, failed, skipped
-- Target: pending, scheduled, delivered, completed, dismissed, expired

UPDATE public.reminders SET status = 'delivered' WHERE status IN ('sent', 'triggered', 'sending', 'failed');
UPDATE public.reminders SET status = 'dismissed' WHERE status IN ('cancelled', 'archived', 'skipped');

-- 5. Define new strict status check constraint
ALTER TABLE public.reminders ADD CONSTRAINT reminders_status_check CHECK (
  status IN ('pending', 'scheduled', 'delivered', 'completed', 'dismissed', 'expired')
);
