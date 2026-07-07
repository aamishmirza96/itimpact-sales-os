-- Role-based access control (July 2026)
-- Run this once in the Supabase SQL editor.

-- Per-module permissions for members/viewers, e.g.
-- {"sales":"edit","recruiting":"view","reports":"none"}
alter table profiles add column if not exists permissions jsonb default '{}';

-- Roles: ceo | coo | admin | member | viewer (ceo and coo are equal top tier)
-- Abu Bakar — CEO
update profiles set role = 'ceo' where email = 'abu@itimpactconsulting.us';
-- Ali Faruqi — COO (same access as CEO)
update profiles set role = 'coo' where email = 'ali@itimpactconsulting.us';
-- Aamish Mirza — Admin (complete access; assigns access for the rest of the team)
update profiles set role = 'admin'
where email in ('amishmirza@itimpactconsulting.us', 'aamishmirza96@gmail.com');

-- NOTE: this enables in-app access control. For hard database-level
-- enforcement, RLS policies keyed on profiles.role should be added per
-- table in a follow-up (so a malicious client can't bypass the UI).
