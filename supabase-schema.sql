-- VisionInspect — Supabase schema
-- Mirrors InspectionRecordSchema and InspectionReportSchema from src/lib/visioninspect/schema.ts
-- Run this whole block once in Supabase SQL Editor (Project -> SQL Editor -> New query).

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
  reviewer_note       text
);

create index if not exists inspection_records_created_at_idx
  on inspection_records (created_at desc);

create table if not exists inspection_reports (
  report_id             uuid primary key,
  image_id              uuid not null references inspection_records (image_id),
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
