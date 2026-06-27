-- Migration 006: AI Intelligence Upgrade (Rescue Mode, Simulator, Daily/Weekly Debriefs)

-- 1. Rescue Plans Table
CREATE TABLE IF NOT EXISTS public.rescue_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  emergency_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  hours_remaining NUMERIC DEFAULT 0,
  completion_probability INTEGER DEFAULT 100,
  recovery_probability INTEGER DEFAULT 100,
  current_risk VARCHAR DEFAULT 'Low',
  estimated_finish_time TIMESTAMPTZ,
  emergency_action_plan JSONB DEFAULT '[]'::jsonb,
  remaining_focus_sessions INTEGER DEFAULT 0,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_rescue_plan UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.rescue_plans ENABLE ROW LEVEL SECURITY;

-- Check if policy already exists to avoid errors, or drop and recreate
DROP POLICY IF EXISTS "Users can CRUD own rescue plans" ON public.rescue_plans;
CREATE POLICY "Users can CRUD own rescue plans" ON public.rescue_plans 
  FOR ALL USING (auth.uid() = user_id);

-- 2. Daily Debriefs Table
CREATE TABLE IF NOT EXISTS public.daily_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  debrief_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  delayed_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  tomorrow_priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  tomorrow_probability INTEGER DEFAULT 100,
  best_achievement TEXT,
  missed_opportunities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_debrief_date UNIQUE (user_id, debrief_date)
);

-- Enable RLS
ALTER TABLE public.daily_debriefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own daily debriefs" ON public.daily_debriefs;
CREATE POLICY "Users can CRUD own daily debriefs" ON public.daily_debriefs 
  FOR ALL USING (auth.uid() = user_id);

-- 3. Weekly Reflections Table
CREATE TABLE IF NOT EXISTS public.weekly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reflection_text TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  weekly_wins JSONB NOT NULL DEFAULT '[]'::jsonb,
  focus_trends JSONB NOT NULL DEFAULT '[]'::jsonb,
  burnout_trend JSONB NOT NULL DEFAULT '[]'::jsonb,
  coaching_advice TEXT,
  suggested_changes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_weekly_reflection UNIQUE (user_id, start_date)
);

-- Enable RLS
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own weekly reflections" ON public.weekly_reflections;
CREATE POLICY "Users can CRUD own weekly reflections" ON public.weekly_reflections 
  FOR ALL USING (auth.uid() = user_id);
