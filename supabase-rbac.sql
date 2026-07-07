-- Role-based access control (July 2026)
-- Run this once in the Supabase SQL editor.

-- Per-module permissions for members/viewers, e.g.
-- {"sales":"edit","recruiting":"view","reports":"none"}
alter table profiles add column if not exists permissions jsonb default '{}';

-- Roles: ceo | admin | member | viewer (profiles.role already exists)
-- Bootstrap: make the owner accounts CEO. Edit the email list as needed.
update profiles set role = 'ceo'
where email in (
  'amishmirza@itimpactconsulting.us',
  'aamishmirza96@gmail.com',
  'digitalsalesai0@gmail.com'
);

-- NOTE: this enables in-app access control. For hard database-level
-- enforcement, RLS policies keyed on profiles.role should be added per
-- table in a follow-up (so a malicious client can't bypass the UI).
