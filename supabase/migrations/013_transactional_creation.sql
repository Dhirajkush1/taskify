-- ============================================================
-- Clutch AI — Transactional Creation & Auditing Schema
-- Migration: 013_transactional_creation.sql
-- ============================================================

-- 1. Create auditing logs table for Telegram Sync Diagnostics
CREATE TABLE IF NOT EXISTS public.telegram_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_message TEXT,
  extracted_json JSONB,
  task_status TEXT NOT NULL DEFAULT 'pending',
  reminder_status TEXT NOT NULL DEFAULT 'pending',
  calendar_status TEXT NOT NULL DEFAULT 'pending',
  scheduler_status TEXT NOT NULL DEFAULT 'pending',
  telegram_delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_tasks UUID[] DEFAULT '{}'::UUID[],
  created_reminders UUID[] DEFAULT '{}'::UUID[],
  created_events UUID[] DEFAULT '{}'::UUID[],
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and Policies for audits
ALTER TABLE public.telegram_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and users can view sync logs" ON public.telegram_sync_logs
  FOR SELECT USING (true); -- Accessible by client for debug logs

CREATE POLICY "Allow insertions of sync logs" ON public.telegram_sync_logs
  FOR INSERT WITH CHECK (true);

-- 2. Create PostgreSQL Atomic Transaction Function
CREATE OR REPLACE FUNCTION public.create_task_reminder_event_transaction(
  p_user_id UUID,
  p_task_title TEXT,
  p_task_desc TEXT,
  p_task_deadline TIMESTAMPTZ,
  p_task_priority TEXT,
  p_task_category TEXT,
  p_reminder_time TIMESTAMPTZ,
  p_reminder_type TEXT,
  p_recurrence TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_reminder_id UUID;
  v_event_id UUID;
  v_notif_id UUID;
  v_result JSONB;
  v_primary_cal_id TEXT;
BEGIN
  -- A. Fetch Primary Calendar ID for the user
  SELECT calendar_id INTO v_primary_cal_id
    FROM public.google_calendars
    WHERE user_id = p_user_id AND primary = true
    LIMIT 1;

  IF v_primary_cal_id IS NULL THEN
    v_primary_cal_id := 'primary';
  END IF;

  -- 1. Insert Task with Automatically Computed/Passed priority and category parameters
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    deadline,
    priority,
    category,
    status,
    completion_percentage,
    risk_level,
    completion_probability
  ) VALUES (
    p_user_id,
    p_task_title,
    p_task_desc,
    p_task_deadline,
    p_task_priority,
    p_task_category,
    'todo',
    0,
    'low',
    95
  ) RETURNING id INTO v_task_id;

  -- 2. Insert Reminder
  INSERT INTO public.reminders (
    user_id,
    task_id,
    title,
    reminder_time,
    reminder_type,
    recurrence_pattern,
    status,
    delivery_attempts,
    follow_up_sent
  ) VALUES (
    p_user_id,
    v_task_id,
    p_task_title,
    p_reminder_time,
    p_reminder_type,
    p_recurrence,
    'pending',
    0,
    false
  ) RETURNING id INTO v_reminder_id;

  -- 3. Insert Calendar Event (task_block type)
  INSERT INTO public.calendar_events (
    user_id,
    task_id,
    title,
    description,
    start_time,
    end_time,
    event_type,
    status,
    visibility,
    calendar_id
  ) VALUES (
    p_user_id,
    v_task_id,
    p_task_title,
    'Task reminder block automatically scheduled by Clutch AI.',
    p_reminder_time,
    p_reminder_time + INTERVAL '30 minutes',
    'task_block',
    'confirmed',
    'busy',
    v_primary_cal_id
  ) RETURNING id INTO v_event_id;

  -- 4. Insert Notification
  INSERT INTO public.notifications (
    user_id,
    task_id,
    title,
    message,
    type,
    read
  ) VALUES (
    p_user_id,
    v_task_id,
    'Task Reminder Scheduled: ' || p_task_title,
    'Your reminder is set for ' || to_char(p_reminder_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC.',
    'reminder',
    false
  ) RETURNING id INTO v_notif_id;

  -- Assemble Return Result
  v_result := jsonb_build_object(
    'success', true,
    'task_id', v_task_id,
    'reminder_id', v_reminder_id,
    'event_id', v_event_id,
    'notification_id', v_notif_id
  );
  
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Postgres rolls back automatically on error
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
