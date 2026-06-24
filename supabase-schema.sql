-- =====================================================
-- IT Impact CRM — Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Profiles visible to authenticated users" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Allow insert for auth trigger" on public.profiles for insert with check (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Leads
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text default '',
  email text default '',
  phone text default '',
  source text default 'manual',
  status text default 'new' check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notes text default '',
  value numeric default 0,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;
create policy "Leads visible to authenticated" on public.leads for select using (auth.role() = 'authenticated');
create policy "Leads insertable by authenticated" on public.leads for insert with check (auth.role() = 'authenticated');
create policy "Leads updatable by authenticated" on public.leads for update using (auth.role() = 'authenticated');
create policy "Leads deletable by authenticated" on public.leads for delete using (auth.role() = 'authenticated');

-- 3. Projects
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text default '',
  status text default 'active' check (status in ('active', 'archived', 'completed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.projects enable row level security;
create policy "Projects visible to authenticated" on public.projects for select using (auth.role() = 'authenticated');
create policy "Projects insertable by authenticated" on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Projects updatable by authenticated" on public.projects for update using (auth.role() = 'authenticated');

-- 4. Project Members
create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (project_id, user_id)
);

alter table public.project_members enable row level security;
create policy "Members visible to authenticated" on public.project_members for select using (auth.role() = 'authenticated');
create policy "Members insertable by authenticated" on public.project_members for insert with check (auth.role() = 'authenticated');
create policy "Members deletable by authenticated" on public.project_members for delete using (auth.role() = 'authenticated');

-- 5. Messages (Message Board)
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  title text not null,
  body text default '',
  created_at timestamptz default now()
);

alter table public.messages enable row level security;
create policy "Messages visible to authenticated" on public.messages for select using (auth.role() = 'authenticated');
create policy "Messages insertable by authenticated" on public.messages for insert with check (auth.role() = 'authenticated');
create policy "Messages updatable by author" on public.messages for update using (auth.uid() = author_id);
create policy "Messages deletable by author" on public.messages for delete using (auth.uid() = author_id);

-- 6. Message Comments
create table public.message_comments (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table public.message_comments enable row level security;
create policy "Comments visible to authenticated" on public.message_comments for select using (auth.role() = 'authenticated');
create policy "Comments insertable by authenticated" on public.message_comments for insert with check (auth.role() = 'authenticated');

-- 7. To-do Lists
create table public.todo_lists (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);

alter table public.todo_lists enable row level security;
create policy "Todo lists visible to authenticated" on public.todo_lists for select using (auth.role() = 'authenticated');
create policy "Todo lists insertable by authenticated" on public.todo_lists for insert with check (auth.role() = 'authenticated');
create policy "Todo lists updatable by authenticated" on public.todo_lists for update using (auth.role() = 'authenticated');
create policy "Todo lists deletable by authenticated" on public.todo_lists for delete using (auth.role() = 'authenticated');

-- 8. To-dos
create table public.todos (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.todo_lists(id) on delete cascade not null,
  title text not null,
  completed boolean default false,
  assigned_to uuid references public.profiles(id),
  due_date date,
  position int default 0,
  created_at timestamptz default now()
);

alter table public.todos enable row level security;
create policy "Todos visible to authenticated" on public.todos for select using (auth.role() = 'authenticated');
create policy "Todos insertable by authenticated" on public.todos for insert with check (auth.role() = 'authenticated');
create policy "Todos updatable by authenticated" on public.todos for update using (auth.role() = 'authenticated');
create policy "Todos deletable by authenticated" on public.todos for delete using (auth.role() = 'authenticated');

-- 9. Schedule Events
create table public.events (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text default '',
  event_date date not null,
  event_time time,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.events enable row level security;
create policy "Events visible to authenticated" on public.events for select using (auth.role() = 'authenticated');
create policy "Events insertable by authenticated" on public.events for insert with check (auth.role() = 'authenticated');
create policy "Events updatable by authenticated" on public.events for update using (auth.role() = 'authenticated');
create policy "Events deletable by authenticated" on public.events for delete using (auth.role() = 'authenticated');

-- 10. Chat Messages (Campfire)
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Chat visible to authenticated" on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "Chat insertable by authenticated" on public.chat_messages for insert with check (auth.role() = 'authenticated');

-- 11. Check-ins
create table public.checkins (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  question text not null,
  frequency text default 'daily' check (frequency in ('daily', 'weekly', 'monthly')),
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.checkins enable row level security;
create policy "Checkins visible to authenticated" on public.checkins for select using (auth.role() = 'authenticated');
create policy "Checkins insertable by authenticated" on public.checkins for insert with check (auth.role() = 'authenticated');
create policy "Checkins updatable by authenticated" on public.checkins for update using (auth.role() = 'authenticated');

-- 12. Check-in Responses
create table public.checkin_responses (
  id uuid default gen_random_uuid() primary key,
  checkin_id uuid references public.checkins(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table public.checkin_responses enable row level security;
create policy "Checkin responses visible to authenticated" on public.checkin_responses for select using (auth.role() = 'authenticated');
create policy "Checkin responses insertable by authenticated" on public.checkin_responses for insert with check (auth.role() = 'authenticated');

-- 13. Existing tables for Sales pipeline sync
create table if not exists public.prospects_state (
  id text primary key,
  stage int,
  notes text,
  research_done boolean,
  outreach_written boolean,
  spoken_to boolean,
  meeting_booked boolean,
  meeting_date text,
  updated_at timestamptz default now()
);

alter table public.prospects_state enable row level security;
create policy "Prospects state visible to authenticated" on public.prospects_state for select using (auth.role() = 'authenticated');
create policy "Prospects state upsertable by authenticated" on public.prospects_state for insert with check (auth.role() = 'authenticated');
create policy "Prospects state updatable by authenticated" on public.prospects_state for update using (auth.role() = 'authenticated');

create table if not exists public.candidates_state (
  id text primary key,
  status text,
  email_sent boolean,
  notes text,
  updated_at timestamptz default now()
);

alter table public.candidates_state enable row level security;
create policy "Candidates state visible to authenticated" on public.candidates_state for select using (auth.role() = 'authenticated');
create policy "Candidates state upsertable by authenticated" on public.candidates_state for insert with check (auth.role() = 'authenticated');
create policy "Candidates state updatable by authenticated" on public.candidates_state for update using (auth.role() = 'authenticated');

create table if not exists public.added_prospects (
  id text primary key,
  data jsonb,
  created_at timestamptz default now()
);

alter table public.added_prospects enable row level security;
create policy "Added prospects visible to authenticated" on public.added_prospects for select using (auth.role() = 'authenticated');
create policy "Added prospects upsertable by authenticated" on public.added_prospects for insert with check (auth.role() = 'authenticated');

-- Enable realtime for chat
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.leads;
