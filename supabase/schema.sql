-- PRIME cloud schema
-- Run this once in the Supabase SQL editor of a (new) Supabase project.
-- Afterwards, fill in the project URL + anon key in js/cloud.js.

-- ========== PROFILES ==========
-- One row per login (auth.users), coach or client, plus a display name
-- shown in the coach's client picker.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('coach','client')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- ========== is_coach() helper ==========
-- security definer so it can read `profiles` regardless of the caller's
-- own RLS visibility (avoids recursive policy checks on profiles itself).
create or replace function is_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'coach'
  );
$$;

-- ========== PROFILES policies ==========
-- Everyone can read/update their own profile row.
create policy "profiles: read own" on profiles
  for select using (id = auth.uid());

create policy "profiles: update own" on profiles
  for update using (id = auth.uid());

-- Coach can read and rename every profile (for the client picker /
-- display-name editing described in the plan). Coach cannot create
-- new logins from the client (that needs the service_role key, done
-- via the Supabase dashboard instead - see README note below).
create policy "profiles: coach reads all" on profiles
  for select using (is_coach());

create policy "profiles: coach updates all" on profiles
  for update using (is_coach());

-- ========== auto-create profile on signup ==========
-- Whenever the coach adds a new login in the Supabase dashboard
-- (Authentication -> Add user), this trigger creates the matching
-- `profiles` row automatically, defaulting to role 'client'.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ========== CLIENT_STATE ==========
-- One row per prime_* localStorage key per client - mirrors the app's
-- existing storage keys 1:1 (see js/state.js): prime_profile,
-- prime_history, prime_today, prime_exdone, prime_planning,
-- prime_wp_done, prime_weekplan, prime_programmas.
create table if not exists client_state (
  client_id uuid not null references profiles(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, key)
);

alter table client_state enable row level security;

create policy "client_state: own rows" on client_state
  for select using (client_id = auth.uid());

create policy "client_state: insert own rows" on client_state
  for insert with check (client_id = auth.uid());

create policy "client_state: update own rows" on client_state
  for update using (client_id = auth.uid());

create policy "client_state: coach reads all" on client_state
  for select using (is_coach());

create policy "client_state: coach writes all" on client_state
  for insert with check (is_coach());

create policy "client_state: coach updates all" on client_state
  for update using (is_coach());

-- ========== Making the first coach account ==========
-- 1. Create the coach's login in Supabase dashboard: Authentication ->
--    Add user (real email + password). The trigger above creates a
--    matching `profiles` row with role 'client' by default.
-- 2. Promote it to coach by running once, with the real user id from
--    Authentication -> Users (copy the UUID):
--
--    update profiles set role = 'coach', display_name = 'Coach'
--    where id = '<paste-uuid-here>';
