-- CP-3B.5A.1: QA-capable portal onboarding foundation.
-- No fixture data is inserted here. The legal catalog is populated by a QA-only fixture.

begin;

alter table public.client_portal_applications
  add column if not exists customer_type text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists tax_id text,
  add column if not exists contact_person text,
  add column if not exists billing_address text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists idempotency_key text,
  add column if not exists submission_fingerprint text;

alter table public.client_portal_applications
  add constraint client_portal_applications_customer_type_v2_check
    check (customer_type is null or customer_type in ('individual', 'business')),
  add constraint client_portal_applications_billing_lengths_v2_check
    check (
      (first_name is null or char_length(btrim(first_name)) between 1 and 120)
      and (last_name is null or char_length(btrim(last_name)) between 1 and 160)
      and (legal_name is null or char_length(btrim(legal_name)) between 1 and 200)
      and (trade_name is null or char_length(btrim(trade_name)) between 1 and 200)
      and (tax_id is null or char_length(btrim(tax_id)) between 1 and 40)
      and (contact_person is null or char_length(btrim(contact_person)) between 1 and 160)
      and (billing_address is null or char_length(btrim(billing_address)) between 1 and 320)
      and (postal_code is null or char_length(btrim(postal_code)) between 1 and 20)
      and (city is null or char_length(btrim(city)) between 1 and 120)
      and (region is null or char_length(btrim(region)) between 1 and 120)
      and (country is null or country = upper(btrim(country)))
    ),
  add constraint client_portal_applications_billing_identity_v2_check
    check (
      customer_type is null
      or (customer_type = 'individual' and first_name is not null and last_name is not null)
      or (customer_type = 'business' and legal_name is not null and tax_id is not null and contact_person is not null)
    );

create unique index if not exists client_portal_applications_user_idempotency_v2_idx
  on public.client_portal_applications (user_id, idempotency_key)
  where idempotency_key is not null;

create table public.client_portal_legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null,
  document_version text not null,
  locale text not null,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  text_reference text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete restrict,
  unique (document_key, document_version, locale),
  check (char_length(btrim(document_key)) between 1 and 120),
  check (char_length(btrim(document_version)) between 1 and 80),
  check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

create unique index client_portal_legal_documents_one_active_v2_idx
  on public.client_portal_legal_documents (document_key, locale)
  where status = 'active';

create table public.client_portal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  application_id uuid not null references public.client_portal_applications(id) on delete restrict,
  client_id text references public.clients(id) on delete restrict,
  purpose text not null check (purpose = 'marketing'),
  status text not null check (status in ('granted', 'withdrawn')),
  version text not null,
  text_reference text not null,
  source text not null,
  consented_at timestamptz,
  withdrawn_at timestamptz,
  correlation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  check ((status = 'granted' and consented_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and withdrawn_at is not null)),
  unique (application_id, purpose)
);

create table public.client_portal_consent_documents (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose = 'marketing'),
  document_version text not null,
  locale text not null,
  text_reference text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete restrict,
  unique (purpose, document_version, locale),
  check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

create unique index client_portal_consent_documents_one_active_v2_idx
  on public.client_portal_consent_documents (purpose, locale)
  where status = 'active';

alter table public.client_portal_legal_documents enable row level security;
alter table public.client_portal_legal_documents force row level security;
alter table public.client_portal_consents enable row level security;
alter table public.client_portal_consents force row level security;
alter table public.client_portal_consent_documents enable row level security;
alter table public.client_portal_consent_documents force row level security;

create policy "Applicant reads own consent v2"
  on public.client_portal_consents for select to authenticated
  using (user_id = auth.uid());

revoke all on table public.client_portal_legal_documents from public, anon, authenticated;
revoke all on table public.client_portal_consents from public, anon, authenticated;
revoke all on table public.client_portal_consent_documents from public, anon, authenticated;
grant select on table public.client_portal_consents to authenticated;
grant select, insert, update, delete on table public.client_portal_legal_documents to service_role;
grant select, insert, update, delete on table public.client_portal_consents to service_role;
grant select, insert, update, delete on table public.client_portal_consent_documents to service_role;

create unique index if not exists client_portal_legal_acceptances_user_document_null_client_v2_idx
  on public.client_portal_legal_acceptances (document_key, document_version, user_id)
  where client_id is null;

create or replace function public.portal_get_active_legal_document(
  p_document_key text default 'portal_privacy',
  p_locale text default 'es-ES'
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'documentKey', d.document_key,
    'documentVersion', d.document_version,
    'locale', d.locale,
    'documentSha256', d.document_sha256,
    'textReference', d.text_reference
  )
  from public.client_portal_legal_documents d
  where d.document_key = p_document_key
    and d.locale = p_locale
    and d.status = 'active'
  limit 1;
$$;

create or replace function public.portal_submit_application_trusted_v2(
  p_actor_user_id uuid,
  p_customer_type text,
  p_first_name text,
  p_last_name text,
  p_legal_name text,
  p_trade_name text,
  p_tax_id text,
  p_contact_person text,
  p_contact_phone text,
  p_billing_address text,
  p_postal_code text,
  p_city text,
  p_region text,
  p_country text,
  p_marketing_opt_in boolean,
  p_locale text,
  p_legal_accepted boolean,
  p_idempotency_key text,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_email text;
  v_application public.client_portal_applications%rowtype;
  v_document public.client_portal_legal_documents%rowtype;
  v_marketing_document public.client_portal_consent_documents%rowtype;
  v_fingerprint text;
begin
  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id = p_actor_user_id and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'invalid_application' using errcode = '22023'; end if;
  if p_customer_type not in ('individual', 'business')
    or p_locale !~ '^[a-z]{2}(-[A-Z]{2})?$'
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128
    or not coalesce(p_legal_accepted, false)
  then raise exception 'invalid_application' using errcode = '22023'; end if;
  if p_customer_type = 'individual' and (nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null) then
    raise exception 'invalid_application' using errcode = '22023';
  end if;
  if p_customer_type = 'business' and (nullif(btrim(p_legal_name), '') is null or nullif(btrim(p_tax_id), '') is null or nullif(btrim(p_contact_person), '') is null) then
    raise exception 'invalid_application' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit('application_submit_v2', p_rate_limit_subject_hash, 5, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select * into v_document from public.client_portal_legal_documents
  where document_key = 'portal_privacy' and locale = p_locale and status = 'active' limit 1;
  if v_document.id is null then raise exception 'legal_document_unavailable' using errcode = 'P0001'; end if;
  if coalesce(p_marketing_opt_in, false) then
    select * into v_marketing_document from public.client_portal_consent_documents
    where purpose = 'marketing' and locale = p_locale and status = 'active' limit 1;
    if v_marketing_document.id is null then
      raise exception 'marketing_consent_unavailable' using errcode = 'P0001';
    end if;
  end if;
  v_fingerprint := md5(concat_ws('|', p_customer_type, p_first_name, p_last_name, p_legal_name, p_trade_name, p_tax_id, p_contact_person, p_contact_phone, p_billing_address, p_postal_code, p_city, p_region, p_country, p_marketing_opt_in, p_locale, p_legal_accepted));
  select * into v_application from public.client_portal_applications where user_id = p_actor_user_id;
  if v_application.idempotency_key = p_idempotency_key then
    if v_application.submission_fingerprint <> v_fingerprint then raise exception 'idempotency_conflict' using errcode = 'P0001'; end if;
    return jsonb_build_object('ok', true, 'applicationId', v_application.id, 'status', v_application.status);
  end if;
  insert into public.client_portal_applications (
    user_id, email_normalized, contact_name, company_name, contact_phone, privacy_notice_version,
    customer_type, first_name, last_name, legal_name, trade_name, tax_id, contact_person,
    billing_address, postal_code, city, region, country, status, idempotency_key, submission_fingerprint
  ) values (
    p_actor_user_id, v_email, nullif(btrim(p_contact_person), ''), nullif(btrim(p_legal_name), ''), nullif(btrim(p_contact_phone), ''), v_document.document_version,
    p_customer_type, nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''), nullif(btrim(p_legal_name), ''), nullif(btrim(p_trade_name), ''), nullif(btrim(p_tax_id), ''), nullif(btrim(p_contact_person), ''),
    nullif(btrim(p_billing_address), ''), nullif(btrim(p_postal_code), ''), nullif(btrim(p_city), ''), nullif(btrim(p_region), ''), upper(nullif(btrim(p_country), '')), 'pending_review', p_idempotency_key, v_fingerprint
  ) on conflict (user_id) do update set
    contact_name = excluded.contact_name, company_name = excluded.company_name, contact_phone = excluded.contact_phone,
    privacy_notice_version = excluded.privacy_notice_version, customer_type = excluded.customer_type, first_name = excluded.first_name,
    last_name = excluded.last_name, legal_name = excluded.legal_name, trade_name = excluded.trade_name, tax_id = excluded.tax_id,
    contact_person = excluded.contact_person, billing_address = excluded.billing_address, postal_code = excluded.postal_code,
    city = excluded.city, region = excluded.region, country = excluded.country, status = 'pending_review',
    idempotency_key = excluded.idempotency_key, submission_fingerprint = excluded.submission_fingerprint
  returning * into v_application;
  insert into public.client_portal_legal_acceptances (document_key, document_version, document_sha256, user_id, locale, correlation_id)
    select v_document.document_key, v_document.document_version, v_document.document_sha256, p_actor_user_id, p_locale, p_correlation_id
    where not exists (
      select 1 from public.client_portal_legal_acceptances
      where document_key = v_document.document_key
        and document_version = v_document.document_version
        and user_id = p_actor_user_id
        and client_id is null
    );
  if coalesce(p_marketing_opt_in, false) then
    insert into public.client_portal_consents (user_id, application_id, purpose, status, version, text_reference, source, consented_at, correlation_id)
      values (p_actor_user_id, v_application.id, 'marketing', 'granted', v_marketing_document.document_version, v_marketing_document.text_reference, 'portal_onboarding', clock_timestamp(), p_correlation_id)
      on conflict (application_id, purpose) do update set status = 'granted', consented_at = excluded.consented_at, withdrawn_at = null;
  end if;
  perform portal_private.write_audit_event('application_submitted', 'accepted', p_actor_user_id, null, null, 'application', v_application.id, p_correlation_id, null, null, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'applicationId', v_application.id, 'status', 'pending_review');
end;
$$;

revoke all on function public.portal_get_active_legal_document(text, text) from public, anon;
grant execute on function public.portal_get_active_legal_document(text, text) to authenticated;
revoke all on function public.portal_submit_application_trusted_v2(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, boolean, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_submit_application_trusted_v2(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, boolean, text, text, uuid) to service_role;

commit;
