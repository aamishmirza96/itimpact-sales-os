DROP POLICY IF EXISTS "anon_update_sessions" ON public.analytics_sessions;
CREATE POLICY "anon_update_sessions" ON public.analytics_sessions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
