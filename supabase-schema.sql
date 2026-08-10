-- VisionInspect — Supabase schema
-- Mirrors InspectionRecordSchema and InspectionReportSchema from src/lib/visioninspect/schema.ts
-- Run this whole block once in Supabase SQL Editor (Project -> SQL Editor -> New query).
--
-- This file is the FIRST-TIME setup script and already includes everything from
-- migrations/001_add_image_storage.sql and migrations/002_add_authentication.sql. Only
-- use the files under migrations/ if you already have an older database and are
-- upgrading it in place — see the comment at the top of each migration file.

create table if not exists inspection_records (
  image_id            uuid primary key,
  defect_type         text not null check (defect_type in (
                         'surface-scratch','surface-dent','discoloration','crack',
                         'missing-component','misalignment','contamination',
                         'label-defect','dimensional-deviation','no-defect-detected'
                       )),
  visible_evidence    text not null,
  location             text not null,
  severity            text not null check (severity in ('low','medium','high')),
  confidence          numeric not null check (confidence >= 0 and confidence <= 1),
  recommended_action  text not null check (recommended_action in (
                         'accept','flag-for-secondary-review','reject','escalate-to-senior-reviewer'
                       )),
  human_decision      text not null check (human_decision in ('pending','confirmed','corrected')),
  notes               text not null default '',
  taxonomy_reference  text not null,
  degraded            boolean not null default false,
  degraded_reason     text,
  created_at          timestamptz not null,
  confirmed_at        timestamptz,
  reviewer_note       text,
  -- The original uploaded image, stored as genuine binary data (bytea), plus the mime
  -- type needed to render it back client-side (data:<mime_type>;base64,...). Nullable
  -- so rows created before this column existed remain valid.
  image_data          bytea,
  mime_type           text check (mime_type in ('image/jpeg','image/png','image/webp')),
  -- The reviewer who submitted this inspection. Nullable: null means either the record
  -- predates authentication, or auth wasn't configured when it was created. See
  -- migrations/002_add_authentication.sql for the full explanation.
  created_by          uuid references auth.users (id) on delete set null
);

create index if not exists inspection_records_created_by_idx
  on inspection_records (created_by);

create index if not exists inspection_records_created_at_idx
  on inspection_records (created_at desc);

create table if not exists inspection_reports (
  report_id             uuid primary key,
  image_id              uuid not null references inspection_records (image_id) on delete cascade,
  generated_at          timestamptz not null,
  summary               text not null,
  -- Stored as jsonb to mirror the nested object shape of InspectionReport exactly,
  -- so the adapter can read/write these as plain JS objects with no reshaping.
  ai_hypothesis         jsonb not null,
  deterministic_routing jsonb not null,
  human_sign_off        jsonb not null
);

create index if not exists inspection_reports_image_id_idx
  on inspection_reports (image_id);

-- Row Level Security: enabled with NO policies. This app only ever talks to Supabase
-- through the service_role key (server-side only, in SupabaseStorageAdapter), which
-- bypasses RLS entirely. Enabling RLS with no policies means the anon/public key
-- (if it ever leaked or was used client-side) cannot read or write these tables at all.
alter table inspection_records enable row level security;
alter table inspection_reports enable row level security;

-- Authentication & admin dashboard --------------------------------------------------
-- profiles: a 1:1 row per Supabase Auth user, holding the app-level `role` the admin
-- dashboard gates on. See migrations/002_add_authentication.sql for the full narrative
-- comment; kept here in condensed form so a fresh install gets it all in one script.

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'reviewer' check (role in ('admin', 'reviewer')),
  created_at timestamptz not null default now()
);

-- Sign-up is self-service (see app/signup) — anyone can create an account. Every new
-- account defaults to 'reviewer' EXCEPT the single well-known default admin address,
-- which is promoted to 'admin' automatically the moment that specific account is
-- created. This is a one-off allowlist of exactly one address, not a general
-- privilege-escalation path: the sign-up form has no role field at all, so nobody can
-- request admin for themselves — only that exact email qualifies.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (id = auth.uid());

-- AFTER RUNNING THIS SCRIPT: create the default admin account by signing up through the
-- app's own /signup page with email admin@visioninspect.com and password 123456 — the
-- trigger above gives that exact address the 'admin' role automatically, no manual SQL
-- needed. Everyone else who signs up lands as a 'reviewer'. Change the default admin
-- password after first sign-in (Supabase Dashboard -> Authentication -> Users) since
-- it's a well-known default, not a secret.
--
-- To promote a different existing account to admin instead/as well, run:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
