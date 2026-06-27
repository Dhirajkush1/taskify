-- ============================================================
-- Clutch AI — Enable User Profile Self-Healing under RLS
-- Migration: 005_users_insert_policy.sql
-- ============================================================

-- Add INSERT policy for users to create their own profile row.
-- This allows the Next.js API self-healing block to succeed under RLS.
CREATE POLICY "Users can insert own profile" 
  ON public.users 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);
