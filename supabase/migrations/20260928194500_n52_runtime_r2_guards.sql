-- N5.2 R2 runtime guards. QA-only deployment is required after applying this migration.
begin;

create or replace function public.require_n52_active_internal_staff()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
begin
  return app_private.require_active_internal_staff();
end;
$$;
alter function public.require_n52_active_internal_staff() owner to postgres;
revoke all on function public.require_n52_active_internal_staff() from public, anon, authenticated, service_role;
grant execute on function public.require_n52_active_internal_staff() to authenticated;

create or replace function public.n52_prepare_extraction(
  p_capture_document_id uuid,
  p_mode text,
  p_schema_version integer,
  p_provider text,
  p_provider_version text
) returns table (
  action text,
  extraction_id uuid,
  capture_session_id uuid,
  created_by uuid,
  attempt integer,
  status text,
  idempotency_key text,
  storage_path text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  sha256 text
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.expense_capture_documents;
  v_session public.expense_capture_sessions;
  v_latest public.expense_capture_extractions;
  v_id uuid;
  v_attempt integer;
  v_key text;
begin
  if v_user_id is null or not app_private.is_active_internal_staff(v_user_id) then
    raise exception 'n52_active_internal_staff_required' using errcode = '42501';
  end if;
  if p_mode not in ('extract', 'retry') or p_schema_version <> 1
     or p_provider <> 'fixture' or p_provider_version <> 'n5.2-fixture-v1' then
    raise exception 'n52_runtime_contract_invalid' using errcode = '22023';
  end if;

  select d.* into v_document
    from public.expense_capture_documents d
   where d.id = p_capture_document_id;
  select s.* into v_session
    from public.expense_capture_sessions s
   where s.id = v_document.capture_session_id
   for update;
  if not found or v_session.created_by <> v_user_id
     or v_session.expires_at <= now()
     or v_session.status in ('CANCELLED', 'COMPLETED', 'FINALIZING') then
    raise exception 'n52_capture_document_not_found' using errcode = 'P0002';
  end if;

  select e.* into v_latest
    from public.expense_capture_extractions e
   where e.capture_document_id = v_document.id
     and e.schema_version = p_schema_version
     and e.provider = p_provider
   order by e.attempt desc
   limit 1
   for update;

  if found then
    if p_mode = 'extract' then
      return query select 'EXISTING'::text, v_latest.id, v_latest.capture_session_id,
        v_latest.created_by, v_latest.attempt, v_latest.status, v_latest.idempotency_key,
        v_document.storage_path, v_document.original_filename, v_document.mime_type,
        v_document.file_size_bytes, v_document.sha256;
      return;
    end if;
    if v_latest.status <> 'FAILED' then
      return query select 'RETRY_NOT_ELIGIBLE'::text, v_latest.id, v_latest.capture_session_id,
        v_latest.created_by, v_latest.attempt, v_latest.status, v_latest.idempotency_key,
        v_document.storage_path, v_document.original_filename, v_document.mime_type,
        v_document.file_size_bytes, v_document.sha256;
      return;
    end if;
    v_attempt := v_latest.attempt + 1;
  else
    if p_mode = 'retry' then
      raise exception 'n52_retry_requires_failed_attempt' using errcode = '22023';
    end if;
    v_attempt := 1;
  end if;

  v_key := v_document.sha256 || ':' || p_schema_version::text || ':' || p_provider || ':' || v_attempt::text;
  insert into public.expense_capture_extractions(
    capture_document_id, capture_session_id, schema_version, attempt, status,
    provider, provider_version, model, idempotency_key, proposal, raw_text,
    started_at, completed_at, failed_at, error_code, error_message_safe,
    created_by, updated_at
  ) values (
    v_document.id, v_session.id, p_schema_version, v_attempt, 'PENDING',
    p_provider, p_provider_version, null, v_key, null, null,
    null, null, null, null, null, v_user_id, now()
  ) returning id into v_id;

  return query select case when p_mode = 'retry' then 'RETRY_CREATED' else 'CREATED' end,
    v_id, v_session.id, v_user_id, v_attempt, 'PENDING'::text, v_key,
    v_document.storage_path, v_document.original_filename, v_document.mime_type,
    v_document.file_size_bytes, v_document.sha256;
end;
$$;
alter function public.n52_prepare_extraction(uuid, text, integer, text, text) owner to postgres;
revoke all on function public.n52_prepare_extraction(uuid, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.n52_prepare_extraction(uuid, text, integer, text, text) to service_role;

create or replace function public.n52_claim_extraction(p_extraction_id uuid)
returns table (claimed boolean, status text)
language sql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
  update public.expense_capture_extractions
     set status = 'PROCESSING', started_at = coalesce(started_at, now()), updated_at = now()
   where id = p_extraction_id and status = 'PENDING'
  returning true, status;
$$;
alter function public.n52_claim_extraction(uuid) owner to postgres;
revoke all on function public.n52_claim_extraction(uuid) from public, anon, authenticated, service_role;
grant execute on function public.n52_claim_extraction(uuid) to service_role;

commit;
