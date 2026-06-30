-- ============================================================
-- Clutch AI — AI Goal Operating System Extensions
-- Migration: 010_ai_goal_operating_system.sql
-- ============================================================

-- 1. Extend GOALS Table
ALTER TABLE public.goals 
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('personal', 'fitness', 'health', 'learning', 'career', 'business', 'finance', 'relationship', 'travel', 'habit', 'custom')),
  ADD COLUMN IF NOT EXISTS term TEXT CHECK (term IN ('short_term', 'medium_term', 'long_term')),
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS momentum_score INTEGER DEFAULT 100 CHECK (momentum_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS consistency INTEGER DEFAULT 100 CHECK (consistency BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blueprint JSONB,
  ADD COLUMN IF NOT EXISTS forecast JSONB;

-- 2. Extend MILESTONES Table
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS reward TEXT,
  ADD COLUMN IF NOT EXISTS risk TEXT;

-- 3. Extend HABITS Table to link directly to goals
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS habits_goal_id_idx ON public.habits(goal_id);

-- 4. Create GOAL CHECKINS Table
CREATE TABLE IF NOT EXISTS public.goal_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  mood_energy INTEGER CHECK (mood_energy BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_checkins_goal_id_idx ON public.goal_checkins(goal_id);

-- 5. Create GOAL PREDICTIONS Table
CREATE TABLE IF NOT EXISTS public.goal_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  success_probability NUMERIC NOT NULL CHECK (success_probability BETWEEN 0 AND 100),
  forecasted_completion DATE,
  risk_analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_predictions_goal_id_idx ON public.goal_predictions(goal_id);

-- 6. Create GOAL AI SESSIONS Table (stores dialogue logs of interviews and coach logs)
CREATE TABLE IF NOT EXISTS public.goal_ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('interview', 'checkin_analysis', 'coaching_feedback')),
  dialogue JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_ai_sessions_user_id_idx ON public.goal_ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS goal_ai_sessions_goal_id_idx ON public.goal_ai_sessions(goal_id);

-- 7. Enable RLS on New Tables
ALTER TABLE public.goal_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_ai_sessions ENABLE ROW LEVEL SECURITY;

-- 8. Define RLS Policies
CREATE POLICY "Users can CRUD own goal checkins" ON public.goal_checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.goals 
      WHERE goals.id = goal_checkins.goal_id 
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own goal predictions" ON public.goal_predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.goals 
      WHERE goals.id = goal_predictions.goal_id 
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD own goal AI sessions" ON public.goal_ai_sessions
  FOR ALL USING (auth.uid() = user_id);
