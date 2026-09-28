-- N5.2 local foundation. Do not apply to QA until explicit authorization.
-- Proposals are evidence, never authoritative financial records.
create table if not exists public.expense_capture_extractions (
  id uuid primary key default gen_random_uuid(),
  capture_document_id uuid not null references public.expense_capture_documents(id) on delete restrict,
  capture_session_id uuid not null references public.expense_capture_sessions(id) on delete restrict,
  schema_version integer not null check (schema_version > 0),
  attempt integer not null check (attempt > 0),
  status text not null check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  provider text not null,
  provider_version text not null,
  model text,
  idempotency_key text not null,
  proposal jsonb,
  raw_text text,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message_safe text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capture_document_id, schema_version, provider, attempt),
  unique (idempotency_key)
);

create index if not exists expense_capture_extractions_owner_idx on public.expense_capture_extractions (created_by, updated_at desc);
create index if not exists expense_capture_extractions_document_idx on public.expense_capture_extractions (capture_document_id, attempt desc);

alter table public.expense_capture_extractions enable row level security;
alter table public.expense_capture_extractions force row level security;
revoke all on public.expense_capture_extractions from public, anon, authenticated, service_role;
grant select on public.expense_capture_extractions to authenticated;
grant select, insert, update, delete on public.expense_capture_extractions to service_role;

drop policy if exists n52_extractions_owner_read on public.expense_capture_extractions;
create policy n52_extractions_owner_read on public.expense_capture_extractions for select to authenticated using (
  created_by = (select auth.uid())
  and exists (select 1 from public.expense_capture_sessions s where s.id = capture_session_id and s.created_by = (select auth.uid()))
);
