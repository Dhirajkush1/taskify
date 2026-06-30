-- ============================================================
-- Clutch AI — Taskify v2 Architecture Refactor
-- Migration: 017_v2_architecture_refactor.sql
-- ============================================================

-- 1. Create PROJECTS Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 2. Create PROJECT TASKS Table
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  due_date TIMESTAMPTZ,
  estimated_duration INTEGER, -- in minutes
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  ai_summary TEXT,
  linked_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  linked_google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_tasks_user_id_idx ON public.project_tasks(user_id);
CREATE INDEX IF NOT EXISTS project_tasks_project_id_idx ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS project_tasks_status_idx ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS project_tasks_due_date_idx ON public.project_tasks(due_date);

CREATE TRIGGER project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Create WEEKLY OBJECTIVES Table
CREATE TABLE IF NOT EXISTS public.weekly_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  week_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_objectives_milestone_id_idx ON public.weekly_objectives(milestone_id);
CREATE INDEX IF NOT EXISTS weekly_objectives_week_start_idx ON public.weekly_objectives(week_start);

CREATE TRIGGER weekly_objectives_updated_at
  BEFORE UPDATE ON public.weekly_objectives
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Create GOAL TASKS Table
CREATE TABLE IF NOT EXISTS public.goal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES public.weekly_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  deadline TIMESTAMPTZ,
  estimated_duration INTEGER, -- in minutes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_tasks_user_id_idx ON public.goal_tasks(user_id);
CREATE INDEX IF NOT EXISTS goal_tasks_objective_id_idx ON public.goal_tasks(objective_id);
CREATE INDEX IF NOT EXISTS goal_tasks_status_idx ON public.goal_tasks(status);
CREATE INDEX IF NOT EXISTS goal_tasks_deadline_idx ON public.goal_tasks(deadline);

CREATE TRIGGER goal_tasks_updated_at
  BEFORE UPDATE ON public.goal_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 5. Create INBOX ITEMS Table
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbox_items_user_id_idx ON public.inbox_items(user_id);

CREATE TRIGGER inbox_items_updated_at
  BEFORE UPDATE ON public.inbox_items
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 6. Extend Goals table with overall completion percentage
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100);

-- 7. Add Progress Recalculation Engine triggers/functions

CREATE OR REPLACE FUNCTION public.recalculate_goal_progress(p_milestone_id UUID)
RETURNS VOID AS $$
DECLARE
  v_goal_id UUID;
  v_total_ms INTEGER;
  v_sum_percentage INTEGER;
  v_goal_percentage INTEGER;
BEGIN
  -- Get goal_id
  SELECT goal_id INTO v_goal_id 
  FROM public.milestones 
  WHERE id = p_milestone_id;

  IF v_goal_id IS NOT NULL THEN
    SELECT COUNT(*), COALESCE(SUM(completion_percentage), 0)
    INTO v_total_ms, v_sum_percentage
    FROM public.milestones
    WHERE goal_id = v_goal_id;

    IF v_total_ms > 0 THEN
      v_goal_percentage := v_sum_percentage / v_total_ms;
    ELSE
      v_goal_percentage := 0;
    END IF;

    UPDATE public.goals 
    SET completion_percentage = v_goal_percentage,
        status = CASE 
          WHEN v_goal_percentage = 100 THEN 'completed'::text
          ELSE status
        END,
        updated_at = now()
    WHERE id = v_goal_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.recalculate_milestone_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_milestone_id UUID;
  v_total_tasks INTEGER;
  v_completed_tasks INTEGER;
  v_percentage INTEGER;
BEGIN
  -- Find the milestone_id from the objective
  IF TG_OP = 'DELETE' THEN
    SELECT milestone_id INTO v_milestone_id 
    FROM public.weekly_objectives 
    WHERE id = OLD.objective_id;
  ELSE
    SELECT milestone_id INTO v_milestone_id 
    FROM public.weekly_objectives 
    WHERE id = NEW.objective_id;
  END IF;

  IF v_milestone_id IS NOT NULL THEN
    -- Count total tasks under weekly objectives of this milestone
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done')
    INTO v_total_tasks, v_completed_tasks
    FROM public.goal_tasks gt
    JOIN public.weekly_objectives wo ON gt.objective_id = wo.id
    WHERE wo.milestone_id = v_milestone_id;

    IF v_total_tasks > 0 THEN
      v_percentage := (v_completed_tasks * 100) / v_total_tasks;
    ELSE
      v_percentage := 0;
    END IF;

    -- Update milestone
    UPDATE public.milestones 
    SET completion_percentage = v_percentage,
        status = CASE 
          WHEN v_percentage = 100 THEN 'done'::text
          WHEN v_percentage > 0 THEN 'in_progress'::text
          ELSE 'todo'::text
        END,
        updated_at = now()
    WHERE id = v_milestone_id;

    -- Trigger goal recalculation
    PERFORM public.recalculate_goal_progress(v_milestone_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_goal_task_status_change
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.recalculate_milestone_progress();

-- 8. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

-- 9. Define RLS Policies for user isolation
CREATE POLICY "Users can CRUD own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own project tasks" ON public.project_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own weekly objectives" ON public.weekly_objectives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.milestones ms
      JOIN public.goals g ON ms.goal_id = g.id
      WHERE ms.id = weekly_objectives.milestone_id 
      AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD own goal tasks" ON public.goal_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own inbox items" ON public.inbox_items
  FOR ALL USING (auth.uid() = user_id);

-- 10. Enable Supabase Realtime tracking for new schemas
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_objectives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_items;
