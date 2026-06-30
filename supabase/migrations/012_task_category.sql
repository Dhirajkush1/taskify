-- ============================================================
-- Clutch AI — Task Categories Schema Extension
-- Migration: 012_task_category.sql
-- ============================================================

-- 1. Alter Tasks Table to Add Category Column with Enforced Checklist
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal' CHECK (
    category IN ('Personal', 'Work', 'Reminder', 'Calendar', 'Goal', 'Emergency')
  );

-- Indexing for category lookups
CREATE INDEX IF NOT EXISTS tasks_category_idx ON public.tasks(category);
