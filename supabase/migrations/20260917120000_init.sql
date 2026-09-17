-- Initial schema for pyvex-voice.
--
-- Mirrors what firestore.rules enforced before this project moved to Supabase:
-- every row belongs to exactly one account, a user reaches only their own rows,
-- and nobody can promote themselves. Firestore expressed that in rule
-- predicates; Postgres expresses it in row-level security, column constraints
-- and two triggers.
--
-- The security boundary is RLS. The API's own checks are a second layer, not a
-- substitute: anon-key traffic goes straight to PostgREST and never passes
-- through the Node process at all.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 1 and 150),
  display_name text check (char_length(display_name) <= 100),
  avatar_url text check (char_length(avatar_url) <= 500),
  role text not null default 'engineer' check (role in ('engineer', 'operator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user, created by the on_auth_user_created trigger.';
comment on column public.profiles.role is
  'Application role. Holders cannot change their own; see prevent_self_role_change.';

-- Ids are client-supplied, so they are constrained to the shape the old
-- isValidId() rule allowed rather than trusted.
create table if not exists public.voice_agents (
  id text primary key
    check (char_length(id) between 1 and 128 and id ~ '^[A-Za-z0-9_-]+$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 300),
  transport text check (char_length(transport) <= 50),
  vad text check (char_length(vad) <= 50),
  stt text check (char_length(stt) <= 50),
  llm text not null check (char_length(llm) <= 50),
  tts text not null check (char_length(tts) <= 50),
  flow text check (char_length(flow) <= 50),
  latency_target_ms integer check (latency_target_ms is null or latency_target_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_agents_user_id_idx on public.voice_agents (user_id);

create table if not exists public.call_sessions (
  id text primary key
    check (char_length(id) between 1 and 128 and id ~ '^[A-Za-z0-9_-]+$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id text check (char_length(agent_id) <= 128),
  title text not null check (char_length(title) between 1 and 150),
  status text not null check (status in ('active', 'completed', 'cancelled')),
  duration_sec integer check (duration_sec is null or duration_sec >= 0),
  turn_count integer check (turn_count is null or turn_count >= 0),
  avg_latency_ms integer check (avg_latency_ms is null or avg_latency_ms >= 0),
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_sessions_user_id_created_idx
  on public.call_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace trigger voice_agents_set_updated_at
  before update on public.voice_agents
  for each row execute function public.set_updated_at();

create or replace trigger call_sessions_set_updated_at
  before update on public.call_sessions
  for each row execute function public.set_updated_at();

-- A profile row exists from the moment the account does, so the client never
-- needs permission to create one and a missing profile is never a normal state.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS alone cannot express "this column may not change", so role immutability
-- is a trigger. It constrains end-user requests only: the service role and a
-- direct database connection still administer roles.
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'role is not self-assignable'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_role_immutable
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.voice_agents enable row level security;
alter table public.call_sessions enable row level security;

-- `(select auth.uid())` rather than a bare call: the planner evaluates it once
-- per statement instead of once per row.

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- Insert stays available for a profile the signup trigger could not create.
-- 'admin' is excluded here so a first write cannot arrive already privileged.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id and role in ('engineer', 'operator'));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists voice_agents_select_own on public.voice_agents;
create policy voice_agents_select_own on public.voice_agents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists voice_agents_insert_own on public.voice_agents;
create policy voice_agents_insert_own on public.voice_agents
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- USING screens the existing row and WITH CHECK the new one, so a row cannot
-- be updated into someone else's ownership.
drop policy if exists voice_agents_update_own on public.voice_agents;
create policy voice_agents_update_own on public.voice_agents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists voice_agents_delete_own on public.voice_agents;
create policy voice_agents_delete_own on public.voice_agents
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists call_sessions_select_own on public.call_sessions;
create policy call_sessions_select_own on public.call_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists call_sessions_insert_own on public.call_sessions;
create policy call_sessions_insert_own on public.call_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists call_sessions_update_own on public.call_sessions;
create policy call_sessions_update_own on public.call_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists call_sessions_delete_own on public.call_sessions;
create policy call_sessions_delete_own on public.call_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Granted explicitly rather than left to the project's default privileges: a
-- table with no grant rejects every statement before RLS is ever consulted.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.voice_agents to authenticated;
grant select, insert, update, delete on public.call_sessions to authenticated;

-- anon holds nothing; only a signed-in role reaches these tables.
revoke all on public.profiles from anon;
revoke all on public.voice_agents from anon;
revoke all on public.call_sessions from anon;
