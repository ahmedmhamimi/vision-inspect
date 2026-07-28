-- VisionInspect — migration 001: add full-image storage to inspection_records
--
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New query) against an
-- EXISTING database that was already set up with supabase-schema.sql. It is additive
-- and safe to run on a database that already has data in it — every statement is
-- idempotent (IF NOT EXISTS / IF EXISTS guards), so re-running this script is harmless.
--
-- What this does:
--   1. Adds `image_data` (bytea) and `mime_type` (text) columns to inspection_records,
--      so the original uploaded image is persisted alongside its inspection instead of
--      being thrown away after the analyze step. Existing rows get NULL for both —
--      the app already treats a missing image as "no image on file for this older
--      record" and displays it that way in the Info panel.
--   2. Fixes inspection_reports.image_id to actually cascade on delete. The adapter
--      code has always assumed this cascade exists (see the comment in
--      supabase-storage.adapter.ts deleteRecord()), but the original schema never
--      declared it — this migration makes the schema match that assumption.
--
-- If you are setting this project up for the FIRST time, just run supabase-schema.sql
-- instead — it already includes everything in this file. Only run this migration if
-- inspection_records already exists in your project.

-- 1. New columns for image storage.
alter table inspection_records
  add column if not exists image_data bytea;

alter table inspection_records
  add column if not exists mime_type text;

-- Constrain mime_type to the three formats the app validates against (validation.ts).
-- Dropped first so re-running this script doesn't error on a duplicate constraint name.
alter table inspection_records
  drop constraint if exists inspection_records_mime_type_check;

alter table inspection_records
  add constraint inspection_records_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp'));

-- 2. Make inspection_reports.image_id cascade on delete, so deleteRecord() deleting an
-- inspection_records row also removes its associated report, with no separate delete
-- statement required against inspection_reports.
alter table inspection_reports
  drop constraint if exists inspection_reports_image_id_fkey;

alter table inspection_reports
  add constraint inspection_reports_image_id_fkey
  foreign key (image_id) references inspection_records (image_id) on delete cascade;

-- Done. Existing rows are untouched apart from the two new NULL columns; new
-- inspections going forward will populate image_data and mime_type automatically.
