-- CP-4.2B: QA-only public lead intake contract.
-- Apply only to kpvvydthlxupjjqqdpxy. No production writes are authorized.

begin;

create table if not exists public.public_lead_intake_requests (
  submission_id uuid primary key,
  payload_sha256 text not null,
  lead_id text not null references public.leads(id) on delete restrict,
  receipt_id text not null unique,
  abuse_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '30 days',
  constraint public_lead_intake_requests_hash_check check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint public_lead_intake_requests_abuse_key_check check (length(abuse_key) between 64 and 128),
  constraint public_lead_intake_requests_receipt_check check (receipt_id ~ '^QA-CP42B-[0-9A-F-]{36}$')
);

create index if not exists public_lead_intake_requests_abuse_created_idx
  on public.public_lead_intake_requests (abuse_key, created_at desc);

alter table public.public_lead_intake_requests enable row level security;
alter table public.public_lead_intake_requests force row level security;
alter table public.leads enable row level security;
alter table public.leads force row level security;

revoke all on table public.public_lead_intake_requests from public, anon, authenticated;
grant all on table public.public_lead_intake_requests to service_role;
revoke all on table public.leads from public, anon;

create or replace function public.submit_public_lead_intake_qa(
  p_request jsonb,
  p_abuse_key text,
  p_payload_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, pg_temp
as $$
declare
  v_allowed text[] := array[
    'version', 'environment', 'source', 'submission_id', 'full_name', 'phone', 'email',
    'service_type', 'property_type', 'city', 'postal_code', 'notes', 'privacy_acknowledged',
    'marketing_contact_opt_in', 'analytics_consent', 'marketing_cookie_consent', 'attribution',
    'legal_context', 'received_at'
  ];
  v_submission_id uuid;
  v_existing public.public_lead_intake_requests%rowtype;
  v_recent integer;
  v_lead_id text;
  v_receipt_id text;
  v_service_type text;
  v_notes text;
  v_metadata jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'public_lead_request_invalid';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_request) as key
    where not (key = any(v_allowed))
  ) then
    raise exception 'public_lead_request_fields_invalid';
  end if;
  if p_request->>'version' <> 'cp42b-v1'
    or p_request->>'environment' <> 'qa'
    or p_request->>'source' <> 'public_web'
    or p_request->>'privacy_acknowledged' <> 'true'
    or jsonb_typeof(p_request->'notes') <> 'object'
    or jsonb_typeof(p_request->'attribution') <> 'object'
    or jsonb_typeof(p_request->'legal_context') <> 'object'
    or nullif(trim(p_request->>'received_at'), '') is null then
    raise exception 'public_lead_request_contract_invalid';
  end if;

  begin
    v_submission_id := (p_request->>'submission_id')::uuid;
  exception when others then
    raise exception 'public_lead_request_id_invalid';
  end;

  if p_payload_sha256 is null or lower(trim(p_payload_sha256)) !~ '^[0-9a-f]{64}$'
    or p_abuse_key is null or length(p_abuse_key) not between 64 and 128
    or nullif(trim(p_request->>'full_name'), '') is null
    or length(trim(p_request->>'full_name')) > 120
    or nullif(trim(p_request->>'phone'), '') is null
    or length(trim(p_request->>'phone')) not between 5 and 40
    or nullif(trim(p_request->>'service_type'), '') is null
    or length(trim(p_request->>'service_type')) > 120
    or nullif(trim(p_request->>'city'), '') is null
    or length(trim(p_request->>'city')) > 120
    or (p_request ? 'email' and p_request->>'email' is not null and length(trim(p_request->>'email')) > 254)
    or (p_request ? 'postal_code' and p_request->>'postal_code' is not null and p_request->>'postal_code' !~ '^\d{5}$') then
    raise exception 'public_lead_request_values_invalid';
  end if;
  if p_request->>'marketing_contact_opt_in' not in ('true', 'false')
    or p_request->>'analytics_consent' not in ('true', 'false')
    or p_request->>'marketing_cookie_consent' not in ('true', 'false') then
    raise exception 'public_lead_request_consent_invalid';
  end if;
  if p_request->>'marketing_cookie_consent' = 'false'
    and (p_request->'attribution' ?| array['gclid', 'gbraid', 'wbraid', 'fbclid']) then
    raise exception 'public_lead_request_attribution_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_submission_id::text, 0));
  select * into v_existing
  from public.public_lead_intake_requests
  where submission_id = v_submission_id
  for update;
  if found then
    if v_existing.payload_sha256 = lower(trim(p_payload_sha256)) then
      return jsonb_build_object('ok', true, 'code', 'idempotent', 'receipt_id', v_existing.receipt_id, 'lead_id', v_existing.lead_id);
    end if;
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;

  select count(*)::integer into v_recent
  from public.public_lead_intake_requests
  where abuse_key = p_abuse_key
    and created_at > timezone('utc', now()) - interval '10 minutes';
  if v_recent >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  v_service_type := case p_request->>'service_type'
    when 'limpieza-residencial' then 'Limpieza residencial'
    when 'limpieza-comercial' then 'Limpieza comercial'
    when 'limpieza-apartamentos-turisticos' then 'Limpieza de apartamentos turísticos'
    when 'limpieza-oficinas' then 'Limpieza de oficinas'
    when 'limpieza-post-obra' then 'Limpieza post-obra'
    when 'limpieza-gimnasios' then 'Limpieza de gimnasios'
    when 'limpieza-hoteles' then 'Limpieza de hoteles'
    else null
  end;
  if v_service_type is null then raise exception 'public_lead_service_invalid'; end if;

  v_lead_id := 'LEAD-CP42B-' || gen_random_uuid()::text;
  v_receipt_id := 'QA-CP42B-' || v_submission_id::text;
  v_notes := left((p_request->'notes')::text, 6000);
  v_metadata := jsonb_build_object(
    'source', 'public_web',
    'environment', 'qa',
    'review_state', 'pending_review',
    'submission_id', v_submission_id,
    'privacy_acknowledged', true,
    'marketing_contact_opt_in', (p_request->>'marketing_contact_opt_in')::boolean,
    'cookie_consent', jsonb_build_object(
      'analytics', (p_request->>'analytics_consent')::boolean,
      'marketing', (p_request->>'marketing_cookie_consent')::boolean
    ),
    'attribution', p_request->'attribution',
    'legal_context', p_request->'legal_context',
    'received_at', p_request->>'received_at'
  );

  insert into public.leads (
    id, full_name, phone, email, service_type, property_type, city, postal_code,
    notes, status, public_intake_last_submission_id, public_intake_metadata
  ) values (
    v_lead_id,
    trim(p_request->>'full_name'),
    trim(p_request->>'phone'),
    nullif(trim(p_request->>'email'), ''),
    v_service_type,
    nullif(trim(p_request->>'property_type'), ''),
    trim(p_request->>'city'),
    nullif(trim(p_request->>'postal_code'), ''),
    v_notes,
    'new',
    v_submission_id,
    v_metadata
  );

  insert into public.public_lead_intake_requests (
    submission_id, payload_sha256, lead_id, receipt_id, abuse_key
  ) values (
    v_submission_id, lower(trim(p_payload_sha256)), v_lead_id, v_receipt_id, p_abuse_key
  );

  return jsonb_build_object('ok', true, 'code', 'accepted', 'receipt_id', v_receipt_id, 'lead_id', v_lead_id);
end;
$$;

revoke all on function public.submit_public_lead_intake_qa(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.submit_public_lead_intake_qa(jsonb, text, text) to service_role;

commit;

-- Rollback (QA only, after deleting CP-4.2B ledger rows first):
-- revoke execute on function public.submit_public_lead_intake_qa(jsonb, text, text) from service_role;
-- drop function if exists public.submit_public_lead_intake_qa(jsonb, text, text);
-- drop table if exists public.public_lead_intake_requests;
-- alter table public.leads no force row level security;
