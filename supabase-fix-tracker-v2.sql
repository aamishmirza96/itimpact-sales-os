-- Grant table-level permissions to anon role (separate from RLS policies)
GRANT INSERT, UPDATE, SELECT ON public.analytics_sessions TO anon;
GRANT INSERT, SELECT ON public.analytics_events TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
