-- Supabase schema: users table + RLS policies + example people RLS
-- Run this in the Supabase SQL editor (SQL Editor -> New Query) or via psql.

-- Ensure pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- 1) users table to map auth users -> app profile + role
create table if not exists public.users (
	id uuid primary key default gen_random_uuid(),
	auth_id uuid unique,
	email text not null unique,
	name text not null,
	phone text unique,
	role text not null default 'visitor' check (role in ('owner','editor','viewer','visitor')),
	created_at timestamptz default timezone('utc'::text, now())
);

-- 2) Enable RLS on users table
alter table public.users enable row level security;

-- Role cache table to avoid recursive policy evaluation
-- This table is maintained by a SECURITY DEFINER trigger on public.users so
-- policy evaluation does not need to read public.users directly (which caused recursion).
create table if not exists public.user_roles_cache (
  auth_id uuid primary key,
  role text,
  name text
);

-- Trigger/function to keep cache in sync with public.users after inserts/updates
-- Ensure any existing trigger is removed before dropping the function it depends on
drop trigger if exists sync_user_roles_cache on public.users;

drop function if exists public.sync_user_roles_cache();
create function public.sync_user_roles_cache() returns trigger as $$
begin
  insert into public.user_roles_cache (auth_id, role, name)
    values (new.auth_id, new.role, new.name)
    on conflict (auth_id) do update set role = excluded.role, name = excluded.name;
  return new;
end;
$$ language plpgsql security definer;

create trigger sync_user_roles_cache
  after insert or update on public.users
  for each row
  execute procedure public.sync_user_roles_cache();

-- Helper functions read from the cache (no recursion)
create or replace function public.get_current_user_role() returns text as $$
  select role from public.user_roles_cache where auth_id = auth.uid() limit 1;
$$ language sql security definer; 

grant execute on function public.get_current_user_role() to authenticated;

create or replace function public.get_current_user_name() returns text as $$
  select name from public.user_roles_cache where auth_id = auth.uid() limit 1;
$$ language sql security definer;

grant execute on function public.get_current_user_name() to authenticated;

-- Owner (auth user who has role = 'owner') gets full access on users table
drop policy if exists users_owner_full_access on public.users;
create policy users_owner_full_access on public.users
	for all
	using (public.get_current_user_role() = 'owner')
	with check (public.get_current_user_role() = 'owner');

-- Allow each authenticated user to select/insert/update their own users row
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
	for select
	using (auth_id = auth.uid());

drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users
	for insert
	with check (auth_id = auth.uid());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
	for update
	using (auth_id = auth.uid())
	with check (auth_id = auth.uid());

-- 3) people table: enable RLS and add role-based policies
-- Note: this assumes you already have a public.people table used by the app.
alter table if exists public.people enable row level security;

-- Owner: full access to people
-- Use helper function to avoid recursive policy evaluation
drop policy if exists people_owner_full on public.people;
create policy people_owner_full on public.people
	for all
	using (public.get_current_user_role() = 'owner')
	with check (public.get_current_user_role() = 'owner');

-- Editor: allow select/insert/update/delete on people
drop policy if exists people_editor_access on public.people;
create policy people_editor_access on public.people
	for all
	using (
		public.get_current_user_role() in ('editor','owner')
	)
	with check (
		public.get_current_user_role() in ('editor','owner')
	);

-- Viewer: allow SELECT only for rows where people.name matches the viewer's name
-- Uses helper functions to avoid recursive policy evaluation
drop policy if exists people_viewer_select_own_name on public.people;
create policy people_viewer_select_own_name on public.people
	for select
	using (
		( public.get_current_user_role() = 'viewer' AND public.people.name = public.get_current_user_name() )
		OR public.get_current_user_role() = 'owner'
	);

-- Visitors: no access (no policy needed, RLS denies by default)

-- 4) Optional: automatically create a users row when an auth user is created
-- (Uncomment to enable). This creates a users record with role 'visitor' and name=email by default.
-- Note: enabling triggers on the auth schema may require additional privileges.
--
-- create function public.handle_auth_user_insert() returns trigger as $$
-- begin
--   insert into public.users (auth_id, email, name, role)
--   values (new.id, new.email, new.email, 'visitor')
--   on conflict (auth_id) do nothing;
--   return new;
-- end;
-- $$ language plpgsql security definer;
--
-- create trigger on auth.users
--   after insert
--   execute procedure public.handle_auth_user_insert();

-- Add phone column to existing users if missing and enforce uniqueness
alter table if exists public.users add column if not exists phone text;
create unique index if not exists users_phone_unique on public.users (phone);

-- 4) RPC to claim or create a users row for the current authenticated user
-- This is useful when older records exist without auth_id, or when we need to create the users row
-- after the user completes sign-up/login. The function runs as SECURITY DEFINER so that it can
-- safely set auth_id and role without being blocked by RLS on the target row (the function owner
-- needs to be a privileged DB role, which is the case when applied via Supabase SQL editor).
create or replace function public.claim_or_create_user(p_email text, p_name text, p_phone text default null)
returns setof public.users as $$
begin
  insert into public.users (auth_id, email, name, phone, role)
  values (auth.uid(), p_email, p_name, p_phone, case when p_name = '负责人' then 'owner' else 'visitor' end)
  on conflict (email) do update
    set auth_id = coalesce(public.users.auth_id, auth.uid()),
        name = coalesce(public.users.name, p_name),
        phone = coalesce(public.users.phone, p_phone),
        role = case when public.users.name = '负责人' or p_name = '负责人' then 'owner' else public.users.role end;

  return query select * from public.users where email = p_email;
end;
$$ language plpgsql security definer;

grant execute on function public.claim_or_create_user(text, text) to authenticated;

-- Add platform mapping JSONB columns for external platform synchronization
alter table if exists public.courses add column if not exists platform_meta jsonb;
alter table if exists public.sessions add column if not exists platform_meta jsonb;

-- Add attending student IDs on courses and sessions (UUID array)
alter table if exists public.courses add column if not exists attending_student_ids uuid[] default '{}';
alter table if exists public.sessions add column if not exists attending_student_ids uuid[] default '{}';

-- Students table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  dob date,
  junior_primary text,
  junior_high text,
  senior_high text,
  primary_coach_ids uuid[] default '{}',
  undergraduate text,
  undergraduate_plan text,
  research_direction text,
  graduate_unit text,
  employment text,
  awards text,
  highest_award text,
  learning_goals text,
  meeting_phone text,
  participating_training uuid[] default '{}',
  total_payments numeric default 0,
  rewards text,
  phone text,
  mother_name text,
  mother_phone text,
  father_name text,
  father_phone text,
  address text,
  mailing_address text,
  notes text
);

create unique index if not exists students_phone_unique on public.students (phone);

-- Clients table
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  dob date,
  phone text,
  demand_records text,
  contact_history text,
  unit text,
  school_id uuid,
  position text,
  past_units text[],
  current_teaching_school text,
  current_teaching_position text,
  cohorts text,
  student_ids uuid[] default '{}',
  projects text,
  revenue_total numeric default 0,
  rebate_total numeric default 0,
  remit_method text,
  senior_high text,
  undergraduate text,
  admission_plan text,
  master_unit text,
  phd_unit text,
  postdoc_unit text,
  research_direction text,
  family_info text,
  hobbies text,
  address text,
  mailing_address text,
  social_media text,
  notes text
);

create index if not exists clients_school_idx on public.clients (school_id);
create unique index if not exists clients_phone_unique on public.clients (phone);

-- Schools table
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  country text,
  province text,
  city text,
  full_name text,
  short_name text,
  type text,
  contact_person text,
  contact_phone text,
  demand_records text,
  contact_history text,
  projects text,
  revenue_total numeric default 0,
  rebate_total numeric default 0,
  teacher_ids uuid[] default '{}',
  student_ids uuid[] default '{}',
  former_leaders text,
  senior_high_admission text,
  olympiad_awards text,
  university_ratings text,
  official_homepage text,
  notes text
);

create unique index if not exists schools_shortname_unique on public.schools (short_name);

-- Enable RLS on new tables
alter table if exists public.students enable row level security;
alter table if exists public.clients enable row level security;
alter table if exists public.schools enable row level security;

-- Owner & Editor access policies (reuse helper functions)
drop policy if exists students_owner_full on public.students;
create policy students_owner_full on public.students
  for all
  using (public.get_current_user_role() = 'owner')
  with check (public.get_current_user_role() = 'owner');

drop policy if exists students_editor_access on public.students;
create policy students_editor_access on public.students
  for all
  using (public.get_current_user_role() in ('editor','owner'))
  with check (public.get_current_user_role() in ('editor','owner'));

drop policy if exists students_viewer_select_own on public.students;
create policy students_viewer_select_own on public.students
  for select
  using ((public.get_current_user_role() = 'viewer' AND public.students.name = public.get_current_user_name()) OR public.get_current_user_role() = 'owner');

drop policy if exists clients_owner_full on public.clients;
create policy clients_owner_full on public.clients
  for all
  using (public.get_current_user_role() = 'owner')
  with check (public.get_current_user_role() = 'owner');

drop policy if exists clients_editor_access on public.clients;
create policy clients_editor_access on public.clients
  for all
  using (public.get_current_user_role() in ('editor','owner'))
  with check (public.get_current_user_role() in ('editor','owner'));

drop policy if exists clients_viewer_select_own on public.clients;
create policy clients_viewer_select_own on public.clients
  for select
  using ((public.get_current_user_role() = 'viewer' AND public.clients.name = public.get_current_user_name()) OR public.get_current_user_role() = 'owner');

drop policy if exists schools_owner_full on public.schools;
create policy schools_owner_full on public.schools
  for all
  using (public.get_current_user_role() = 'owner')
  with check (public.get_current_user_role() = 'owner');

drop policy if exists schools_editor_access on public.schools;
create policy schools_editor_access on public.schools
  for all
  using (public.get_current_user_role() in ('editor','owner'))
  with check (public.get_current_user_role() in ('editor','owner'));

drop policy if exists schools_viewer_select_own on public.schools;
create policy schools_viewer_select_own on public.schools
  for select
  using (public.get_current_user_role() = 'owner');

-- End of supabase schema
