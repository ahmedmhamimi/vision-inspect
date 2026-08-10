-- VisionInspect — migration 002: authentication + admin dashboard
--
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New query) against an
-- EXISTING database that already has inspection_records / inspection_reports (i.e. you
-- already ran supabase-schema.sql, optionally followed by 001_add_image_storage.sql).
-- Every statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS guards),
-- so re-running this script is harmless.
--
-- If you are setting this project up for the FIRST time, just run supabase-schema.sql
-- instead — it already includes everything in this file.
--
-- What this does:
--   1. Creates public.profiles, a 1:1 row per Supabase Auth user, holding the app-level
--      `role` ('admin' | 'reviewer') that the admin dashboard gates on. Auth itself
--      (passwords, sessions, email verification) is entirely handled by Supabase's
--      built-in auth.users table — this migration never touches that table's schema,
--      only reads its id via trigger and foreign key.
--   2. Adds a trigger that auto-creates a profiles row (defaulting to role 'reviewer')
--      whenever a new user signs up, so no application code has to remember to do it.
--   3. Adds `created_by` to inspection_records, so the admin dashboard can show who
--      submitted each inspection. Nullable and additive, same pattern as
--      001_add_image_storage.sql — existing rows get NULL, nothing already stored is
--      touched.
--   4. Enables RLS on profiles with a single "select your own row" policy. This app's
--      inspection data (inspection_records/inspection_reports) is read/written only via
--      the service_role key from the server (see SupabaseStorageAdapter) and does not
--      depend on RLS for its access control; profiles is the one table a browser-issued,
--      user-scoped Supabase client (the anon key, via lib/auth/supabase-server.ts) reads
--      directly, so it is the one table where RLS is the actual enforcement mechanism.
--
-- AFTER RUNNING THIS: create your first admin. Sign up a user through the app's /login
-- flow (or Supabase Dashboard -> Authentication -> Users -> Add user), then run:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- NOTE: if you are setting this project up fresh, prefer supabase-schema.sql instead —
-- it already includes the self-service sign-up + default-admin trigger from
-- migrations/003_self_service_signup_and_default_admin.sql. If you already ran this
-- file 002 against an existing database, also run 003 on top of it to pick that up.

-- 1. profiles table.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'reviewer' check (role in ('admin', 'reviewer')),
  created_at timestamptz not null default now()
);

-- 2. Auto-provision a profile row for every new auth user. security definer so it can
-- insert into public.profiles regardless of the RLS policy below (the trigger runs as
-- the function owner, not as the newly-created user, who has no rows yet to satisfy
-- "select your own row" against).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'reviewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. created_by on inspection_records.
alter table inspection_records
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create index if not exists inspection_records_created_by_idx
  on inspection_records (created_by);

-- 4. Row Level Security on profiles: every signed-in user may read their own row (and
-- only their own row) — this is what lib/auth/session.ts's getCurrentProfile() and the
-- admin-role check in app/admin/layout.tsx rely on. No insert/update/delete policy is
-- granted to regular users: profiles are created only by the trigger above (security
-- definer, bypasses RLS) and role changes are an admin/operator action performed
-- directly in the SQL editor or via the service_role key, never from client code.
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (id = auth.uid());

-- Done.
