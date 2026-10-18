-- N5.5 local contract only. Apply only through the separately approved QA
-- migration gate; never apply this file outside that approved target.
begin;

create table if not exists public.expense_capture_confirmations (
  id uuid primary key default gen_random_uuid(),
  capture_session_id uuid not null references public.expense_capture_sessions(id) on delete restrict,
  capture_document_id uuid not null references public.expense_capture_documents(id) on delete restrict,
  normalization_id uuid not null references public.expense_capture_normalizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 160),
  duplicate_decision text not null check (duplicate_decision in ('CREATE_NEW', 'USE_EXISTING')),
  duplicate_expense_id uuid references public.expenses(id) on delete restrict,
  expense_id uuid references public.expenses(id) on delete restrict,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (created_by, idempotency_key),
  check ((duplicate_decision = 'CREATE_NEW' and duplicate_expense_id is null) or (duplicate_decision = 'USE_EXISTING' and duplicate_expense_id is not null)),
  check (expense_id is not null or duplicate_decision = 'USE_EXISTING')
);

create index if not exists expense_capture_confirmations_session_idx
  on public.expense_capture_confirmations (capture_session_id, created_at desc);

alter table public.expense_capture_confirmations enable row level security;
alter table public.expense_capture_confirmations force row level security;
revoke all on public.expense_capture_confirmations from public, anon, authenticated, service_role;
grant select on public.expense_capture_confirmations to authenticated;

drop policy if exists n55_confirmations_owner_read on public.expense_capture_confirmations;
create policy n55_confirmations_owner_read
  on public.expense_capture_confirmations
  for select to authenticated
  using (created_by = (select auth.uid()) and app_private.is_active_internal_staff((select auth.uid())));

create or replace function public.confirm_expense_capture(
  p_capture_session_id uuid,
  p_capture_document_id uuid,
  p_normalization_id uuid,
  p_authenticated_user_id uuid,
  p_idempotency_key text,
  p_duplicate_decision text,
  p_duplicate_expense_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_existing public.expense_capture_confirmations;
  v_session public.expense_capture_sessions;
  v_document public.expense_capture_documents;
  v_normalization public.expense_capture_normalizations;
  v_expense_id uuid;
  v_confirmation_id uuid;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if p_authenticated_user_id is null or p_authenticated_user_id <> auth.uid()
     or not app_private.is_active_internal_staff(p_authenticated_user_id) then
    raise exception 'n55_confirmation_staff_required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'n55_confirmation_idempotency_required' using errcode = '22023';
  end if;
  if p_duplicate_decision not in ('CREATE_NEW', 'USE_EXISTING') then
    raise exception 'n55_duplicate_decision_invalid' using errcode = '22023';
  end if;
  if p_duplicate_decision = 'USE_EXISTING' and p_duplicate_expense_id is null then
    raise exception 'n55_duplicate_expense_required' using errcode = '22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object'
     or v_payload->>'confirmed' <> 'true'
     or coalesce(v_payload->>'currency', '') <> 'EUR'
     or nullif(btrim(v_payload->>'supplier_name'), '') is null
     or nullif(btrim(v_payload->>'description'), '') is null
     or nullif(btrim(v_payload->>'category'), '') is null
     or (v_payload->>'expense_date') !~ '^\d{4}-\d{2}-\d{2}$'
     or (v_payload->>'subtotal') !~ '^\d+(\.\d{1,2})?$'
     or (v_payload->>'tax_amount') !~ '^\d+(\.\d{1,2})?$'
     or (v_payload->>'total') !~ '^\d+(\.\d{1,2})?$' then
    raise exception 'n55_confirmation_payload_invalid' using errcode = '22023';
  end if;

  select * into v_existing from public.expense_capture_confirmations
  where created_by = p_authenticated_user_id and idempotency_key = trim(p_idempotency_key);
  if found then
    if v_existing.capture_document_id <> p_capture_document_id
       or v_existing.payload <> v_payload
       or v_existing.duplicate_decision <> p_duplicate_decision then
      raise exception 'n55_confirmation_idempotency_mismatch' using errcode = '23505';
    end if;
    return jsonb_build_object('confirmation_id', v_existing.id, 'expense_id', v_existing.expense_id, 'reused', true);
  end if;

  select * into v_session from public.expense_capture_sessions
  where id = p_capture_session_id and created_by = p_authenticated_user_id for update;
  if not found or v_session.status = 'CANCELLED' then raise exception 'n55_capture_session_not_found' using errcode = 'P0002'; end if;
  select * into v_document from public.expense_capture_documents
  where id = p_capture_document_id and capture_session_id = p_capture_session_id;
  if not found then raise exception 'n55_capture_document_not_found' using errcode = 'P0002'; end if;
  select n.* into v_normalization from public.expense_capture_normalizations n
  join public.expense_capture_extractions e on e.id = n.extraction_id
  where n.id = p_normalization_id and e.capture_document_id = p_capture_document_id
    and e.created_by = p_authenticated_user_id and n.status = 'SUCCEEDED'
  for update;
  if not found then raise exception 'n55_normalization_not_found' using errcode = 'P0002'; end if;

  if p_duplicate_decision = 'USE_EXISTING' then
    select id into v_expense_id from public.expenses where id = p_duplicate_expense_id;
    if not found then raise exception 'n55_duplicate_expense_not_found' using errcode = 'P0002'; end if;
  else
    insert into public.expenses (
      expense_date, supplier_name, supplier_tax_id, category, description,
      document_type, reference_number, payment_method, payment_status, currency,
      subtotal, tax_rate, tax_amount, total, document_support_status,
      fiscal_review_status, fiscal_risk_level, notes, receipt_file_path, attachment_count
    ) values (
      (v_payload->>'expense_date')::date, btrim(v_payload->>'supplier_name'), nullif(btrim(v_payload->>'supplier_tax_id'), ''),
      btrim(v_payload->>'category'), btrim(v_payload->>'description'), coalesce(nullif(v_payload->>'document_type', ''), 'otro'),
      nullif(btrim(v_payload->>'reference_number'), ''), nullif(v_payload->>'payment_method', ''), coalesce(nullif(v_payload->>'payment_status', ''), 'paid'),
      'EUR', (v_payload->>'subtotal')::numeric, coalesce((v_payload->>'tax_rate')::numeric, 0), (v_payload->>'tax_amount')::numeric,
      (v_payload->>'total')::numeric, 'pending_review', 'pending', 'medium', nullif(btrim(v_payload->>'notes'), ''), v_document.storage_path, 1
    ) returning id into v_expense_id;
  end if;

  insert into public.expense_capture_confirmations (
    capture_session_id, capture_document_id, normalization_id, created_by,
    idempotency_key, duplicate_decision, duplicate_expense_id, expense_id, payload
  ) values (
    p_capture_session_id, p_capture_document_id, p_normalization_id, p_authenticated_user_id,
    trim(p_idempotency_key), p_duplicate_decision, p_duplicate_expense_id, v_expense_id, v_payload
  ) returning id into v_confirmation_id;

  update public.expense_capture_sessions
  set status = 'COMPLETED', completed_expense_id = v_expense_id::text, updated_at = now()
  where id = p_capture_session_id and created_by = p_authenticated_user_id;

  return jsonb_build_object('confirmation_id', v_confirmation_id, 'expense_id', v_expense_id, 'reused', false);
end;
$$;

alter function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) owner to postgres;
revoke all on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to authenticated;

commit;
