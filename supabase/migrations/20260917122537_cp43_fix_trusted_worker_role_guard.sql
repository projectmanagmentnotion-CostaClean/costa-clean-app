-- CP-4.3C QA repair: current Supabase/PostgREST requests provide JWT claims in
-- request.jwt.claims. Keep compatibility with the legacy role setting, while
-- preserving the existing service-role-only boundary for worker RPCs.
begin;

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

revoke all on function public.portal_claim_invitation_delivery_trusted(uuid, integer) from public, anon, authenticated;
revoke all on function public.portal_finalize_invitation_delivery_trusted(uuid, text, integer, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.portal_claim_invitation_delivery_trusted(uuid, integer) to service_role;
grant execute on function public.portal_finalize_invitation_delivery_trusted(uuid, text, integer, text, text, timestamptz, boolean) to service_role;

commit;
