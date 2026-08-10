-- VisionInspect — migration 003: self-service sign-up + default admin account
--
-- Run this in Supabase SQL Editor against a database that has already run migration
-- 002 (or supabase-schema.sql, which now includes this change directly). Idempotent
-- like the other migrations, safe to re-run.
--
-- What changed in the app:
--   - /signup is now a public page (src/app/signup) where anyone can create their own
--     account via supabase.auth.signUp(). Previously (migration 002) accounts were
--     admin-provisioned only, with no sign-up form.
--   - Because sign-up is now open to anyone, this migration updates
--     public.handle_new_user() so the single well-known admin address
--     (admin@visioninspect.com) is automatically given role = 'admin' the moment that
--     exact account is created, while every other email still gets the default
--     'reviewer' role, same as before. This is a one-off allowlist of exactly one
--     address, not a general privilege-escalation path — the sign-up form has no role
--     field, so nobody can request admin for themselves.
--
-- What this script does:
--   1. Replaces handle_new_user() with the email-aware version described above.
--   2. Backfills role = 'admin' for admin@visioninspect.com if that profile row
--      already existed (e.g. was created as a plain reviewer before this migration
--      ran, or was provisioned manually before sign-up was self-service).
--
-- TO CREATE THE DEFAULT ADMIN ACCOUNT: sign up once through the app's /signup page
-- with email admin@visioninspect.com and password 123456 — the trigger below takes
-- care of the role, no manual SQL needed. Change that password after first sign-in
-- (Supabase Dashboard -> Authentication -> Users), since it's a well-known default,
-- not a secret.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'admin@visioninspect.com' then 'admin' else 'reviewer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill: promote the default admin account if its profile row already exists from
-- before this migration ran (e.g. it signed up back when everyone defaulted to
-- 'reviewer', or was created manually).
update public.profiles
set role = 'admin'
where lower(email) = 'admin@visioninspect.com' and role <> 'admin';

-- Done.
