-- Fix analytics RLS policies to allow anonymous tracking
-- Run this in Supabase SQL Editor

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Sessions updatable by anyone" ON public.analytics_sessions;
DROP POLICY IF EXISTS "Sessions insertable by anyone" ON public.analytics_sessions;
DROP POLICY IF EXISTS "Sessions visible to authenticated" ON public.analytics_sessions;

-- Recreate with proper anon access
CREATE POLICY "Sessions insertable by anon" ON public.analytics_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Sessions updatable by anon" ON public.analytics_sessions FOR UPDATE TO anon USING (true);
CREATE POLICY "Sessions visible to authenticated" ON public.analytics_sessions FOR SELECT TO authenticated USING (true);

-- Also fix events just in case
DROP POLICY IF EXISTS "Analytics insertable by anyone" ON public.analytics_events;
CREATE POLICY "Analytics insertable by anon" ON public.analytics_events FOR INSERT TO anon WITH CHECK (true);
