-- ============================================================
-- Clutch AI — Fix handle_new_user_settings Trigger Function
-- Migration: 014_fix_user_settings_trigger.sql
-- ============================================================

-- Fix handle_new_user_settings() to fetch raw_user_meta_data from auth.users
-- since the trigger fires on public.users which has no raw_user_meta_data column.
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
DECLARE
  v_raw_meta JSONB;
BEGIN
  -- Fetch metadata from the auth.users table
  SELECT raw_user_meta_data INTO v_raw_meta
    FROM auth.users
    WHERE id = NEW.id;

  INSERT INTO public.settings (
    user_id,
    timezone,
    locale,
    country
  ) VALUES (
    NEW.id,
    COALESCE(v_raw_meta->>'timezone', 'UTC'),
    COALESCE(v_raw_meta->>'locale', 'en-US'),
    COALESCE(v_raw_meta->>'country', 'US')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
