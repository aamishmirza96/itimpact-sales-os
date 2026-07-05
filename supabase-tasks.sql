-- Tasks table for assigning work across leads, projects, and form submissions
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  entity_type TEXT, -- 'lead' | 'project' | 'contact_submission' | 'job_application' | 'general_cv' | 'general'
  entity_id TEXT,
  entity_label TEXT, -- human-readable name of the entity (company name, candidate name, etc)
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT DEFAULT 'todo', -- todo | in_progress | completed
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage tasks" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update social_posts status options by adding new stages
-- (existing rows keep their status, new posts use new stages)
-- Stages: brief | in_production | ready_for_review | approved | scheduled | published | rejected

-- Add scheduled_for column to social_posts if not exists
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add follow-up fields to form submissions
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS followup_due DATE;

ALTER TABLE public.general_cv_submissions ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.general_cv_submissions ADD COLUMN IF NOT EXISTS followup_due DATE;

ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS followup_due DATE;

ALTER TABLE public.ai_assessments ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ai_assessments ADD COLUMN IF NOT EXISTS followup_due DATE;

-- Add assigned_to and due_date to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS task_status TEXT DEFAULT 'none'; -- none | todo | in_progress | completed
