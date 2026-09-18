-- CP-4.3C canonical forward-only reconciliation.
-- This is not a reconstruction or repair of QA migration history.
-- It excludes QA certifiers, pg_net, temporary fixtures, and marker migrations.
begin;

do $preflight$
declare
  v_outbox_exists boolean := to_regclass('public.portal_invitation_delivery_outbox') is not null;
  v_payload_exists boolean := to_regclass('public.portal_invitation_delivery_payloads') is not null;
  v_audit_constraint text;
  v_existing_event text;
  v_expected_events text[] := array['application_submitted', 'application_approved', 'application_rejected', 'invitation_created', 'invitation_accepted', 'invitation_revoked', 'invitation_expired', 'membership_created', 'membership_role_changed', 'membership_suspended', 'membership_revoked', 'profile_change_requested', 'profile_change_resolved', 'property_change_requested', 'property_change_resolved', 'service_request_submitted', 'service_request_transitioned', 'service_request_cancelled', 'invoice_download_allowed', 'invoice_download_denied', 'account_recovery_requested', 'account_security_changed', 'mfa_changed', 'marketing_preference_changed', 'invitation_delivery_provider_accepted', 'invitation_delivery_retry_scheduled', 'invitation_delivery_blocked', 'invitation_delivery_terminal_failed'];
begin
  if v_outbox_exists <> v_payload_exists then
    raise exception 'cp43_canonical_partial_delivery_schema';
  end if;

  if v_outbox_exists and exists (
    select 1
    from (
      values
        ('id', 'uuid', 'NO'),
        ('invitation_id', 'uuid', 'NO'),
        ('provider', 'text', 'NO'),
        ('idempotency_key', 'text', 'NO'),
        ('correlation_id', 'uuid', 'NO'),
        ('status', 'text', 'NO'),
        ('attempt_count', 'integer', 'NO'),
        ('next_attempt_at', 'timestamp with time zone', 'NO'),
        ('lease_expires_at', 'timestamp with time zone', 'YES'),
        ('provider_message_id', 'text', 'YES'),
        ('last_provider_code', 'text', 'YES'),
        ('created_at', 'timestamp with time zone', 'NO'),
        ('updated_at', 'timestamp with time zone', 'NO')
    ) as expected(column_name, data_type, is_nullable)
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = 'portal_invitation_delivery_outbox'
     and actual.column_name = expected.column_name
    where actual.column_name is null
       or actual.data_type <> expected.data_type
       or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'cp43_canonical_outbox_schema_incompatible';
  end if;

  if v_outbox_exists and (
    (select count(*) from pg_constraint
      where conrelid = 'public.portal_invitation_delivery_outbox'::regclass
        and conname in (
          'portal_invitation_delivery_outbox_attempt_count_check',
          'portal_invitation_delivery_outbox_check',
          'portal_invitation_delivery_outbox_check1',
          'portal_invitation_delivery_outbox_idempotency_key_check',
          'portal_invitation_delivery_outbox_idempotency_key_key',
          'portal_invitation_delivery_outbox_invitation_id_fkey',
          'portal_invitation_delivery_outbox_invitation_id_key',
          'portal_invitation_delivery_outbox_pkey',
          'portal_invitation_delivery_outbox_provider_check',
          'portal_invitation_delivery_outbox_status_check'
        )) <> 10
    or (select count(*) from pg_indexes
      where schemaname = 'public'
        and tablename = 'portal_invitation_delivery_outbox'
        and indexname in (
          'portal_invitation_delivery_outbox_idempotency_key_key',
          'portal_invitation_delivery_outbox_invitation_id_key',
          'portal_invitation_delivery_outbox_pkey',
          'portal_invitation_delivery_outbox_ready_idx'
        )) <> 4
    or not (select relrowsecurity and relforcerowsecurity
      from pg_class where oid = 'public.portal_invitation_delivery_outbox'::regclass)
  ) then
    raise exception 'cp43_canonical_outbox_contract_incompatible';
  end if;

  if v_payload_exists and exists (
    select 1
    from (
      values
        ('invitation_id', 'uuid', 'NO'),
        ('ciphertext', 'text', 'NO'),
        ('nonce', 'text', 'NO'),
        ('key_version', 'text', 'NO'),
        ('created_at', 'timestamp with time zone', 'NO'),
        ('expires_at', 'timestamp with time zone', 'NO')
    ) as expected(column_name, data_type, is_nullable)
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = 'portal_invitation_delivery_payloads'
     and actual.column_name = expected.column_name
    where actual.column_name is null
       or actual.data_type <> expected.data_type
       or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'cp43_canonical_payload_schema_incompatible';
  end if;

  if v_payload_exists and (
    (select count(*) from pg_constraint
      where conrelid = 'public.portal_invitation_delivery_payloads'::regclass
        and conname in (
          'portal_invitation_delivery_payloads_check',
          'portal_invitation_delivery_payloads_ciphertext_check',
          'portal_invitation_delivery_payloads_invitation_id_fkey',
          'portal_invitation_delivery_payloads_key_version_check',
          'portal_invitation_delivery_payloads_nonce_check',
          'portal_invitation_delivery_payloads_pkey'
        )) <> 6
    or (select count(*) from pg_indexes
      where schemaname = 'public'
        and tablename = 'portal_invitation_delivery_payloads'
        and indexname in (
          'portal_invitation_delivery_payloads_expiry_idx',
          'portal_invitation_delivery_payloads_pkey'
        )) <> 2
    or not (select relrowsecurity and relforcerowsecurity
      from pg_class where oid = 'public.portal_invitation_delivery_payloads'::regclass)
  ) then
    raise exception 'cp43_canonical_payload_contract_incompatible';
  end if;

  if to_regclass('public.client_portal_invitations') is null
    or to_regclass('public.client_portal_audit_events') is null then
    raise exception 'cp43_canonical_portal_baseline_required';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'cp43_canonical_requires_pg_cron';
  end if;

  select pg_get_constraintdef(c.oid, true)
    into v_audit_constraint
  from pg_constraint c
  where c.conrelid = 'public.client_portal_audit_events'::regclass
    and c.conname = 'client_portal_audit_events_event_type_check';

  if v_audit_constraint is null then
    raise exception 'cp43_canonical_audit_constraint_missing';
  end if;

  for v_existing_event in
    select distinct match[1]
    from regexp_matches(v_audit_constraint, '''([^'']+)''', 'g') as match
  loop
    if not v_existing_event = any(v_expected_events) then
      raise exception 'cp43_canonical_audit_constraint_incompatible';
    end if;
  end loop;

  if exists (
    select 1 from public.client_portal_audit_events
    where event_type <> all(v_expected_events)
  ) then
    raise exception 'cp43_canonical_audit_data_incompatible';
  end if;
end;
$preflight$;

-- CP-4.3C invitation delivery state. The outbox deliberately holds no
-- recipient, invite URL or raw token material.
create table if not exists public.portal_invitation_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.client_portal_invitations(id) on delete restrict,
  provider text not null check (provider in ('brevo')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 160),
  correlation_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'provider_accepted', 'retry_scheduled', 'blocked', 'terminal_failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz,
  provider_message_id text,
  last_provider_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status in ('queued', 'retry_scheduled') and next_attempt_at is not null)
    or status not in ('queued', 'retry_scheduled')
  ),
  check (
    (status = 'provider_accepted' and provider_message_id is not null)
    or status <> 'provider_accepted'
  )
);

create index if not exists portal_invitation_delivery_outbox_ready_idx
  on public.portal_invitation_delivery_outbox (status, next_attempt_at)
  where status in ('queued', 'retry_scheduled');

alter table public.portal_invitation_delivery_outbox enable row level security;
alter table public.portal_invitation_delivery_outbox force row level security;

revoke all on table public.portal_invitation_delivery_outbox from public, anon, authenticated;
grant select, insert, update on table public.portal_invitation_delivery_outbox to service_role;

create table if not exists public.portal_invitation_delivery_payloads (
  invitation_id uuid primary key references public.client_portal_invitations(id) on delete restrict,
  ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9_-]{32,512}$'),
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  key_version text not null check (key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index if not exists portal_invitation_delivery_payloads_expiry_idx
  on public.portal_invitation_delivery_payloads (expires_at);

alter table public.portal_invitation_delivery_payloads enable row level security;
alter table public.portal_invitation_delivery_payloads force row level security;
revoke all on table public.portal_invitation_delivery_payloads from public, anon, authenticated;
grant select, insert, update, delete on table public.portal_invitation_delivery_payloads to service_role;



create or replace function portal_private.clear_invitation_delivery_payload()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'pending' then
    delete from public.portal_invitation_delivery_payloads where invitation_id = new.id;
    update public.portal_invitation_delivery_outbox
    set status = 'blocked',
        lease_expires_at = null,
        last_provider_code = 'invitation_unavailable',
        updated_at = clock_timestamp()
    where invitation_id = new.id
      and status in ('queued', 'leased', 'retry_scheduled');
  end if;
  return new;
end;
$$;

drop trigger if exists clear_invitation_delivery_payload_after_status_change
  on public.client_portal_invitations;
create trigger clear_invitation_delivery_payload_after_status_change
after update of status on public.client_portal_invitations
for each row
when (old.status is distinct from new.status)
execute function portal_private.clear_invitation_delivery_payload();

revoke all on function portal_private.clear_invitation_delivery_payload() from public, anon, authenticated;

create or replace function public.portal_create_invitation_delivery_trusted(
  p_invitation_id uuid,
  p_actor_user_id uuid,
  p_client_id text,
  p_email_normalized text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_payload_ciphertext text,
  p_payload_nonce text,
  p_payload_key_version text,
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
begin
  if portal_private.is_active_internal_staff(p_actor_user_id) then
    v_membership_id := null;
  else
    v_membership_id := portal_private.assert_trusted_actor_membership(
      p_actor_user_id, p_client_id, array['client_admin']::text[]
    );
  end if;
  if p_invitation_id is null
    or p_email_normalized is null
    or p_role not in ('client_admin', 'client_member')
    or p_email_normalized <> lower(btrim(p_email_normalized))
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '7 days'
    or char_length(coalesce(p_payload_ciphertext, '')) not between 32 and 512
    or coalesce(p_payload_ciphertext, '') !~ '^[A-Za-z0-9_-]+$'
    or coalesce(p_payload_nonce, '') !~ '^[A-Za-z0-9_-]{16,64}$'
    or coalesce(p_payload_key_version, '') !~ '^[A-Za-z0-9._-]{1,64}$'
  then
    raise exception 'invalid_invitation' using errcode = '22023';
  end if;
  if not portal_private.consume_rate_limit(
    'member_invitation', p_rate_limit_subject_hash, 10, 3600
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.client_portal_invitations (
    id, client_id, email_normalized, role, token_hash, expires_at, invited_by
  ) values (
    p_invitation_id, p_client_id, p_email_normalized, p_role, p_token_hash, p_expires_at, p_actor_user_id
  );
  insert into public.portal_invitation_delivery_outbox (
    invitation_id, provider, idempotency_key, correlation_id
  ) values (
    p_invitation_id, 'brevo', 'portal-invitation:' || p_invitation_id::text, p_correlation_id
  );
  insert into public.portal_invitation_delivery_payloads (
    invitation_id, ciphertext, nonce, key_version, expires_at
  ) values (
    p_invitation_id, p_payload_ciphertext, p_payload_nonce, p_payload_key_version, p_expires_at
  );
  perform portal_private.write_audit_event(
    'invitation_created', 'completed', p_actor_user_id, v_membership_id, p_client_id,
    'invitation', p_invitation_id, p_correlation_id, null, null,
    jsonb_build_object('role', p_role, 'delivery', 'queued')
  );
  return p_invitation_id;
end;
$$;

create or replace function public.portal_claim_invitation_delivery_trusted(
  p_invitation_id uuid default null,
  p_lease_seconds integer default 120
)
returns table (
  invitation_id uuid,
  recipient text,
  expires_at timestamptz,
  idempotency_key text,
  correlation_id uuid,
  attempt_count integer,
  ciphertext text,
  nonce text,
  key_version text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_outbox public.portal_invitation_delivery_outbox%rowtype;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role'
    or p_lease_seconds is null
    or p_lease_seconds not between 30 and 300 then
    raise exception 'delivery_worker_denied' using errcode = '42501';
  end if;

  update public.portal_invitation_delivery_outbox
  set status = 'blocked', lease_expires_at = null, last_provider_code = 'delivery_outcome_unknown', updated_at = clock_timestamp()
  where status = 'leased' and lease_expires_at <= clock_timestamp();
  update public.portal_invitation_delivery_outbox o
  set status = 'blocked', lease_expires_at = null, last_provider_code = 'invitation_unavailable', updated_at = clock_timestamp()
  from public.client_portal_invitations i
  where i.id = o.invitation_id
    and o.status in ('queued', 'retry_scheduled')
    and (i.status <> 'pending' or i.expires_at <= clock_timestamp());
  update public.portal_invitation_delivery_outbox
  set status = 'terminal_failed',
      lease_expires_at = null,
      last_provider_code = 'delivery_attempt_limit_reached',
      updated_at = clock_timestamp()
  where status in ('queued', 'retry_scheduled')
    and attempt_count >= 5;
  delete from public.portal_invitation_delivery_payloads p
  using public.portal_invitation_delivery_outbox o, public.client_portal_invitations i
  where p.invitation_id = o.invitation_id
    and i.id = o.invitation_id
    and o.status in ('blocked', 'terminal_failed')
    and (o.status = 'terminal_failed' or o.last_provider_code = 'delivery_outcome_unknown' or i.status <> 'pending' or i.expires_at <= clock_timestamp());

  select o.* into v_outbox
  from public.portal_invitation_delivery_outbox o
  join public.portal_invitation_delivery_payloads p on p.invitation_id = o.invitation_id
  join public.client_portal_invitations i on i.id = o.invitation_id
  where o.status in ('queued', 'retry_scheduled')
    and (p_invitation_id is null or o.invitation_id = p_invitation_id)
    and o.attempt_count < 5
    and o.next_attempt_at <= clock_timestamp()
    and p.expires_at > clock_timestamp()
    and i.status = 'pending'
    and i.expires_at > clock_timestamp()
  order by o.next_attempt_at, o.created_at
  for update of o skip locked
  limit 1;
  if v_outbox.id is null then return; end if;

  update public.portal_invitation_delivery_outbox
  set status = 'leased', lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds), updated_at = clock_timestamp()
  where id = v_outbox.id;

  return query
  select o.invitation_id, i.email_normalized, i.expires_at, o.idempotency_key, o.correlation_id,
    o.attempt_count, p.ciphertext, p.nonce, p.key_version
  from public.portal_invitation_delivery_outbox o
  join public.client_portal_invitations i on i.id = o.invitation_id
  join public.portal_invitation_delivery_payloads p on p.invitation_id = o.invitation_id
  where o.id = v_outbox.id;
end;
$$;

create or replace function public.portal_finalize_invitation_delivery_trusted(
  p_invitation_id uuid,
  p_status text,
  p_attempt_count integer,
  p_provider_message_id text,
  p_provider_code text,
  p_next_attempt_at timestamptz,
  p_destroy_payload boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_outbox public.portal_invitation_delivery_outbox%rowtype;
  v_client_id text;
  v_actor_user_id uuid;
  v_correlation_id uuid;
  v_destroy_payload boolean;
  v_retry_payload_available boolean;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role'
    or p_invitation_id is null
    or p_status is null
    or p_attempt_count is null
    or p_destroy_payload is null
    or p_status not in ('provider_accepted', 'retry_scheduled', 'blocked', 'terminal_failed')
    or p_attempt_count < 1
    or p_attempt_count > 5
    or (p_status = 'retry_scheduled' and p_attempt_count >= 5)
    or (p_status = 'provider_accepted' and nullif(btrim(p_provider_message_id), '') is null)
    or (p_status = 'retry_scheduled' and p_next_attempt_at is null)
    or (p_status = 'retry_scheduled' and p_next_attempt_at <= clock_timestamp())
    or (p_status <> 'retry_scheduled' and p_next_attempt_at is not null)
  then
    raise exception 'delivery_worker_denied' using errcode = '42501';
  end if;

  select o.* into v_outbox
  from public.portal_invitation_delivery_outbox o
  where o.invitation_id = p_invitation_id
    and o.status = 'leased'
  for update of o;
  if v_outbox.id is null then
    raise exception 'delivery_lease_unavailable' using errcode = 'P0002';
  end if;
  if p_attempt_count <> v_outbox.attempt_count + 1 then
    raise exception 'delivery_attempt_count_invalid' using errcode = '22023';
  end if;

  v_destroy_payload := p_status in ('provider_accepted', 'blocked', 'terminal_failed');
  if p_destroy_payload is distinct from v_destroy_payload then
    raise exception 'delivery_payload_policy_invalid' using errcode = '22023';
  end if;
  if p_status = 'retry_scheduled' then
    select exists (
      select 1
      from public.portal_invitation_delivery_payloads p
      join public.client_portal_invitations i on i.id = p.invitation_id
      where p.invitation_id = p_invitation_id
        and p.expires_at > clock_timestamp()
        and i.status = 'pending'
        and i.expires_at > clock_timestamp()
    ) into v_retry_payload_available;
    if not v_retry_payload_available then
      raise exception 'delivery_retry_payload_unavailable' using errcode = 'P0002';
    end if;
  end if;

  update public.portal_invitation_delivery_outbox
  set status = p_status,
      attempt_count = p_attempt_count,
      provider_message_id = nullif(btrim(p_provider_message_id), ''),
      last_provider_code = nullif(btrim(p_provider_code), ''),
      next_attempt_at = case when p_status = 'retry_scheduled' then p_next_attempt_at else next_attempt_at end,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where id = v_outbox.id;
  if v_destroy_payload then
    delete from public.portal_invitation_delivery_payloads where invitation_id = p_invitation_id;
  end if;
  select i.client_id, i.invited_by, o.correlation_id
    into v_client_id, v_actor_user_id, v_correlation_id
  from public.client_portal_invitations i
  join public.portal_invitation_delivery_outbox o on o.invitation_id = i.id
  where i.id = p_invitation_id;
  perform portal_private.write_audit_event(
    'invitation_delivery_' || p_status,
    case when p_status = 'provider_accepted' then 'completed' else 'blocked' end,
    v_actor_user_id, null, v_client_id, 'invitation', p_invitation_id,
    v_correlation_id, null, null,
    jsonb_build_object(
      'attemptCount', p_attempt_count,
      'providerCode', nullif(btrim(p_provider_code), ''),
      'hasProviderMessageId', nullif(btrim(p_provider_message_id), '') is not null
    )
  );
end;
$$;

create or replace function portal_private.cleanup_expired_invitation_delivery_payloads()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted_count integer;
begin
  update public.portal_invitation_delivery_outbox o
  set status = 'blocked',
      lease_expires_at = null,
      last_provider_code = 'invitation_unavailable',
      updated_at = clock_timestamp()
  from public.client_portal_invitations i
  where i.id = o.invitation_id
    and o.status in ('queued', 'leased', 'retry_scheduled')
    and (i.status <> 'pending' or i.expires_at <= clock_timestamp());

  delete from public.portal_invitation_delivery_payloads p
  using public.client_portal_invitations i
  where i.id = p.invitation_id
    and (p.expires_at <= clock_timestamp() or i.status <> 'pending' or i.expires_at <= clock_timestamp());
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke all on function portal_private.cleanup_expired_invitation_delivery_payloads() from public, anon, authenticated;

revoke all on function public.portal_create_invitation_delivery_trusted(uuid, uuid, text, text, text, text, timestamptz, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.portal_claim_invitation_delivery_trusted(uuid, integer) from public, anon, authenticated;
revoke all on function public.portal_finalize_invitation_delivery_trusted(uuid, text, integer, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.portal_create_invitation_delivery_trusted(uuid, uuid, text, text, text, text, timestamptz, text, text, text, text, uuid) to service_role;
grant execute on function public.portal_claim_invitation_delivery_trusted(uuid, integer) to service_role;
grant execute on function public.portal_finalize_invitation_delivery_trusted(uuid, text, integer, text, text, timestamptz, boolean) to service_role;

alter table public.client_portal_audit_events
  drop constraint client_portal_audit_events_event_type_check;
alter table public.client_portal_audit_events
  add constraint client_portal_audit_events_event_type_check
  check (event_type in (
    'application_submitted',
    'application_approved',
    'application_rejected',
    'invitation_created',
    'invitation_accepted',
    'invitation_revoked',
    'invitation_expired',
    'membership_created',
    'membership_role_changed',
    'membership_suspended',
    'membership_revoked',
    'profile_change_requested',
    'profile_change_resolved',
    'property_change_requested',
    'property_change_resolved',
    'service_request_submitted',
    'service_request_transitioned',
    'service_request_cancelled',
    'invoice_download_allowed',
    'invoice_download_denied',
    'account_recovery_requested',
    'account_security_changed',
    'mfa_changed',
    'marketing_preference_changed',
    'invitation_delivery_provider_accepted',
    'invitation_delivery_retry_scheduled',
    'invitation_delivery_blocked',
    'invitation_delivery_terminal_failed'
  ));

do $scheduler$
declare
  v_job_count integer;
begin
  select count(*) into v_job_count
  from cron.job
  where jobname = 'cp43-expired-invitation-delivery-payload-cleanup';

  if v_job_count > 1 then
    raise exception 'cp43_canonical_cleanup_schedule_ambiguous';
  end if;

  if v_job_count = 1 and exists (
    select 1
    from cron.job
    where jobname = 'cp43-expired-invitation-delivery-payload-cleanup'
      and (
        schedule <> '*/15 * * * *'
        or command <> 'select portal_private.cleanup_expired_invitation_delivery_payloads()'
        or not active
      )
  ) then
    raise exception 'cp43_canonical_cleanup_schedule_incompatible';
  end if;

  if v_job_count = 0 then
    perform cron.schedule(
      'cp43-expired-invitation-delivery-payload-cleanup',
      '*/15 * * * *',
      $command$select portal_private.cleanup_expired_invitation_delivery_payloads()$command$
    );
  end if;
end;
$scheduler$;

commit;
