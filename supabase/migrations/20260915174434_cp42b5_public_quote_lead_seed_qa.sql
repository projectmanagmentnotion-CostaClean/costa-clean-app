-- CP-4.2B.5: QA-only public quote intake persistence.
-- Target guard: kpvvydthlxupjjqqdpxy. Never apply to production.
-- This migration is additive and deliberately does not alter clients,
-- properties, jobs, quotes, invoices or payments.

begin;

alter table public.public_lead_intake_requests
  add column if not exists contract_version text,
  add column if not exists processing_status text not null default 'pending_review',
  add column if not exists operational_request jsonb not null default '{}'::jsonb;

create table if not exists public.public_quote_intake_consents (
  submission_id uuid not null references public.public_lead_intake_requests(submission_id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  recorded_at timestamptz not null,
  source text not null default 'public_web',
  legal_context jsonb not null default '{}'::jsonb,
  primary key (submission_id, consent_type),
  constraint public_quote_intake_consents_type_check
    check (consent_type in ('necessary_privacy', 'marketing_contact', 'analytics_cookie', 'advertising_cookie'))
);

create table if not exists public.public_quote_intake_attribution (
  submission_id uuid primary key references public.public_lead_intake_requests(submission_id) on delete cascade,
  source text not null default 'public_web',
  landing_path text not null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  recorded_at timestamptz not null
);

create table if not exists public.public_quote_draft_seeds (
  seed_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.public_lead_intake_requests(submission_id) on delete restrict,
  lead_id text not null unique references public.leads(id) on delete restrict,
  schema_version text not null default 'quote_draft_seed_v1',
  contract_version text not null default 'costa_clean_quote_intelligence@1.0.0',
  estimate_model_version text not null default 'estimate_v1',
  seed_version text not null default 'quote_draft_seed_v1',
  operational_summary jsonb not null default '{}'::jsonb,
  review_context text,
  estimate jsonb,
  pricing_support jsonb not null default '{}'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  review jsonb not null default '{}'::jsonb,
  commercial_draft jsonb not null default '{}'::jsonb,
  attribution_summary jsonb not null default '{}'::jsonb,
  intelligence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint public_quote_draft_seeds_schema_check check (schema_version = 'quote_draft_seed_v1'),
  constraint public_quote_draft_seeds_engine_check check (contract_version = 'costa_clean_quote_intelligence@1.0.0'),
  constraint public_quote_draft_seeds_model_check check (estimate_model_version = 'estimate_v1'),
  constraint public_quote_draft_seeds_seed_check check (seed_version = 'quote_draft_seed_v1'),
  constraint public_quote_draft_seeds_no_pii_check check (
    (jsonb_build_object(
      'operational_summary', operational_summary,
      'estimate', estimate,
      'pricing_support', pricing_support,
      'confidence', confidence,
      'review', review,
      'commercial_draft', commercial_draft,
      'attribution_summary', attribution_summary,
      'intelligence', intelligence
    ))::text !~* '"(full_name|phone|email|tax_id|client_id|property_id|exact_address)"[[:space:]]*:'
  )
);

create table if not exists public.public_quote_intake_audit (
  event_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.public_lead_intake_requests(submission_id) on delete restrict,
  lead_id text references public.leads(id) on delete restrict,
  seed_id uuid references public.public_quote_draft_seeds(seed_id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  constraint public_quote_intake_audit_event_check check (
    event_type in ('submission_accepted', 'idempotent_replay', 'conflict', 'lead_created', 'seed_created', 'review_initialized')
  )
);

create index if not exists public_quote_intake_audit_submission_idx
  on public.public_quote_intake_audit (submission_id, occurred_at);

create or replace function public.prevent_public_quote_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if current_user <> 'postgres' then
    raise exception 'public_quote_intake_audit_append_only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
alter function public.prevent_public_quote_audit_mutation() owner to postgres;
revoke all on function public.prevent_public_quote_audit_mutation() from public, anon, authenticated, service_role;
create trigger public_quote_intake_audit_append_only
  before update or delete on public.public_quote_intake_audit
  for each row execute function public.prevent_public_quote_audit_mutation();

alter table public.public_quote_intake_consents enable row level security;
alter table public.public_quote_intake_consents force row level security;
alter table public.public_quote_intake_attribution enable row level security;
alter table public.public_quote_intake_attribution force row level security;
alter table public.public_quote_draft_seeds enable row level security;
alter table public.public_quote_draft_seeds force row level security;
alter table public.public_quote_intake_audit enable row level security;
alter table public.public_quote_intake_audit force row level security;

revoke all on table public.public_quote_intake_consents from public, anon, authenticated;
revoke all on table public.public_quote_intake_attribution from public, anon, authenticated;
revoke all on table public.public_quote_draft_seeds from public, anon, authenticated;
revoke all on table public.public_quote_intake_audit from public, anon, authenticated;
grant all on table public.public_quote_intake_consents to service_role;
grant all on table public.public_quote_intake_attribution to service_role;
grant all on table public.public_quote_draft_seeds to service_role;
grant all on table public.public_quote_intake_audit to service_role;

grant select on table public.public_quote_intake_consents to authenticated;
grant select on table public.public_quote_intake_attribution to authenticated;
grant select on table public.public_quote_draft_seeds to authenticated;
grant select on table public.public_quote_intake_audit to authenticated;

create policy "Internal staff read public quote consents" on public.public_quote_intake_consents
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read public quote attribution" on public.public_quote_intake_attribution
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read public quote seeds" on public.public_quote_draft_seeds
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read public quote audit" on public.public_quote_intake_audit
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));

create or replace function public.submit_public_quote_request_qa(
  p_request jsonb,
  p_abuse_key text,
  p_payload_sha256 text,
  p_intelligence jsonb
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
    'marketing_contact_opt_in', 'analytics_consent', 'advertising_cookie_consent', 'attribution',
    'legal_context', 'received_at'
  ];
  v_submission_id uuid;
  v_existing public.public_lead_intake_requests%rowtype;
  v_recent integer;
  v_lead_id text;
  v_receipt_id text;
  v_seed_id uuid;
  v_advertising boolean;
  v_notes jsonb;
  v_operational jsonb;
  v_review jsonb;
  v_estimate jsonb;
  v_pricing_support jsonb;
  v_attribution jsonb;
  v_attribution_summary jsonb;
  v_seed_payload jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' or p_intelligence is null or jsonb_typeof(p_intelligence) <> 'object' then
    raise exception 'public_quote_request_invalid';
  end if;
  if exists (select 1 from jsonb_object_keys(p_request) as key where not (key = any(v_allowed))) then
    raise exception 'public_quote_request_fields_invalid';
  end if;
  if p_request->>'version' <> 'cp42b-v2'
    or p_request->>'environment' <> 'qa'
    or p_request->>'source' <> 'public_web'
    or p_request->>'privacy_acknowledged' <> 'true'
    or jsonb_typeof(p_request->'notes') <> 'object'
    or jsonb_typeof(p_request->'attribution') <> 'object'
    or jsonb_typeof(p_request->'legal_context') <> 'object'
    or nullif(trim(p_request->>'received_at'), '') is null then
    raise exception 'public_quote_request_contract_invalid';
  end if;

  begin
    v_submission_id := (p_request->>'submission_id')::uuid;
  exception when others then
    raise exception 'public_quote_request_id_invalid';
  end;

  if p_payload_sha256 is null or lower(trim(p_payload_sha256)) !~ '^[0-9a-f]{64}$'
    or p_abuse_key is null or length(p_abuse_key) not between 64 and 128
    or nullif(trim(p_request->>'full_name'), '') is null
    or length(trim(p_request->>'full_name')) > 120
    or nullif(trim(p_request->>'phone'), '') is null
    or length(trim(p_request->>'phone')) not between 5 and 40
    or nullif(trim(p_request->>'service_type'), '') is null
    or p_request->>'service_type' not in ('residential', 'deep_cleaning', 'tourist', 'office_commercial', 'gym', 'hotel', 'post_work_tenant_change', 'other')
    or nullif(trim(p_request->>'city'), '') is null
    or length(trim(p_request->>'city')) > 120
    or (p_request ? 'email' and p_request->>'email' is not null and length(trim(p_request->>'email')) > 254)
    or (p_request ? 'postal_code' and p_request->>'postal_code' is not null and p_request->>'postal_code' !~ '^\d{5}$') then
    raise exception 'public_quote_request_values_invalid';
  end if;
  if p_request->>'marketing_contact_opt_in' not in ('true', 'false')
    or p_request->>'analytics_consent' not in ('true', 'false')
    or p_request->>'advertising_cookie_consent' not in ('true', 'false') then
    raise exception 'public_quote_request_consent_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_submission_id::text, 0));
  select * into v_existing from public.public_lead_intake_requests where submission_id = v_submission_id for update;
  if found then
    if v_existing.payload_sha256 = lower(trim(p_payload_sha256)) then
      insert into public.public_quote_intake_audit (submission_id, lead_id, seed_id, event_type, metadata)
      select v_submission_id, v_existing.lead_id, s.seed_id, 'idempotent_replay', jsonb_build_object('contract_version', 'cp42b-v2')
      from public.public_quote_draft_seeds s where s.submission_id = v_submission_id;
      return jsonb_build_object('ok', true, 'code', 'idempotent', 'receipt_id', v_existing.receipt_id);
    end if;
    insert into public.public_quote_intake_audit (submission_id, event_type, metadata)
    values (v_submission_id, 'conflict', jsonb_build_object('contract_version', 'cp42b-v2'));
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;

  select count(*)::integer into v_recent from public.public_lead_intake_requests
  where abuse_key = p_abuse_key and created_at > timezone('utc', now()) - interval '10 minutes';
  if v_recent >= 5 then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;

  v_notes := p_request->'notes';
  v_advertising := (p_request->>'advertising_cookie_consent')::boolean;
  v_operational := jsonb_build_object(
    'service_family', p_request->>'service_type',
    'service_variant', nullif(v_notes->>'serviceVariant', ''),
    'space_type', nullif(p_request->>'property_type', ''),
    'size_band', nullif(v_notes->>'size', ''),
    'bedroom_band', nullif(v_notes->>'bedrooms', ''),
    'bathroom_band', nullif(v_notes->>'bathrooms', ''),
    'room_count_band', nullif(v_notes->>'roomCountBand', ''),
    'checkout_volume_band', nullif(v_notes->>'checkoutVolumeBand', ''),
    'frequency_band', nullif(v_notes->>'frequency', ''),
    'recurrence_type', nullif(v_notes->>'frequency', ''),
    'urgency', nullif(v_notes->>'dateIntent', ''),
    'time_window', nullif(v_notes->>'timePreference', ''),
    'preferred_response_channel', nullif(v_notes->>'responseChannel', ''),
    'operational_needs', coalesce(v_notes->'needs', '{}'::jsonb),
    'city', p_request->>'city',
    'postal_code', nullif(p_request->>'postal_code', ''),
    'requested_date', nullif(v_notes->>'date', '')
  );
  v_review := jsonb_build_object(
    'manual_review', coalesce((p_intelligence->>'manual_review_required')::boolean, true),
    'reason_codes', coalesce(p_intelligence->'reason_codes', '[]'::jsonb),
    'reviewer_required', true,
    'legal_context', p_request->'legal_context'
  );
  v_estimate := case when p_intelligence->'estimate' is null or jsonb_typeof(p_intelligence->'estimate') = 'null' then null else p_intelligence->'estimate' end;
  v_pricing_support := jsonb_build_object(
    'internal_base_ex_vat', v_estimate->>'base_ex_vat',
    'labor_cost', v_estimate->>'labor_cost',
    'currency', 'EUR',
    'restricted', true
  );
  v_attribution := p_request->'attribution';
  if not v_advertising then
    v_attribution := v_attribution - 'gclid' - 'gbraid' - 'wbraid' - 'fbclid';
  end if;
  v_attribution_summary := jsonb_build_object(
    'utm_source', v_attribution->'utm_source', 'utm_medium', v_attribution->'utm_medium',
    'utm_campaign', v_attribution->'utm_campaign', 'utm_content', v_attribution->'utm_content',
    'utm_term', v_attribution->'utm_term'
  );
  v_seed_payload := jsonb_build_object(
    'operational_summary', v_operational, 'estimate', v_estimate,
    'pricing_support', v_pricing_support, 'confidence', jsonb_build_object('level', p_intelligence->'confidence'),
    'review', v_review,
    'commercial_draft', jsonb_build_object('status', 'needs_review', 'reviewer_required', true, 'customer_price', null, 'vat', null, 'vat_status', 'unconfirmed', 'commercial_total', null, 'customer_message', null),
    'attribution_summary', v_attribution_summary, 'intelligence', p_intelligence
  );
  if v_seed_payload::text ~* '"(full_name|phone|email|tax_id|client_id|property_id|exact_address)"[[:space:]]*:' then
    raise exception 'public_quote_request_seed_pii';
  end if;

  v_lead_id := 'LEAD-CP42B-' || gen_random_uuid()::text;
  v_receipt_id := 'QA-CP42B-' || v_submission_id::text;
  insert into public.leads (id, full_name, phone, email, service_type, property_type, city, postal_code, notes, status, public_intake_last_submission_id, public_intake_metadata)
  values (v_lead_id, trim(p_request->>'full_name'), trim(p_request->>'phone'), nullif(trim(p_request->>'email'), ''), p_request->>'service_type', nullif(trim(p_request->>'property_type'), ''), trim(p_request->>'city'), nullif(trim(p_request->>'postal_code'), ''), left(jsonb_build_object('operational_request', v_operational, 'review_context', v_notes->>'details')::text, 12000), 'new', v_submission_id, jsonb_build_object('source', 'public_web', 'environment', 'qa', 'submission_id', v_submission_id, 'review_state', 'pending_review', 'contract_version', 'cp42b-v2', 'legal_context', p_request->'legal_context', 'received_at', p_request->>'received_at'));
  insert into public.public_lead_intake_requests (submission_id, payload_sha256, lead_id, receipt_id, abuse_key, contract_version, processing_status, operational_request)
  values (v_submission_id, lower(trim(p_payload_sha256)), v_lead_id, v_receipt_id, p_abuse_key, 'cp42b-v2', 'pending_review', v_operational);
  insert into public.public_quote_intake_consents (submission_id, consent_type, granted, recorded_at, source, legal_context)
  values
    (v_submission_id, 'necessary_privacy', true, (p_request->>'received_at')::timestamptz, 'public_web', p_request->'legal_context'),
    (v_submission_id, 'marketing_contact', (p_request->>'marketing_contact_opt_in')::boolean, (p_request->>'received_at')::timestamptz, 'public_web', p_request->'legal_context'),
    (v_submission_id, 'analytics_cookie', (p_request->>'analytics_consent')::boolean, (p_request->>'received_at')::timestamptz, 'public_web', p_request->'legal_context'),
    (v_submission_id, 'advertising_cookie', v_advertising, (p_request->>'received_at')::timestamptz, 'public_web', p_request->'legal_context');
  insert into public.public_quote_intake_attribution (submission_id, landing_path, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, gbraid, wbraid, fbclid, recorded_at)
  values (v_submission_id, v_attribution->>'landing_path', v_attribution->>'referrer', v_attribution->>'utm_source', v_attribution->>'utm_medium', v_attribution->>'utm_campaign', v_attribution->>'utm_content', v_attribution->>'utm_term', v_attribution->>'gclid', v_attribution->>'gbraid', v_attribution->>'wbraid', v_attribution->>'fbclid', (p_request->>'received_at')::timestamptz);
  insert into public.public_quote_draft_seeds (submission_id, lead_id, operational_summary, review_context, estimate, pricing_support, confidence, review, commercial_draft, attribution_summary, intelligence)
  values (v_submission_id, v_lead_id, v_operational, nullif(v_notes->>'details', ''), v_estimate, v_pricing_support, jsonb_build_object('level', p_intelligence->'confidence'), v_review, v_seed_payload->'commercial_draft', v_attribution_summary, p_intelligence)
  returning seed_id into v_seed_id;
  insert into public.public_quote_intake_audit (submission_id, lead_id, seed_id, event_type, metadata)
  values
    (v_submission_id, v_lead_id, v_seed_id, 'submission_accepted', jsonb_build_object('contract_version', 'cp42b-v2')),
    (v_submission_id, v_lead_id, v_seed_id, 'lead_created', '{}'::jsonb),
    (v_submission_id, v_lead_id, v_seed_id, 'seed_created', jsonb_build_object('seed_version', 'quote_draft_seed_v1')),
    (v_submission_id, v_lead_id, v_seed_id, 'review_initialized', jsonb_build_object('status', 'needs_review'));
  return jsonb_build_object('ok', true, 'code', 'accepted', 'receipt_id', v_receipt_id);
end;
$$;

revoke all on function public.submit_public_quote_request_qa(jsonb, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_public_quote_request_qa(jsonb, text, text, jsonb) to service_role;

commit;

-- Rollback QA only: disable the v2 Edge route first, then remove only rows
-- identified by contract_version = cp42b-v2. Drop the function/tables only after
-- no legitimate v2 rows remain. Never delete leads by email or phone and never
-- remove the existing v1 ledger/table or change existing CRM conversion paths.
