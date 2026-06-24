-- =====================================================
-- Phase 1 — Team, Articles, Social Planner, Notifications, Analytics
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Team Members (extends profiles with more detail)
alter table public.profiles add column if not exists designation text default '';
alter table public.profiles add column if not exists department text default '';
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists bio text default '';
alter table public.profiles add column if not exists skills text[] default '{}';
alter table public.profiles add column if not exists status text default 'active' check (status in ('active', 'away', 'offline'));

-- 2. Articles / Knowledge Base
create table public.articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text default '',
  cover_image text,
  category text default 'general',
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references public.profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.articles enable row level security;
create policy "Articles visible to authenticated" on public.articles for select using (auth.role() = 'authenticated');
create policy "Articles insertable by authenticated" on public.articles for insert with check (auth.role() = 'authenticated');
create policy "Articles updatable by authenticated" on public.articles for update using (auth.role() = 'authenticated');
create policy "Articles deletable by author" on public.articles for delete using (auth.uid() = author_id);

-- 3. Article Images
create table public.article_images (
  id uuid default gen_random_uuid() primary key,
  article_id uuid references public.articles(id) on delete cascade,
  url text not null,
  caption text default '',
  created_at timestamptz default now()
);

alter table public.article_images enable row level security;
create policy "Article images visible to authenticated" on public.article_images for select using (auth.role() = 'authenticated');
create policy "Article images insertable by authenticated" on public.article_images for insert with check (auth.role() = 'authenticated');
create policy "Article images deletable by authenticated" on public.article_images for delete using (auth.role() = 'authenticated');

-- 4. Social Media Posts (Planner + Approval Workflow)
create table public.social_posts (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  platforms text[] default '{}',
  media_urls text[] default '{}',
  scheduled_date timestamptz,
  status text default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'published', 'scheduled')),
  author_id uuid references public.profiles(id) not null,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.social_posts enable row level security;
create policy "Social posts visible to authenticated" on public.social_posts for select using (auth.role() = 'authenticated');
create policy "Social posts insertable by authenticated" on public.social_posts for insert with check (auth.role() = 'authenticated');
create policy "Social posts updatable by authenticated" on public.social_posts for update using (auth.role() = 'authenticated');
create policy "Social posts deletable by authenticated" on public.social_posts for delete using (auth.role() = 'authenticated');

-- 5. Post Approvals
create table public.post_approvals (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.social_posts(id) on delete cascade not null,
  approver_id uuid references public.profiles(id) not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comment text default '',
  responded_at timestamptz,
  created_at timestamptz default now()
);

alter table public.post_approvals enable row level security;
create policy "Approvals visible to authenticated" on public.post_approvals for select using (auth.role() = 'authenticated');
create policy "Approvals insertable by authenticated" on public.post_approvals for insert with check (auth.role() = 'authenticated');
create policy "Approvals updatable by approver" on public.post_approvals for update using (auth.uid() = approver_id);

-- 6. Notifications
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text default '',
  link text default '',
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;
create policy "Users see own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Notifications insertable by authenticated" on public.notifications for insert with check (auth.role() = 'authenticated');
create policy "Users update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- 7. Website Analytics Events
create table public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  event_type text not null,
  page_url text default '',
  page_title text default '',
  referrer text default '',
  user_agent text default '',
  screen_width int,
  screen_height int,
  click_x int,
  click_y int,
  element_tag text default '',
  element_text text default '',
  scroll_depth int,
  time_on_page int,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Analytics is public write (no auth needed — tracking script)
alter table public.analytics_events enable row level security;
create policy "Analytics insertable by anyone" on public.analytics_events for insert with check (true);
create policy "Analytics visible to authenticated" on public.analytics_events for select using (auth.role() = 'authenticated');

-- 8. Analytics Sessions
create table public.analytics_sessions (
  id text primary key,
  first_page text default '',
  last_page text default '',
  pages_viewed int default 1,
  total_time int default 0,
  device text default '',
  browser text default '',
  country text default '',
  started_at timestamptz default now(),
  ended_at timestamptz default now()
);

alter table public.analytics_sessions enable row level security;
create policy "Sessions insertable by anyone" on public.analytics_sessions for insert with check (true);
create policy "Sessions updatable by anyone" on public.analytics_sessions for update using (true);
create policy "Sessions visible to authenticated" on public.analytics_sessions for select using (auth.role() = 'authenticated');

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;
