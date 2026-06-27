-- ============================================================
-- Clutch AI — Autonomous Companion Schema Extensions
-- Migration: 002_autonomous_extensions.sql
-- ============================================================

-- 1. Extend TASKS Table with autonomous columns
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS completion_probability NUMERIC DEFAULT 100 CHECK (completion_probability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS missing_information TEXT;

-- 2. Create EXECUTION PLANS Table
CREATE TABLE IF NOT EXISTS public.execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('daily', 'weekly')),
  plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_plans_user_id_idx ON public.execution_plans(user_id);

CREATE TRIGGER execution_plans_updated_at
  BEFORE UPDATE ON public.execution_plans
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Create PRODUCTIVITY SCORES Table (Analytics / Coaching)
CREATE TABLE IF NOT EXISTS public.productivity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  calculated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_date_score UNIQUE (user_id, calculated_date)
);

CREATE INDEX IF NOT EXISTS productivity_scores_user_id_idx ON public.productivity_scores(user_id);
CREATE INDEX IF NOT EXISTS productivity_scores_calculated_date_idx ON public.productivity_scores(calculated_date DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_scores ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies
CREATE POLICY "Users can CRUD own execution plans" 
  ON public.execution_plans 
  FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own productivity scores" 
  ON public.productivity_scores 
  FOR ALL 
  USING (auth.uid() = user_id);
