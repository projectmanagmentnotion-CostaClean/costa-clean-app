-- N5.3 local normalization runtime foundation. Create locally only; do not apply
-- to QA or Production without the explicit N5.3 mutation gate.
begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.expense_capture_normalizations (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references public.expense_capture_extractions(id) on delete restrict,
  schema_version integer not null check (schema_version > 0),
  normalizer_version text not null check (char_length(trim(normalizer_version)) between 1 and 128),
  normalization_key text not null check (normalization_key ~ '^[0-9a-f]{64}$'),
  attempt_number integer not null check (attempt_number > 0),
  attempt_key text not null check (attempt_key ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('PROCESSING', 'SUCCEEDED', 'FAILED')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  normalized_proposal jsonb,
  output_hash text check (output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  review_status text check (review_status is null or review_status in ('READY_FOR_REVIEW', 'NEEDS_ATTENTION', 'BLOCKED')),
  reconciliation_status text check (reconciliation_status is null or reconciliation_status in ('MATCH', 'MISMATCH', 'INSUFFICIENT_DATA', 'COMPLEX_ADJUSTMENT')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message_safe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalization_key, attempt_number),
  unique (attempt_key),
  check (
    (status = 'PROCESSING' and normalized_proposal is null and output_hash is null and review_status is null and reconciliation_status is null and completed_at is null and failed_at is null and error_code is null)
    or (status = 'SUCCEEDED' and normalized_proposal is not null and output_hash is not null and review_status is not null and reconciliation_status is not null and completed_at is not null and failed_at is null and error_code is null)
    or (status = 'FAILED' and normalized_proposal is null and output_hash is null and review_status is null and reconciliation_status is null and completed_at is null and failed_at is not null and error_code is not null)
  )
);

create index if not exists expense_capture_normalizations_extraction_idx
  on public.expense_capture_normalizations (extraction_id, attempt_number desc);

create unique index if not exists expense_capture_normalizations_active_key_idx
  on public.expense_capture_normalizations (normalization_key)
  where status in ('PROCESSING', 'SUCCEEDED');

alter table public.expense_capture_normalizations enable row level security;
alter table public.expense_capture_normalizations force row level security;

revoke all on public.expense_capture_normalizations from public, anon, authenticated, service_role;
grant select on public.expense_capture_normalizations to authenticated;
grant select, insert, update on public.expense_capture_normalizations to service_role;

drop policy if exists n53_normalizations_owner_read on public.expense_capture_normalizations;
create policy n53_normalizations_owner_read
  on public.expense_capture_normalizations
  for select to authenticated
  using (
    exists (
      select 1
      from public.expense_capture_extractions e
      join public.expense_capture_sessions s on s.id = e.capture_session_id and s.created_by = e.created_by
      where e.id = expense_capture_normalizations.extraction_id
        and e.created_by = (select auth.uid())
        and app_private.is_active_internal_staff((select auth.uid()))
    )
  );

create or replace function public.n53_claim_normalization(
  p_extraction_id uuid,
  p_authenticated_user_id uuid,
  p_schema_version integer,
  p_normalizer_version text,
  p_input_hash text,
  p_normalization_key text
) returns table (
  action text,
  id uuid,
  extraction_id uuid,
  attempt_number integer,
  status text,
  schema_version integer,
  normalizer_version text,
  normalization_key text,
  input_hash text,
  normalized_proposal jsonb,
  output_hash text,
  review_status text,
  reconciliation_status text
)
language plpgsql security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_extraction public.expense_capture_extractions;
  v_row public.expense_capture_normalizations;
  v_attempt integer;
  v_now timestamptz := now();
begin
  if p_authenticated_user_id is null
     or p_schema_version <= 0
     or p_normalizer_version is null
     or p_input_hash !~ '^[0-9a-f]{64}$'
     or p_normalization_key !~ '^[0-9a-f]{64}$' then
    raise exception 'n53_claim_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = p_authenticated_user_id and m.status = 'active' and m.revoked_at is null
  ) then
    raise exception 'n53_extraction_not_found' using errcode = 'P0002';
  end if;

  select e.* into v_extraction
  from public.expense_capture_extractions e
  where e.id = p_extraction_id
  for update;
  if not found or v_extraction.created_by <> p_authenticated_user_id
     or v_extraction.status <> 'SUCCEEDED' or v_extraction.proposal is null then
    raise exception 'n53_extraction_not_found' using errcode = 'P0002';
  end if;
  if encode(extensions.digest(convert_to('n53|' || p_extraction_id::text || '|' || p_schema_version::text || '|' || p_normalizer_version || '|' || p_input_hash, 'UTF8'), 'sha256'), 'hex') <> p_normalization_key then
    raise exception 'n53_claim_invalid' using errcode = '22023';
  end if;

  select n.* into v_row
  from public.expense_capture_normalizations n
  where n.normalization_key = p_normalization_key
  order by n.attempt_number desc
  limit 1
  for update;
  if found and v_row.status = 'SUCCEEDED' then
    return query select 'EXISTING_SUCCEEDED'::text, v_row.id, v_row.extraction_id, v_row.attempt_number, v_row.status, v_row.schema_version, v_row.normalizer_version, v_row.normalization_key, v_row.input_hash, v_row.normalized_proposal, v_row.output_hash, v_row.review_status, v_row.reconciliation_status;
    return;
  end if;
  if found and v_row.status = 'PROCESSING' then
    if v_row.started_at > v_now - interval '5 minutes' then
      return query select 'EXISTING_PROCESSING'::text, v_row.id, v_row.extraction_id, v_row.attempt_number, v_row.status, v_row.schema_version, v_row.normalizer_version, v_row.normalization_key, v_row.input_hash, v_row.normalized_proposal, v_row.output_hash, v_row.review_status, v_row.reconciliation_status;
      return;
    end if;
    update public.expense_capture_normalizations
    set status = 'FAILED', failed_at = v_now, error_code = 'NORMALIZATION_STALE_ATTEMPT', error_message_safe = 'El intento de normalización expiró.', updated_at = v_now
    where id = v_row.id;
  end if;

  select coalesce(max(n.attempt_number), 0) + 1 into v_attempt
  from public.expense_capture_normalizations n
  where n.normalization_key = p_normalization_key;

  insert into public.expense_capture_normalizations(
    extraction_id, schema_version, normalizer_version, normalization_key,
    attempt_number, attempt_key, status, input_hash, started_at, updated_at
  ) values (
    p_extraction_id, p_schema_version, p_normalizer_version, p_normalization_key,
    v_attempt, encode(extensions.digest(convert_to(p_normalization_key || '|' || v_attempt::text, 'UTF8'), 'sha256'), 'hex'), 'PROCESSING', p_input_hash, v_now, v_now
  ) returning * into v_row;

  return query select case when v_attempt = 1 then 'CREATED'::text else 'RETRY_CREATED'::text end, v_row.id, v_row.extraction_id, v_row.attempt_number, v_row.status, v_row.schema_version, v_row.normalizer_version, v_row.normalization_key, v_row.input_hash, v_row.normalized_proposal, v_row.output_hash, v_row.review_status, v_row.reconciliation_status;
end;
$$;

create or replace function public.n53_finalize_normalization_success(
  p_normalization_id uuid,
  p_authenticated_user_id uuid,
  p_attempt_number integer,
  p_normalization_key text,
  p_output_hash text,
  p_normalized_proposal jsonb,
  p_review_status text,
  p_reconciliation_status text
) returns table (id uuid, extraction_id uuid, attempt_number integer, status text, schema_version integer, normalizer_version text, normalization_key text, normalized_proposal jsonb, output_hash text, review_status text, reconciliation_status text)
language plpgsql security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare v_row public.expense_capture_normalizations;
begin
  if p_authenticated_user_id is null or p_output_hash !~ '^[0-9a-f]{64}$' or p_normalization_key !~ '^[0-9a-f]{64}$' then raise exception 'n53_finalize_invalid' using errcode = '22023'; end if;
  if not exists (select 1 from public.internal_staff_memberships m where m.user_id = p_authenticated_user_id and m.status = 'active' and m.revoked_at is null) then raise exception 'n53_extraction_not_found' using errcode = 'P0002'; end if;
  select n.* into v_row from public.expense_capture_normalizations n join public.expense_capture_extractions e on e.id = n.extraction_id where n.id = p_normalization_id and n.attempt_number = p_attempt_number and n.normalization_key = p_normalization_key and e.created_by = p_authenticated_user_id for update;
  if not found then raise exception 'n53_extraction_not_found' using errcode = 'P0002'; end if;
  if v_row.status <> 'PROCESSING' then raise exception 'n53_terminal_row' using errcode = '55000'; end if;
  update public.expense_capture_normalizations set status = 'SUCCEEDED', normalized_proposal = p_normalized_proposal, output_hash = p_output_hash, review_status = p_review_status, reconciliation_status = p_reconciliation_status, completed_at = now(), updated_at = now() where id = v_row.id returning * into v_row;
  return query select v_row.id, v_row.extraction_id, v_row.attempt_number, v_row.status, v_row.schema_version, v_row.normalizer_version, v_row.normalization_key, v_row.normalized_proposal, v_row.output_hash, v_row.review_status, v_row.reconciliation_status;
end;
$$;

create or replace function public.n53_finalize_normalization_failure(
  p_normalization_id uuid,
  p_authenticated_user_id uuid,
  p_attempt_number integer,
  p_normalization_key text,
  p_error_code text,
  p_error_message_safe text
) returns table (id uuid, extraction_id uuid, attempt_number integer, status text, error_code text)
language plpgsql security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare v_row public.expense_capture_normalizations;
begin
  if p_authenticated_user_id is null or p_error_code is null or p_normalization_key !~ '^[0-9a-f]{64}$' then raise exception 'n53_finalize_invalid' using errcode = '22023'; end if;
  if not exists (select 1 from public.internal_staff_memberships m where m.user_id = p_authenticated_user_id and m.status = 'active' and m.revoked_at is null) then raise exception 'n53_extraction_not_found' using errcode = 'P0002'; end if;
  select n.* into v_row from public.expense_capture_normalizations n join public.expense_capture_extractions e on e.id = n.extraction_id where n.id = p_normalization_id and n.attempt_number = p_attempt_number and n.normalization_key = p_normalization_key and e.created_by = p_authenticated_user_id for update;
  if not found then raise exception 'n53_extraction_not_found' using errcode = 'P0002'; end if;
  if v_row.status <> 'PROCESSING' then raise exception 'n53_terminal_row' using errcode = '55000'; end if;
  update public.expense_capture_normalizations set status = 'FAILED', failed_at = now(), error_code = p_error_code, error_message_safe = left(p_error_message_safe, 500), updated_at = now() where id = v_row.id returning * into v_row;
  return query select v_row.id, v_row.extraction_id, v_row.attempt_number, v_row.status, v_row.error_code;
end;
$$;

alter function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) owner to postgres;
alter function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) owner to postgres;
alter function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) owner to postgres;
revoke all on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) from public, anon, authenticated, service_role;
revoke all on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) to service_role;

commit;
