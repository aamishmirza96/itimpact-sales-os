-- Stores OAuth tokens for external integrations (Google, etc)
-- Only accessible via service_role key (used server-side in Netlify Functions), never exposed to browser
CREATE TABLE IF NOT EXISTS public.integrations (
  id text PRIMARY KEY,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role (which bypasses RLS) can access. anon/authenticated get nothing.
