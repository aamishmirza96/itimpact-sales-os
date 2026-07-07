-- =====================================================
-- IT Impact CRM — Recruiting Tables
-- Run ONCE in Supabase SQL Editor
-- Creates positions and candidates tables with full CRUD
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recruiting_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT DEFAULT 'Full Time',
  location TEXT DEFAULT '',
  comp TEXT DEFAULT '',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Paused','Closed')),
  priority BOOLEAN DEFAULT false,
  sector TEXT DEFAULT '',
  drive_url TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  about TEXT DEFAULT '',
  responsibilities TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  opened_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.recruiting_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth manage rec positions" ON public.recruiting_positions;
CREATE POLICY "Auth manage rec positions" ON public.recruiting_positions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.recruiting_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES public.recruiting_positions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  initials TEXT DEFAULT '',
  current_role TEXT DEFAULT '',
  current_company TEXT DEFAULT '',
  location TEXT DEFAULT '',
  email TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  status TEXT DEFAULT 'new' CHECK (status IN ('new','reviewing','email-sent','shortlisted','interviewing','offered','rejected','on-hold')),
  email_sent BOOLEAN DEFAULT false,
  summary TEXT DEFAULT '',
  drive_url TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  current_salary TEXT DEFAULT '',
  desired_salary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.recruiting_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth manage rec candidates" ON public.recruiting_candidates;
CREATE POLICY "Auth manage rec candidates" ON public.recruiting_candidates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
