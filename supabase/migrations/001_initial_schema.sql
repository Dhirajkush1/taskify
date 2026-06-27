-- ============================================================
-- Clutch AI — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE (extends auth.users)
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- CONVERSATIONS TABLE
-- ============================================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversations_user_id_idx ON public.conversations(user_id);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'archived')),
  estimated_duration INTEGER, -- minutes
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_user_id_idx ON public.tasks(user_id);
CREATE INDEX tasks_status_idx ON public.tasks(status);
CREATE INDEX tasks_deadline_idx ON public.tasks(deadline);
CREATE INDEX tasks_priority_idx ON public.tasks(priority);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ============================================================
-- SUBTASKS TABLE
-- ============================================================
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subtasks_task_id_idx ON public.subtasks(task_id);

-- ============================================================
-- ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'task_created', 'task_completed', 'task_deleted', etc.
  entity_type TEXT NOT NULL, -- 'task', 'conversation', 'message'
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activity_logs_user_id_idx ON public.activity_logs(user_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs(created_at DESC);

-- ============================================================
-- SETTINGS TABLE
-- ============================================================
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_suggestions_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_summary_time TIME DEFAULT '09:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Auto-create settings on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_settings
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_settings();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Conversations
CREATE POLICY "Users can CRUD own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- Messages (via conversation ownership)
CREATE POLICY "Users can CRUD own messages" ON public.messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);

-- Tasks
CREATE POLICY "Users can CRUD own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- Subtasks (via task ownership)
CREATE POLICY "Users can CRUD own subtasks" ON public.subtasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = subtasks.task_id AND t.user_id = auth.uid())
);

-- Activity logs
CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can CRUD own settings" ON public.settings FOR ALL USING (auth.uid() = user_id);
