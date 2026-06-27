-- ============================================================
-- Clutch AI — Phase 2 Companion Schema Extensions
-- Migration: 003_phase2_companion.sql
-- ============================================================

-- 1. Alter Settings table to add ai_personality
ALTER TABLE public.settings 
  ADD COLUMN IF NOT EXISTS ai_personality TEXT DEFAULT 'friendly_coach'
  CHECK (ai_personality IN ('friendly_coach', 'strict_coach', 'minimal_assistant', 'student_mentor', 'professional_planner'));

-- 2. Create USER MEMORIES Table (Long term memory)
CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  importance INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_memory_key UNIQUE (user_id, memory_key)
);

CREATE INDEX IF NOT EXISTS user_memories_user_id_idx ON public.user_memories(user_id);
CREATE INDEX IF NOT EXISTS user_memories_memory_key_idx ON public.user_memories(memory_key);

CREATE TRIGGER user_memories_updated_at
  BEFORE UPDATE ON public.user_memories
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Create GOALS Table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON public.goals(user_id);

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Create MILESTONES Table
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestones_goal_id_idx ON public.milestones(goal_id);

CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 5. Alter TASKS Table to support milestones
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_milestone_id_idx ON public.tasks(milestone_id);

-- 6. Create FOCUS SESSIONS Table
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL,
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_task_id_idx ON public.focus_sessions(task_id);

CREATE TRIGGER focus_sessions_updated_at
  BEFORE UPDATE ON public.focus_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 7. Create PRODUCTIVITY ANALYTICS HISTORY Table
CREATE TABLE IF NOT EXISTS public.productivity_analytics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  focus_time_minutes INTEGER DEFAULT 0,
  tasks_completed_count INTEGER DEFAULT 0,
  average_completion_minutes INTEGER DEFAULT 0,
  completion_probability_average NUMERIC DEFAULT 100,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_analytics_date UNIQUE (user_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS prod_analytics_user_id_idx ON public.productivity_analytics_history(user_id);
CREATE INDEX IF NOT EXISTS prod_analytics_recorded_date_idx ON public.productivity_analytics_history(recorded_date DESC);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_analytics_history ENABLE ROW LEVEL SECURITY;

-- 9. Define RLS Policies
CREATE POLICY "Users can CRUD own memories" ON public.user_memories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own goals" ON public.goals FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own milestones" ON public.milestones FOR ALL USING (
  EXISTS (SELECT 1 FROM public.goals g WHERE g.id = milestones.goal_id AND g.user_id = auth.uid())
);

CREATE POLICY "Users can CRUD own focus sessions" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own analytics history" ON public.productivity_analytics_history FOR ALL USING (auth.uid() = user_id);
