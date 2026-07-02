begin;

-- Sprint closure 2026-07-02
-- This script intentionally covers only the minimal schema reconciliation
-- already validated as safe for the main app:
-- - public.properties.status
-- - public.properties.archived_at
-- - public.properties.deleted_at
-- - public.invoices.property_id
--
-- Recurrent invoices are excluded on purpose until their preflight is
-- confirmed in the real database. See docs/FULL_APP_DB_SCHEMA_AUDIT.md.

alter table public.properties
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

update public.properties
set status = 'active'
where status is null;

alter table public.invoices
  add column if not exists property_id text references public.properties(id) on delete set null;

commit;
