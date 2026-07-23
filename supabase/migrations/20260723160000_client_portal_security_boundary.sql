begin;

-- CP-2A immutable source package.
-- This migration is intentionally not executed by db push. A future CP-2B runner
-- must provide pg_temp.cp2a_bootstrap_staff(user_id uuid, role text) in the same
-- PostgreSQL session before loading this file.

create schema if not exists portal_private;
revoke all on schema portal_private from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema portal_private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema portal_private
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema portal_private
  revoke execute on functions from public, anon, authenticated;

create table public.internal_staff_memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null
    check (role in ('owner', 'admin', 'operator', 'finance', 'readonly')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason_code text,
  check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create table public.client_portal_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  email_normalized text not null,
  role text not null check (role in ('client_admin', 'client_member')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  accepted_by uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  last_attempt_at timestamptz,
  check (email_normalized = lower(btrim(email_normalized))),
  check (char_length(email_normalized) between 3 and 320),
  check (expires_at <= created_at + interval '7 days'),
  check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or status <> 'accepted'
  ),
  check (
    (status = 'revoked' and revoked_by is not null and revoked_at is not null)
    or status <> 'revoked'
  )
);

create index client_portal_invitations_client_status_idx
  on public.client_portal_invitations (client_id, status, expires_at);
create index client_portal_invitations_email_status_idx
  on public.client_portal_invitations (email_normalized, status);

create table public.client_portal_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_id text not null references public.clients(id) on delete restrict,
  role text not null check (role in ('client_admin', 'client_member')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  invitation_id uuid references public.client_portal_invitations(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  invitation_accepted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason_code text,
  last_role_changed_at timestamptz,
  last_role_changed_by uuid references auth.users(id) on delete restrict,
  unique (user_id, client_id),
  check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create index client_portal_memberships_client_status_idx
  on public.client_portal_memberships (client_id, status, role);
create index client_portal_memberships_user_status_idx
  on public.client_portal_memberships (user_id, status, client_id);

create table public.client_portal_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  email_normalized text not null,
  contact_name text,
  company_name text,
  contact_phone text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'withdrawn', 'expired')),
  submitted_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  decision_reason_code text,
  approved_client_id text references public.clients(id) on delete restrict,
  privacy_notice_version text not null,
  check (email_normalized = lower(btrim(email_normalized))),
  check (char_length(email_normalized) between 3 and 320),
  check (contact_name is null or char_length(contact_name) between 1 and 160),
  check (company_name is null or char_length(company_name) between 1 and 200),
  check (contact_phone is null or char_length(contact_phone) between 3 and 40),
  check (
    (status = 'approved' and reviewed_by is not null and reviewed_at is not null
      and approved_client_id is not null)
    or status <> 'approved'
  )
);

create index client_portal_applications_status_submitted_idx
  on public.client_portal_applications (status, submitted_at);

create table public.client_portal_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  proposed_changes jsonb not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'withdrawn')),
  requested_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  decision_reason_code text,
  check (jsonb_typeof(proposed_changes) = 'object'),
  check (proposed_changes <> '{}'::jsonb)
);

create index client_portal_profile_changes_client_status_idx
  on public.client_portal_profile_change_requests (client_id, status, requested_at desc);
create index client_portal_profile_changes_requester_idx
  on public.client_portal_profile_change_requests (requested_by, requested_at desc);

create table public.client_portal_property_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  property_id text not null references public.properties(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  proposed_changes jsonb not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'withdrawn')),
  requested_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  decision_reason_code text,
  check (jsonb_typeof(proposed_changes) = 'object'),
  check (proposed_changes <> '{}'::jsonb)
);

create index client_portal_property_changes_client_status_idx
  on public.client_portal_property_change_requests (client_id, property_id, status, requested_at desc);
create index client_portal_property_changes_requester_idx
  on public.client_portal_property_change_requests (requested_by, requested_at desc);

create table public.client_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  property_id text not null references public.properties(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  service_type text not null
    check (service_type in ('regular_cleaning', 'deep_cleaning', 'move_cleaning', 'commercial_cleaning', 'other')),
  preferred_date date,
  preferred_time_window text
    check (preferred_time_window is null or preferred_time_window in ('morning', 'afternoon', 'flexible')),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled')),
  idempotency_key uuid not null,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  approved_job_id text references public.jobs(id) on delete restrict,
  quote_id text references public.quotes(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancellation_reason_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version integer not null default 1 check (version > 0),
  unique (requested_by, idempotency_key),
  check (
    (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
    or status <> 'cancelled'
  )
);

create index client_service_requests_client_status_idx
  on public.client_service_requests (client_id, status, created_at desc);
create index client_service_requests_requester_idx
  on public.client_service_requests (requested_by, client_id, created_at desc);
create index client_service_requests_property_idx
  on public.client_service_requests (property_id, created_at desc);

create table public.client_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default clock_timestamp(),
  event_type text not null check (event_type in (
    'application_submitted', 'application_approved', 'application_rejected',
    'invitation_created', 'invitation_accepted', 'invitation_revoked', 'invitation_expired',
    'membership_created', 'membership_role_changed', 'membership_suspended', 'membership_revoked',
    'profile_change_requested', 'profile_change_resolved',
    'property_change_requested', 'property_change_resolved',
    'service_request_submitted', 'service_request_transitioned', 'service_request_cancelled',
    'invoice_download_allowed', 'invoice_download_denied',
    'account_recovery_requested', 'account_security_changed', 'mfa_changed'
  )),
  result text not null check (result in ('allowed', 'denied', 'accepted', 'rejected', 'completed')),
  actor_user_id uuid references auth.users(id) on delete restrict,
  membership_id uuid references public.client_portal_memberships(id) on delete restrict,
  client_id text references public.clients(id) on delete restrict,
  target_type text,
  target_id uuid,
  correlation_id uuid not null,
  aal text check (aal is null or aal in ('aal1', 'aal2')),
  risk_code text,
  metadata jsonb not null default '{}'::jsonb,
  check (jsonb_typeof(metadata) = 'object')
);

create index client_portal_audit_client_time_idx
  on public.client_portal_audit_events (client_id, occurred_at desc);
create index client_portal_audit_actor_time_idx
  on public.client_portal_audit_events (actor_user_id, occurred_at desc);
create index client_portal_audit_correlation_idx
  on public.client_portal_audit_events (correlation_id);

create table public.client_portal_rate_limits (
  action text not null,
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (action, subject_hash, window_started_at),
  check (expires_at > window_started_at)
);

create index client_portal_rate_limits_expiry_idx
  on public.client_portal_rate_limits (expires_at);

create table public.invoice_document_records (
  id uuid primary key default gen_random_uuid(),
  invoice_id text not null references public.invoices(id) on delete restrict,
  object_key text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  mime_type text not null check (mime_type = 'application/pdf'),
  renderer_version text not null,
  template_version text not null,
  invoice_snapshot_hash text not null check (invoice_snapshot_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'ready'
    check (status in ('ready', 'superseded', 'quarantined')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references auth.users(id) on delete restrict,
  check (object_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$')
);

create unique index invoice_document_records_ready_invoice_idx
  on public.invoice_document_records (invoice_id)
  where status = 'ready';
create index invoice_document_records_status_idx
  on public.invoice_document_records (status, created_at desc);

create table public.client_portal_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  document_key text not null,
  document_version text not null,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete restrict,
  membership_id uuid references public.client_portal_memberships(id) on delete restrict,
  client_id text references public.clients(id) on delete restrict,
  locale text not null,
  accepted_at timestamptz not null default clock_timestamp(),
  correlation_id uuid not null,
  unique (document_key, document_version, user_id, client_id)
);

create index client_portal_legal_acceptances_user_idx
  on public.client_portal_legal_acceptances (user_id, accepted_at desc);

create or replace function portal_private.is_verified_portal_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select p_user_id is not null
    and exists (
      select 1
      from auth.users as u
      where u.id = p_user_id
        and u.email_confirmed_at is not null
    );
$$;

create or replace function portal_private.is_active_internal_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.internal_staff_memberships as m
      where m.user_id = p_user_id
        and m.status = 'active'
        and m.revoked_at is null
    );
$$;

create or replace function portal_private.require_active_internal_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not portal_private.is_active_internal_staff(v_user_id) then
    raise exception 'internal_authorization_required' using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

create or replace function portal_private.has_active_portal_membership(
  p_user_id uuid,
  p_client_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select p_user_id is not null
    and p_client_id is not null
    and portal_private.is_verified_portal_user(p_user_id)
    and exists (
      select 1
      from public.client_portal_memberships as m
      where m.user_id = p_user_id
        and m.client_id = p_client_id
        and m.status = 'active'
        and m.revoked_at is null
    );
$$;

create or replace function portal_private.has_portal_role(
  p_user_id uuid,
  p_client_id text,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select portal_private.has_active_portal_membership(p_user_id, p_client_id)
    and exists (
      select 1
      from public.client_portal_memberships as m
      where m.user_id = p_user_id
        and m.client_id = p_client_id
        and m.status = 'active'
        and m.revoked_at is null
        and m.role = any (p_roles)
    );
$$;

create or replace function portal_private.current_portal_client_id(p_client_id text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  if not portal_private.has_active_portal_membership(auth.uid(), p_client_id) then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  return p_client_id;
end;
$$;

create or replace function portal_private.current_portal_client_id()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_client_id text;
begin
  select min(m.client_id)
    into v_client_id
  from public.client_portal_memberships as m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.revoked_at is null
    and portal_private.is_verified_portal_user(m.user_id)
  having count(*) = 1;

  if v_client_id is null then
    raise exception 'explicit_client_context_required' using errcode = '42501';
  end if;
  return v_client_id;
end;
$$;

create or replace function portal_private.assert_trusted_actor_membership(
  p_actor_user_id uuid,
  p_client_id text,
  p_roles text[] default array['client_admin', 'client_member']::text[]
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_membership_id uuid;
begin
  select m.id
    into v_membership_id
  from public.client_portal_memberships as m
  where m.user_id = p_actor_user_id
    and m.client_id = p_client_id
    and m.status = 'active'
    and m.revoked_at is null
    and m.role = any (p_roles)
    and portal_private.is_verified_portal_user(m.user_id);

  if v_membership_id is null then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  return v_membership_id;
end;
$$;

create or replace function portal_private.write_audit_event(
  p_event_type text,
  p_result text,
  p_actor_user_id uuid,
  p_membership_id uuid,
  p_client_id text,
  p_target_type text,
  p_target_id uuid,
  p_correlation_id uuid,
  p_aal text default null,
  p_risk_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event_id uuid;
begin
  if p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
    or p_metadata ?| array[
      'email', 'ip', 'user_agent', 'token', 'signed_url', 'object_key',
      'address', 'tax_id', 'notes', 'invoice_body'
    ]
  then
    raise exception 'unsafe_audit_metadata' using errcode = '22023';
  end if;

  insert into public.client_portal_audit_events (
    event_type, result, actor_user_id, membership_id, client_id,
    target_type, target_id, correlation_id, aal, risk_code, metadata
  ) values (
    p_event_type, p_result, p_actor_user_id, p_membership_id, p_client_id,
    p_target_type, p_target_id, p_correlation_id, p_aal, p_risk_code, p_metadata
  )
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function portal_private.consume_rate_limit(
  p_action text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_count integer;
begin
  if p_action !~ '^[a-z0-9_]{3,64}$'
    or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400
  then
    raise exception 'invalid_rate_limit_input' using errcode = '22023';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  delete from public.client_portal_rate_limits
  where expires_at <= v_now
    and ctid in (
      select ctid
      from public.client_portal_rate_limits
      where expires_at <= v_now
      order by expires_at
      limit 100
    );

  insert into public.client_portal_rate_limits (
    action, subject_hash, window_started_at, window_seconds, request_count, expires_at
  ) values (
    p_action, p_subject_hash, v_window, p_window_seconds, 1,
    v_window + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (action, subject_hash, window_started_at)
  do update set request_count = public.client_portal_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

create or replace function portal_private.prevent_membership_relink()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.client_id is distinct from old.client_id
  then
    raise exception 'membership_relink_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger client_portal_membership_no_relink
before update on public.client_portal_memberships
for each row execute function portal_private.prevent_membership_relink();

create or replace function portal_private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger internal_staff_memberships_updated_at
before update on public.internal_staff_memberships
for each row execute function portal_private.set_updated_at();
create trigger client_portal_memberships_updated_at
before update on public.client_portal_memberships
for each row execute function portal_private.set_updated_at();
create trigger client_service_requests_updated_at
before update on public.client_service_requests
for each row execute function portal_private.set_updated_at();

alter function portal_private.is_verified_portal_user(uuid) owner to postgres;
alter function portal_private.is_active_internal_staff(uuid) owner to postgres;
alter function portal_private.require_active_internal_staff() owner to postgres;
alter function portal_private.has_active_portal_membership(uuid, text) owner to postgres;
alter function portal_private.has_portal_role(uuid, text, text[]) owner to postgres;
alter function portal_private.current_portal_client_id(text) owner to postgres;
alter function portal_private.current_portal_client_id() owner to postgres;
alter function portal_private.assert_trusted_actor_membership(uuid, text, text[]) owner to postgres;
alter function portal_private.write_audit_event(text, text, uuid, uuid, text, text, uuid, uuid, text, text, jsonb) owner to postgres;
alter function portal_private.consume_rate_limit(text, text, integer, integer) owner to postgres;
alter function portal_private.prevent_membership_relink() owner to postgres;
alter function portal_private.set_updated_at() owner to postgres;

revoke all on all functions in schema portal_private from public, anon, authenticated;
grant execute on function portal_private.is_active_internal_staff(uuid) to authenticated;
grant execute on function portal_private.has_active_portal_membership(uuid, text) to authenticated;

do $bootstrap$
declare
  v_requested integer;
  v_inserted integer;
begin
  if to_regclass('pg_temp.cp2a_bootstrap_staff') is null then
    raise exception 'cp2a_bootstrap_staff temp table is required' using errcode = '42501';
  end if;

  execute 'select count(*) from pg_temp.cp2a_bootstrap_staff'
    into v_requested;
  if v_requested < 1 then
    raise exception 'at least one explicit bootstrap staff identity is required' using errcode = '42501';
  end if;

  execute $sql$
    insert into public.internal_staff_memberships (
      user_id, role, status, created_at, updated_at
    )
    select b.user_id, b.role, 'active', clock_timestamp(), clock_timestamp()
    from pg_temp.cp2a_bootstrap_staff as b
    join auth.users as u on u.id = b.user_id
    where b.role in ('owner', 'admin', 'operator', 'finance', 'readonly')
    on conflict (user_id) do nothing
  $sql$;
  get diagnostics v_inserted = row_count;

  if v_inserted <> v_requested then
    raise exception 'bootstrap staff identities are invalid, duplicate, or absent from auth.users'
      using errcode = '42501';
  end if;
end;
$bootstrap$;

-- Replace every current any-authenticated canonical policy with active staff.
drop policy if exists "Authenticated read access" on public.clients;
drop policy if exists "Authenticated read access" on public.properties;
drop policy if exists "Authenticated read access" on public.leads;
drop policy if exists "Authenticated read access" on public.jobs;
drop policy if exists "Authenticated read access" on public.invoices;
drop policy if exists "Authenticated read access" on public.invoice_lines;
drop policy if exists "Authenticated read access" on public.payments;
drop policy if exists "Authenticated read access" on public.quotes;
drop policy if exists "Authenticated read access" on public.quote_lines;
drop policy if exists "Authenticated read access" on public.public_gym_manual_quiz_attempts;

create policy "Internal staff read" on public.clients
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.properties
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.leads
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.jobs
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.invoices
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.invoice_lines
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.payments
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.quotes
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.quote_lines
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.public_gym_manual_quiz_attempts
for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "Allow authenticated insert annual closings" on public.annual_closings;
drop policy if exists "Allow authenticated select annual closings" on public.annual_closings;
drop policy if exists "Allow authenticated update annual closings" on public.annual_closings;
create policy "Internal staff insert" on public.annual_closings
for insert to authenticated
with check (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.annual_closings
for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff update" on public.annual_closings
for update to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "Allow authenticated insert expenses" on public.expenses;
drop policy if exists "Allow authenticated select expenses" on public.expenses;
drop policy if exists "Allow authenticated update expenses" on public.expenses;
create policy "Internal staff insert" on public.expenses
for insert to authenticated
with check (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.expenses
for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff update" on public.expenses
for update to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "Allow authenticated insert quarterly closings" on public.quarterly_closings;
drop policy if exists "Allow authenticated select quarterly closings" on public.quarterly_closings;
drop policy if exists "Allow authenticated update quarterly closings" on public.quarterly_closings;
create policy "Internal staff insert" on public.quarterly_closings
for insert to authenticated
with check (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff read" on public.quarterly_closings
for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));
create policy "Internal staff update" on public.quarterly_closings
for update to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "Authenticated users can manage intake submissions" on public.intake_submissions;
create policy "Internal staff manage" on public.intake_submissions
for all to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "Authenticated users can manage lead drafts" on public.lead_drafts;
create policy "Internal staff manage" on public.lead_drafts
for all to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "Authenticated users can read audit events" on public.audit_events;
create policy "Internal staff read" on public.audit_events
for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

drop policy if exists "authenticated can read job lines" on public.job_lines;
create policy "Internal staff read" on public.job_lines
for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

-- The existing private expense bucket also stops trusting every authenticated user.
drop policy if exists "Allow authenticated read expense receipts" on storage.objects;
drop policy if exists "Allow authenticated upload expense receipts" on storage.objects;
drop policy if exists "Allow authenticated update expense receipts" on storage.objects;
drop policy if exists "Allow authenticated delete expense receipts" on storage.objects;
create policy "Internal staff read expense receipts" on storage.objects
for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff(auth.uid())
);
create policy "Internal staff upload expense receipts" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff(auth.uid())
);
create policy "Internal staff update expense receipts" on storage.objects
for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff(auth.uid())
)
with check (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff(auth.uid())
);
create policy "Internal staff delete expense receipts" on storage.objects
for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff(auth.uid())
);

-- Harden the two legacy guard contracts without changing caller signatures.
create or replace function public.require_authenticated_write()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  perform portal_private.require_active_internal_staff();
end;
$$;

create or replace function public.require_authenticated_financial_write()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  perform portal_private.require_active_internal_staff();
end;
$$;

create or replace function public.record_audit_event(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_changed_fields text[] default '{}'::text[],
  p_new_values jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  perform portal_private.require_active_internal_staff();
  insert into public.audit_events (
    entity_type, entity_id, action, changed_fields, new_values, metadata, changed_by
  ) values (
    p_entity_type, p_entity_id, p_action, p_changed_fields,
    p_new_values, p_metadata, auth.uid()
  );
end;
$$;

alter function public.require_authenticated_write() owner to postgres;
alter function public.require_authenticated_financial_write() owner to postgres;
alter function public.record_audit_event(text, text, text, text[], jsonb, jsonb) owner to postgres;
revoke execute on function public.require_authenticated_write() from public, anon, authenticated;
revoke execute on function public.require_authenticated_financial_write() from public, anon, authenticated;

-- Every active legacy SECURITY DEFINER function gets a fixed path. Functions
-- reached by the CRM retain their existing signatures and now fail through the
-- hardened guards for portal identities.
alter function public.accept_quote_workflow(text, boolean, text, date)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.backfill_invoice_fiscal_snapshots()
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.convert_lead_to_client(text, text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.create_client(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.create_lead(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.create_property(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.reassign_property_client(text, text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.reassign_property_client_authenticated(text, text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.refresh_invoice_payment_status(text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.rls_auto_enable()
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.save_invoice_with_lines(jsonb, jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.save_invoice_with_lines_v2(jsonb, jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.save_job_with_lines(jsonb, jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.save_lead_quote_with_lines(text, text, jsonb, jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.save_payment_and_refresh_invoice(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.save_quote_with_lines(jsonb, jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.settle_invoice_by_transfer(text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.submit_public_gym_manual_quiz_attempt(jsonb)
  set search_path = pg_catalog, public, pg_temp;
alter function public.submit_public_gym_manual_quiz_attempt_private(jsonb, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.update_client(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.update_invoice_status(text, text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.update_job_status(text, text)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.update_lead(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.update_property(jsonb)
  set search_path = pg_catalog, public, portal_private, pg_temp;
alter function public.update_quote_status(text, text)
  set search_path = pg_catalog, public, portal_private, pg_temp;

-- Legacy public/portal reachability is an explicit allowlist. Utility and trigger
-- functions are not callable through PostgREST.
do $legacy_grants$
declare
  f record;
begin
  for f in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname <> 'submit_public_gym_manual_quiz_attempt_private'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      f.nspname, f.proname, f.args
    );
  end loop;
end;
$legacy_grants$;

grant execute on function public.accept_quote_workflow(text, boolean, text, date) to authenticated;
grant execute on function public.backfill_invoice_fiscal_snapshots() to authenticated;
grant execute on function public.convert_lead_to_client(text, text) to authenticated;
grant execute on function public.create_client(jsonb) to authenticated;
grant execute on function public.create_lead(jsonb) to authenticated;
grant execute on function public.create_property(jsonb) to authenticated;
grant execute on function public.reassign_property_client_authenticated(text, text) to authenticated;
grant execute on function public.record_audit_event(text, text, text, text[], jsonb, jsonb) to authenticated;
grant execute on function public.refresh_invoice_payment_status(text) to authenticated;
grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.save_invoice_with_lines_v2(jsonb, jsonb) to authenticated;
grant execute on function public.save_job_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.save_lead_quote_with_lines(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_payment_and_refresh_invoice(jsonb) to authenticated;
grant execute on function public.save_quote_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.settle_invoice_by_transfer(text) to authenticated;
grant execute on function public.update_client(jsonb) to authenticated;
grant execute on function public.update_invoice_status(text, text) to authenticated;
grant execute on function public.update_job_status(text, text) to authenticated;
grant execute on function public.update_lead(jsonb) to authenticated;
grant execute on function public.update_property(jsonb) to authenticated;
grant execute on function public.update_quote_status(text, text) to authenticated;
grant execute on function public.submit_public_gym_manual_quiz_attempt_private(jsonb, text, text)
  to service_role;

-- Portal RLS is FORCE + deny-by-default. Customer DML is available only through
-- the trusted service_role functions defined below.
alter table public.internal_staff_memberships enable row level security;
alter table public.internal_staff_memberships force row level security;
alter table public.client_portal_invitations enable row level security;
alter table public.client_portal_invitations force row level security;
alter table public.client_portal_memberships enable row level security;
alter table public.client_portal_memberships force row level security;
alter table public.client_portal_applications enable row level security;
alter table public.client_portal_applications force row level security;
alter table public.client_portal_profile_change_requests enable row level security;
alter table public.client_portal_profile_change_requests force row level security;
alter table public.client_portal_property_change_requests enable row level security;
alter table public.client_portal_property_change_requests force row level security;
alter table public.client_service_requests enable row level security;
alter table public.client_service_requests force row level security;
alter table public.client_portal_audit_events enable row level security;
alter table public.client_portal_audit_events force row level security;
alter table public.client_portal_rate_limits enable row level security;
alter table public.client_portal_rate_limits force row level security;
alter table public.invoice_document_records enable row level security;
alter table public.invoice_document_records force row level security;
alter table public.client_portal_legal_acceptances enable row level security;
alter table public.client_portal_legal_acceptances force row level security;

create policy "Internal staff read staff memberships"
on public.internal_staff_memberships for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

create policy "Portal reads own active membership"
on public.client_portal_memberships for select to authenticated
using (
  user_id = auth.uid()
  and status = 'active'
  and revoked_at is null
  and portal_private.has_active_portal_membership(auth.uid(), client_id)
);
create policy "Internal staff read portal memberships"
on public.client_portal_memberships for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

create policy "Applicant reads own application"
on public.client_portal_applications for select to authenticated
using (user_id = auth.uid());
create policy "Internal staff read applications"
on public.client_portal_applications for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

create policy "Portal reads same-client profile requests"
on public.client_portal_profile_change_requests for select to authenticated
using (portal_private.has_active_portal_membership(auth.uid(), client_id));
create policy "Internal staff manage profile requests"
on public.client_portal_profile_change_requests for all to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

create policy "Portal reads same-client property requests"
on public.client_portal_property_change_requests for select to authenticated
using (portal_private.has_active_portal_membership(auth.uid(), client_id));
create policy "Internal staff manage property requests"
on public.client_portal_property_change_requests for all to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

create policy "Portal reads same-client service requests"
on public.client_service_requests for select to authenticated
using (portal_private.has_active_portal_membership(auth.uid(), client_id));
create policy "Internal staff manage service requests"
on public.client_service_requests for all to authenticated
using (portal_private.is_active_internal_staff(auth.uid()))
with check (portal_private.is_active_internal_staff(auth.uid()));

create policy "Internal staff read portal audit"
on public.client_portal_audit_events for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

create policy "Internal staff read invoice document registry"
on public.invoice_document_records for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

create policy "Portal reads own legal acceptance"
on public.client_portal_legal_acceptances for select to authenticated
using (
  user_id = auth.uid()
  and (
    client_id is null
    or portal_private.has_active_portal_membership(auth.uid(), client_id)
  )
);
create policy "Internal staff read legal acceptance"
on public.client_portal_legal_acceptances for select to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

revoke all on table public.internal_staff_memberships from public, anon, authenticated;
revoke all on table public.client_portal_invitations from public, anon, authenticated;
revoke all on table public.client_portal_memberships from public, anon, authenticated;
revoke all on table public.client_portal_applications from public, anon, authenticated;
revoke all on table public.client_portal_profile_change_requests from public, anon, authenticated;
revoke all on table public.client_portal_property_change_requests from public, anon, authenticated;
revoke all on table public.client_service_requests from public, anon, authenticated;
revoke all on table public.client_portal_audit_events from public, anon, authenticated;
revoke all on table public.client_portal_rate_limits from public, anon, authenticated;
revoke all on table public.invoice_document_records from public, anon, authenticated;
revoke all on table public.client_portal_legal_acceptances from public, anon, authenticated;

grant select on table public.internal_staff_memberships to authenticated;
grant select on table public.client_portal_memberships to authenticated;
grant select on table public.client_portal_applications to authenticated;
grant select on table public.client_portal_profile_change_requests to authenticated;
grant select on table public.client_portal_property_change_requests to authenticated;
grant select on table public.client_service_requests to authenticated;
grant select on table public.client_portal_audit_events to authenticated;
grant select on table public.invoice_document_records to authenticated;
grant select on table public.client_portal_legal_acceptances to authenticated;

grant select, insert, update, delete on table public.internal_staff_memberships to service_role;
grant select, insert, update, delete on table public.client_portal_invitations to service_role;
grant select, insert, update, delete on table public.client_portal_memberships to service_role;
grant select, insert, update, delete on table public.client_portal_applications to service_role;
grant select, insert, update, delete on table public.client_portal_profile_change_requests to service_role;
grant select, insert, update, delete on table public.client_portal_property_change_requests to service_role;
grant select, insert, update, delete on table public.client_service_requests to service_role;
grant select, insert, update, delete on table public.client_portal_audit_events to service_role;
grant select, insert, update, delete on table public.client_portal_rate_limits to service_role;
grant select, insert, update, delete on table public.invoice_document_records to service_role;
grant select, insert, update, delete on table public.client_portal_legal_acceptances to service_role;

-- Narrow customer-safe read RPCs.
create or replace function public.portal_get_account_context(p_client_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select jsonb_build_object(
    'clientId', m.client_id,
    'membershipId', m.id,
    'role', m.role,
    'status', m.status
  )
  from public.client_portal_memberships as m
  where m.user_id = auth.uid()
    and m.client_id = portal_private.current_portal_client_id(p_client_id)
    and m.status = 'active'
    and m.revoked_at is null;
$$;

create or replace function public.portal_get_client_profile(p_client_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select jsonb_build_object(
    'id', c.id,
    'fullName', c.full_name,
    'phone', c.phone,
    'email', c.email,
    'taxId', c.tax_id,
    'billingAddress', c.billing_address,
    'status', c.status
  )
  from public.clients as c
  where c.id = portal_private.current_portal_client_id(p_client_id)
    and c.deleted_at is null;
$$;

create or replace function public.portal_list_properties(p_client_id text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'propertyType', p.property_type,
    'address', p.address,
    'city', p.city,
    'postalCode', p.postal_code,
    'status', p.status
  ) order by p.created_at desc), '[]'::jsonb)
  from (
    select *
    from public.properties
    where client_id = portal_private.current_portal_client_id(p_client_id)
      and deleted_at is null
      and archived_at is null
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as p;
$$;

create or replace function public.portal_get_property(p_client_id text, p_property_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'propertyType', p.property_type,
    'address', p.address,
    'city', p.city,
    'postalCode', p.postal_code,
    'status', p.status
  )
  from public.properties as p
  where p.client_id = portal_private.current_portal_client_id(p_client_id)
    and p.id = p_property_id
    and p.deleted_at is null
    and p.archived_at is null;
$$;

create or replace function public.portal_list_services(p_client_id text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'reference', j.display_code,
    'propertyId', j.property_id,
    'scheduledDate', j.scheduled_date,
    'status', j.status,
    'serviceType', j.service_type
  ) order by j.scheduled_date desc), '[]'::jsonb)
  from (
    select *
    from public.jobs
    where client_id = portal_private.current_portal_client_id(p_client_id)
      and deleted_at is null
      and archived_at is null
    order by scheduled_date desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as j;
$$;

create or replace function public.portal_get_service(p_client_id text, p_service_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select jsonb_build_object(
    'id', j.id,
    'reference', j.display_code,
    'propertyId', j.property_id,
    'scheduledDate', j.scheduled_date,
    'status', j.status,
    'serviceType', j.service_type
  )
  from public.jobs as j
  where j.client_id = portal_private.current_portal_client_id(p_client_id)
    and j.id = p_service_id
    and j.deleted_at is null
    and j.archived_at is null;
$$;

create or replace function public.portal_list_service_requests(p_client_id text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'propertyId', r.property_id,
    'serviceType', r.service_type,
    'preferredDate', r.preferred_date,
    'preferredTimeWindow', r.preferred_time_window,
    'notes', r.notes,
    'status', r.status,
    'createdAt', r.created_at,
    'version', r.version
  ) order by r.created_at desc), '[]'::jsonb)
  from (
    select *
    from public.client_service_requests
    where client_id = portal_private.current_portal_client_id(p_client_id)
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as r;
$$;

create or replace function public.portal_list_invoices(p_client_id text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'invoiceNumber', i.invoice_number,
    'issueDate', i.issue_date,
    'status', i.status,
    'subtotal', i.subtotal,
    'taxAmount', i.tax_amount,
    'total', i.total,
    'paidAmount', coalesce(i.paid_amount, 0),
    'outstandingAmount', greatest(i.total - coalesce(i.paid_amount, 0), 0)
  ) order by i.issue_date desc), '[]'::jsonb)
  from (
    select inv.*, (
      select coalesce(sum(pay.amount), 0)
      from public.payments as pay
      where pay.invoice_id = inv.id
        and pay.deleted_at is null
        and pay.cancelled_at is null
    ) as paid_amount
    from public.invoices as inv
    where inv.client_id = portal_private.current_portal_client_id(p_client_id)
      and inv.deleted_at is null
      and inv.archived_at is null
    order by inv.issue_date desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as i;
$$;

create or replace function public.portal_get_invoice(p_client_id text, p_invoice_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select jsonb_build_object(
    'id', i.id,
    'invoiceNumber', i.invoice_number,
    'issueDate', i.issue_date,
    'status', i.status,
    'subtotal', i.subtotal,
    'taxAmount', i.tax_amount,
    'total', i.total,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'concept', l.concept,
        'quantity', l.quantity,
        'unit', l.unit,
        'unitPrice', l.unit_price,
        'lineSubtotal', l.line_subtotal
      ) order by l.sort_order)
      from public.invoice_lines as l
      where l.invoice_id = i.id
    ), '[]'::jsonb)
  )
  from public.invoices as i
  where i.client_id = portal_private.current_portal_client_id(p_client_id)
    and i.id = p_invoice_id
    and i.deleted_at is null
    and i.archived_at is null;
$$;

create or replace function public.portal_get_application_status()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select jsonb_build_object('status', a.status, 'submittedAt', a.submitted_at)
    from public.client_portal_applications as a
    where a.user_id = auth.uid()
  ), jsonb_build_object('status', 'none'));
$$;

-- Trusted mutation RPCs. They are never granted to authenticated.
create or replace function public.portal_submit_application_trusted(
  p_actor_user_id uuid,
  p_email_normalized text,
  p_contact_name text,
  p_company_name text,
  p_contact_phone text,
  p_privacy_notice_version text,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_application_id uuid;
begin
  if not portal_private.is_verified_portal_user(p_actor_user_id)
    or p_email_normalized <> lower(btrim(p_email_normalized))
    or not exists (
      select 1 from auth.users
      where id = p_actor_user_id
        and lower(btrim(email)) = p_email_normalized
    )
  then
    raise exception 'invalid_application' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit(
    'application_submit', p_rate_limit_subject_hash, 5, 86400
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.client_portal_applications (
    user_id, email_normalized, contact_name, company_name, contact_phone,
    status, privacy_notice_version
  ) values (
    p_actor_user_id, p_email_normalized, nullif(btrim(p_contact_name), ''),
    nullif(btrim(p_company_name), ''), nullif(btrim(p_contact_phone), ''),
    'pending_review', p_privacy_notice_version
  )
  on conflict (user_id) do update
    set contact_name = excluded.contact_name,
        company_name = excluded.company_name,
        contact_phone = excluded.contact_phone
    where public.client_portal_applications.status = 'pending_review'
  returning id into v_application_id;

  if v_application_id is null then
    raise exception 'application_unavailable' using errcode = 'P0001';
  end if;
  perform portal_private.write_audit_event(
    'application_submitted', 'accepted', p_actor_user_id, null, null,
    'application', v_application_id, p_correlation_id, null, null, '{}'::jsonb
  );
  return jsonb_build_object('ok', true, 'status', 'pending_review');
end;
$$;

create or replace function public.portal_create_invitation_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_email_normalized text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_invitation_id uuid;
  v_membership_id uuid;
begin
  if portal_private.is_active_internal_staff(p_actor_user_id) then
    v_membership_id := null;
  else
    v_membership_id := portal_private.assert_trusted_actor_membership(
      p_actor_user_id, p_client_id, array['client_admin']::text[]
    );
  end if;
  if p_role not in ('client_admin', 'client_member')
    or p_email_normalized <> lower(btrim(p_email_normalized))
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '7 days'
  then
    raise exception 'invalid_invitation' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit(
    'member_invitation', p_rate_limit_subject_hash, 10, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.client_portal_invitations (
    client_id, email_normalized, role, token_hash, expires_at, invited_by
  ) values (
    p_client_id, p_email_normalized, p_role, p_token_hash, p_expires_at, p_actor_user_id
  )
  returning id into v_invitation_id;

  perform portal_private.write_audit_event(
    'invitation_created', 'completed', p_actor_user_id, v_membership_id, p_client_id,
    'invitation', v_invitation_id, p_correlation_id, null, null,
    jsonb_build_object('role', p_role)
  );
  return v_invitation_id;
end;
$$;

create or replace function public.portal_accept_invitation_trusted(
  p_actor_user_id uuid,
  p_token_hash text,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_invitation public.client_portal_invitations%rowtype;
  v_membership public.client_portal_memberships%rowtype;
begin
  if not portal_private.is_verified_portal_user(p_actor_user_id)
    or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'invitation_unavailable' using errcode = 'P0002';
  end if;
  if not portal_private.consume_rate_limit(
    'invitation_accept', p_rate_limit_subject_hash, 10, 900
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select *
    into v_invitation
  from public.client_portal_invitations
  where token_hash = p_token_hash
    and status = 'pending'
    and expires_at > clock_timestamp()
  for update;

  if v_invitation.id is null
    or not exists (
      select 1
      from auth.users as u
      where u.id = p_actor_user_id
        and lower(btrim(u.email)) = v_invitation.email_normalized
    )
  then
    raise exception 'invitation_unavailable' using errcode = 'P0002';
  end if;

  insert into public.client_portal_memberships (
    user_id, client_id, role, status, invitation_id,
    invitation_accepted_at, created_at, updated_at
  ) values (
    p_actor_user_id, v_invitation.client_id, v_invitation.role, 'active',
    v_invitation.id, clock_timestamp(), clock_timestamp(), clock_timestamp()
  )
  on conflict (user_id, client_id) do nothing
  returning * into v_membership;

  if v_membership.id is null then
    select *
      into v_membership
    from public.client_portal_memberships
    where user_id = p_actor_user_id
      and client_id = v_invitation.client_id
      and invitation_id = v_invitation.id
      and status = 'active';
  end if;
  if v_membership.id is null then
    raise exception 'invitation_unavailable' using errcode = 'P0002';
  end if;

  update public.client_portal_invitations
  set status = 'accepted',
      accepted_by = p_actor_user_id,
      accepted_at = clock_timestamp(),
      attempt_count = attempt_count + 1,
      last_attempt_at = clock_timestamp()
  where id = v_invitation.id
    and status = 'pending';
  if not found then
    raise exception 'invitation_unavailable' using errcode = 'P0002';
  end if;

  perform portal_private.write_audit_event(
    'invitation_accepted', 'completed', p_actor_user_id, v_membership.id,
    v_invitation.client_id, 'invitation', v_invitation.id, p_correlation_id,
    null, null, '{}'::jsonb
  );
  return jsonb_build_object(
    'ok', true,
    'clientId', v_invitation.client_id,
    'role', v_invitation.role
  );
end;
$$;

create or replace function public.portal_submit_profile_change_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_proposed_changes jsonb,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_membership_id uuid;
  v_request_id uuid;
begin
  v_membership_id := portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id
  );
  if p_proposed_changes is null
    or jsonb_typeof(p_proposed_changes) <> 'object'
    or (select count(*) from jsonb_object_keys(p_proposed_changes)) not between 1 and 6
    or exists (
      select 1 from jsonb_object_keys(p_proposed_changes) as key
      where key not in (
        'fullName', 'phone', 'email', 'taxId', 'billingAddress', 'companyRepresentative'
      )
    )
  then
    raise exception 'invalid_profile_change' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit(
    'profile_change', p_rate_limit_subject_hash, 5, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.client_portal_profile_change_requests (
    client_id, requested_by, proposed_changes
  ) values (p_client_id, p_actor_user_id, p_proposed_changes)
  returning id into v_request_id;
  perform portal_private.write_audit_event(
    'profile_change_requested', 'accepted', p_actor_user_id, v_membership_id,
    p_client_id, 'profile_change', v_request_id, p_correlation_id,
    null, null, jsonb_build_object('fields', (
      select jsonb_agg(key order by key) from jsonb_object_keys(p_proposed_changes) as key
    ))
  );
  return v_request_id;
end;
$$;

create or replace function public.portal_submit_property_change_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_property_id text,
  p_proposed_changes jsonb,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_membership_id uuid;
  v_request_id uuid;
begin
  v_membership_id := portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id
  );
  if not exists (
    select 1 from public.properties
    where id = p_property_id
      and client_id = p_client_id
      and deleted_at is null
  ) then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  if p_proposed_changes is null
    or jsonb_typeof(p_proposed_changes) <> 'object'
    or (select count(*) from jsonb_object_keys(p_proposed_changes)) not between 1 and 5
    or exists (
      select 1 from jsonb_object_keys(p_proposed_changes) as key
      where key not in ('name', 'propertyType', 'address', 'city', 'postalCode')
    )
  then
    raise exception 'invalid_property_change' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit(
    'property_change', p_rate_limit_subject_hash, 5, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.client_portal_property_change_requests (
    client_id, property_id, requested_by, proposed_changes
  ) values (p_client_id, p_property_id, p_actor_user_id, p_proposed_changes)
  returning id into v_request_id;
  perform portal_private.write_audit_event(
    'property_change_requested', 'accepted', p_actor_user_id, v_membership_id,
    p_client_id, 'property_change', v_request_id, p_correlation_id,
    null, null, jsonb_build_object('fields', (
      select jsonb_agg(key order by key) from jsonb_object_keys(p_proposed_changes) as key
    ))
  );
  return v_request_id;
end;
$$;

create or replace function public.portal_submit_service_request_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_property_id text,
  p_service_type text,
  p_preferred_date date,
  p_preferred_time_window text,
  p_notes text,
  p_idempotency_key uuid,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_membership_id uuid;
  v_request public.client_service_requests%rowtype;
begin
  v_membership_id := portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id
  );
  if not exists (
    select 1 from public.properties
    where id = p_property_id
      and client_id = p_client_id
      and status = 'active'
      and deleted_at is null
  ) then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  if p_service_type not in (
      'regular_cleaning', 'deep_cleaning', 'move_cleaning', 'commercial_cleaning', 'other'
    )
    or (p_preferred_time_window is not null and p_preferred_time_window not in (
      'morning', 'afternoon', 'flexible'
    ))
    or p_preferred_date < current_date
    or char_length(coalesce(p_notes, '')) > 1000
    or p_idempotency_key is null
  then
    raise exception 'invalid_service_request' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit(
    'service_request', p_rate_limit_subject_hash, 5, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.client_service_requests (
    client_id, property_id, requested_by, service_type, preferred_date,
    preferred_time_window, notes, status, idempotency_key
  ) values (
    p_client_id, p_property_id, p_actor_user_id, p_service_type, p_preferred_date,
    p_preferred_time_window, nullif(btrim(p_notes), ''), 'pending_review', p_idempotency_key
  )
  on conflict (requested_by, idempotency_key) do nothing
  returning * into v_request;

  if v_request.id is null then
    select *
      into v_request
    from public.client_service_requests
    where requested_by = p_actor_user_id
      and idempotency_key = p_idempotency_key
      and client_id = p_client_id
      and property_id = p_property_id;
  end if;
  if v_request.id is null then
    raise exception 'idempotency_conflict' using errcode = '23505';
  end if;

  perform portal_private.write_audit_event(
    'service_request_submitted', 'accepted', p_actor_user_id, v_membership_id,
    p_client_id, 'service_request', v_request.id, p_correlation_id,
    null, null, jsonb_build_object('status', v_request.status)
  );
  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'createdAt', v_request.created_at
  );
end;
$$;

create or replace function public.portal_cancel_service_request_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_request_id uuid,
  p_expected_version integer,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_membership_id uuid;
  v_request public.client_service_requests%rowtype;
begin
  v_membership_id := portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id
  );
  if not portal_private.consume_rate_limit(
    'service_request_cancel', p_rate_limit_subject_hash, 10, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  update public.client_service_requests
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancelled_by = p_actor_user_id,
      cancellation_reason_code = 'customer_withdrawn',
      version = version + 1
  where id = p_request_id
    and client_id = p_client_id
    and requested_by = p_actor_user_id
    and status = 'pending_review'
    and approved_job_id is null
    and version = p_expected_version
  returning * into v_request;
  if v_request.id is null then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  perform portal_private.write_audit_event(
    'service_request_cancelled', 'completed', p_actor_user_id, v_membership_id,
    p_client_id, 'service_request', v_request.id, p_correlation_id,
    null, null, jsonb_build_object('status', v_request.status)
  );
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'version', v_request.version);
end;
$$;

create or replace function public.portal_revoke_member_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_target_membership_id uuid,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_actor_membership_id uuid;
  v_target public.client_portal_memberships%rowtype;
begin
  if portal_private.is_active_internal_staff(p_actor_user_id) then
    v_actor_membership_id := null;
  else
    v_actor_membership_id := portal_private.assert_trusted_actor_membership(
      p_actor_user_id, p_client_id, array['client_admin']::text[]
    );
  end if;
  if not portal_private.consume_rate_limit(
    'member_revoke', p_rate_limit_subject_hash, 10, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select *
    into v_target
  from public.client_portal_memberships
  where id = p_target_membership_id
    and client_id = p_client_id
    and status = 'active'
  for update;
  if v_target.id is null
    or (v_target.user_id = p_actor_user_id and not portal_private.is_active_internal_staff(p_actor_user_id))
  then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  if v_target.role = 'client_admin'
    and (
      select count(*)
      from public.client_portal_memberships
      where client_id = p_client_id
        and role = 'client_admin'
        and status = 'active'
        and revoked_at is null
    ) <= 1
  then
    raise exception 'last_client_admin_protected' using errcode = '42501';
  end if;

  update public.client_portal_memberships
  set status = 'revoked',
      revoked_at = clock_timestamp(),
      revoked_by = p_actor_user_id,
      revocation_reason_code = 'portal_admin_revoked'
  where id = v_target.id;
  perform portal_private.write_audit_event(
    'membership_revoked', 'completed', p_actor_user_id, v_actor_membership_id,
    p_client_id, 'membership', v_target.id, p_correlation_id,
    null, null, jsonb_build_object('role', v_target.role)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_get_invoice_download_authorization_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_invoice_id text,
  p_document_id uuid,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_membership_id uuid;
  v_document public.invoice_document_records%rowtype;
begin
  v_membership_id := portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id
  );
  if not portal_private.consume_rate_limit(
    'invoice_download', p_rate_limit_subject_hash, 30, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select d.*
    into v_document
  from public.invoice_document_records as d
  join public.invoices as i on i.id = d.invoice_id
  where d.id = p_document_id
    and d.invoice_id = p_invoice_id
    and d.status = 'ready'
    and i.client_id = p_client_id
    and i.deleted_at is null
    and i.archived_at is null;
  if v_document.id is null then
    perform portal_private.write_audit_event(
      'invoice_download_denied', 'denied', p_actor_user_id, v_membership_id,
      p_client_id, 'invoice_document', p_document_id, p_correlation_id,
      null, 'not_found', '{}'::jsonb
    );
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  perform portal_private.write_audit_event(
    'invoice_download_allowed', 'allowed', p_actor_user_id, v_membership_id,
    p_client_id, 'invoice_document', v_document.id, p_correlation_id,
    null, null, '{}'::jsonb
  );
  return jsonb_build_object(
    'documentId', v_document.id,
    'objectKey', v_document.object_key,
    'mimeType', v_document.mime_type,
    'expiresIn', 60
  );
end;
$$;

create or replace function public.portal_manage_internal_staff_trusted(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  if not exists (
    select 1
    from public.internal_staff_memberships
    where user_id = p_actor_user_id
      and role in ('owner', 'admin')
      and status = 'active'
      and revoked_at is null
  )
    or p_role not in ('owner', 'admin', 'operator', 'finance', 'readonly')
    or p_status not in ('active', 'suspended', 'revoked')
  then
    raise exception 'internal_authorization_required' using errcode = '42501';
  end if;

  insert into public.internal_staff_memberships (
    user_id, role, status, created_by, revoked_at, revoked_by, revocation_reason_code
  ) values (
    p_target_user_id, p_role, p_status, p_actor_user_id,
    case when p_status = 'revoked' then clock_timestamp() end,
    case when p_status = 'revoked' then p_actor_user_id end,
    case when p_status = 'revoked' then 'internal_admin_revoked' end
  )
  on conflict (user_id) do update
    set role = excluded.role,
        status = excluded.status,
        revoked_at = excluded.revoked_at,
        revoked_by = excluded.revoked_by,
        revocation_reason_code = excluded.revocation_reason_code;
end;
$$;

do $portal_function_owners$
declare
  f record;
begin
  for f in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'portal\_%' escape '\'
  loop
    execute format('alter function %I.%I(%s) owner to postgres', f.nspname, f.proname, f.args);
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      f.nspname, f.proname, f.args
    );
  end loop;
end;
$portal_function_owners$;

grant execute on function public.portal_get_account_context(text) to authenticated;
grant execute on function public.portal_get_client_profile(text) to authenticated;
grant execute on function public.portal_list_properties(text, integer) to authenticated;
grant execute on function public.portal_get_property(text, text) to authenticated;
grant execute on function public.portal_list_services(text, integer) to authenticated;
grant execute on function public.portal_get_service(text, text) to authenticated;
grant execute on function public.portal_list_service_requests(text, integer) to authenticated;
grant execute on function public.portal_list_invoices(text, integer) to authenticated;
grant execute on function public.portal_get_invoice(text, text) to authenticated;
grant execute on function public.portal_get_application_status() to authenticated;

grant execute on function public.portal_submit_application_trusted(uuid, text, text, text, text, text, text, uuid)
  to service_role;
grant execute on function public.portal_create_invitation_trusted(uuid, text, text, text, text, timestamptz, text, uuid)
  to service_role;
grant execute on function public.portal_accept_invitation_trusted(uuid, text, text, uuid)
  to service_role;
grant execute on function public.portal_submit_profile_change_trusted(uuid, text, jsonb, text, uuid)
  to service_role;
grant execute on function public.portal_submit_property_change_trusted(uuid, text, text, jsonb, text, uuid)
  to service_role;
grant execute on function public.portal_submit_service_request_trusted(uuid, text, text, text, date, text, text, uuid, text, uuid)
  to service_role;
grant execute on function public.portal_cancel_service_request_trusted(uuid, text, uuid, integer, text, uuid)
  to service_role;
grant execute on function public.portal_revoke_member_trusted(uuid, text, uuid, text, uuid)
  to service_role;
grant execute on function public.portal_get_invoice_download_authorization_trusted(uuid, text, text, uuid, text, uuid)
  to service_role;
grant execute on function public.portal_manage_internal_staff_trusted(uuid, uuid, text, text)
  to service_role;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'invoice-documents',
  'invoice-documents',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No customer policy exists for invoice-documents. Storage service_role signs
-- only the exact object key returned by the trusted authorization RPC.

commit;
