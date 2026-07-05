-- =====================================================
-- IT Impact CRM — Upgrade SQL
-- Run this ONCE in Supabase SQL Editor
-- Fixes: social post statuses, tasks table, lead columns
-- =====================================================

-- 1. Fix social_posts CHECK constraint to allow new stage names
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('draft','pending_approval','approved','rejected','published','scheduled','brief','in_production','awaiting_review'));

-- Add new columns to social_posts if not exists
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add new columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS task_status TEXT DEFAULT 'none';

-- 3. Add follow-up columns to form submissions
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS followup_due DATE;

ALTER TABLE public.general_cv_submissions ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.general_cv_submissions ADD COLUMN IF NOT EXISTS followup_due DATE;

ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS followup_due DATE;

ALTER TABLE public.ai_assessments ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ai_assessments ADD COLUMN IF NOT EXISTS followup_due DATE;

-- 4. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  entity_type TEXT,
  entity_id TEXT,
  entity_label TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage tasks" ON public.tasks;
CREATE POLICY "Authenticated users manage tasks" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Ensure profiles have all columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Drop old check constraint on profiles.status if exists and re-add
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active','away','offline'));
