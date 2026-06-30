-- =====================================================
-- Website form submissions — Contact Us, Careers (general + job-specific), AI Readiness
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Contact Us form submissions
CREATE TABLE public.contact_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  company text DEFAULT '',
  phone text DEFAULT '',
  service_interest text[] DEFAULT '{}',
  message text DEFAULT '',
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contact submissions insertable by anyone" ON public.contact_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Contact submissions visible to authenticated" ON public.contact_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Contact submissions updatable by authenticated" ON public.contact_submissions FOR UPDATE TO authenticated USING (true);

-- 2. General CV submissions (careers — no specific role)
CREATE TABLE public.general_cv_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  current_title text DEFAULT '',
  current_company text DEFAULT '',
  location text DEFAULT '',
  linkedin_url text DEFAULT '',
  resume_url text DEFAULT '',
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.general_cv_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "General CVs insertable by anyone" ON public.general_cv_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "General CVs visible to authenticated" ON public.general_cv_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "General CVs updatable by authenticated" ON public.general_cv_submissions FOR UPDATE TO authenticated USING (true);

-- 3. Job-specific applications (careers — applied to a posted position)
CREATE TABLE public.job_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_title text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  current_title text DEFAULT '',
  current_company text DEFAULT '',
  employment_status text DEFAULT '',
  location text DEFAULT '',
  open_to_relocation text DEFAULT '',
  open_to_remote text DEFAULT '',
  current_salary text DEFAULT '',
  expected_salary text DEFAULT '',
  linkedin_url text DEFAULT '',
  resume_url text DEFAULT '',
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'interviewing', 'rejected', 'hired')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job applications insertable by anyone" ON public.job_applications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Job applications visible to authenticated" ON public.job_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Job applications updatable by authenticated" ON public.job_applications FOR UPDATE TO authenticated USING (true);

-- 4. AI Readiness Assessment submissions (with full report data)
CREATE TABLE public.ai_assessments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  company text DEFAULT '',
  overall_score numeric DEFAULT 0,
  overall_grade text DEFAULT '',
  category_scores jsonb DEFAULT '{}',
  report_data jsonb DEFAULT '{}',
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI assessments insertable by anyone" ON public.ai_assessments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "AI assessments visible to authenticated" ON public.ai_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "AI assessments updatable by authenticated" ON public.ai_assessments FOR UPDATE TO authenticated USING (true);

-- Realtime notifications when new submissions come in
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.general_cv_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_assessments;
