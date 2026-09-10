-- CP-3B.5D: safe member reads and account-scoped marketing preferences.
-- QA-only application is authorized by CP-3B.5D. No fixture data is inserted.

begin;

alter table public.client_portal_consents
  alter column application_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.client_portal_consents'::regclass
      and conname = 'client_portal_consents_context_check'
  ) then
    alter table public.client_portal_consents
      add constraint client_portal_consents_context_check
      check (application_id is not null or client_id is not null);
  end if;
end;
$$;

create unique index if not exists client_portal_consents_user_client_purpose_v1_idx
  on public.client_portal_consents (user_id, client_id, purpose)
  where client_id is not null;

alter table public.client_portal_audit_events
  drop constraint if exists client_portal_audit_events_event_type_check;

alter table public.client_portal_audit_events
  add constraint client_portal_audit_events_event_type_check
  check (event_type in (
    'application_submitted', 'application_approved', 'application_rejected',
    'invitation_created', 'invitation_accepted', 'invitation_revoked', 'invitation_expired',
    'membership_created', 'membership_role_changed', 'membership_suspended', 'membership_revoked',
    'profile_change_requested', 'profile_change_resolved',
    'property_change_requested', 'property_change_resolved',
    'service_request_submitted', 'service_request_transitioned', 'service_request_cancelled',
    'invoice_download_allowed', 'invoice_download_denied',
    'account_recovery_requested', 'account_security_changed', 'mfa_changed',
    'marketing_preference_changed'
  ));

create or replace function public.portal_list_members_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_actor_role text;
begin
  select m.role into v_actor_role
  from public.client_portal_memberships m
  where m.user_id = p_actor_user_id
    and m.client_id = p_client_id
    and m.status = 'active'
    and m.revoked_at is null;

  if v_actor_role is null then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  if not portal_private.consume_rate_limit('member_list', p_rate_limit_subject_hash, 60, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'membershipId', m.id,
      'displayName', null,
      'email', lower(u.email),
      'role', m.role,
      'status', m.status,
      'isSelf', m.user_id = p_actor_user_id
    ) order by m.created_at, m.id)
    from public.client_portal_memberships m
    join auth.users u on u.id = m.user_id
    where m.client_id = p_client_id
      and m.status = 'active'
      and m.revoked_at is null
      and (v_actor_role = 'client_admin' or m.user_id = p_actor_user_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_list_pending_invitations_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  if not exists (
    select 1 from public.client_portal_memberships m
    where m.user_id = p_actor_user_id
      and m.client_id = p_client_id
      and m.role = 'client_admin'
      and m.status = 'active'
      and m.revoked_at is null
  ) then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  if not portal_private.consume_rate_limit('invitation_list', p_rate_limit_subject_hash, 60, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'email', i.email_normalized,
      'role', i.role,
      'status', i.status,
      'expiresAt', i.expires_at,
      'invitationRef', i.id
    ) order by i.created_at desc)
    from public.client_portal_invitations i
    where i.client_id = p_client_id
      and i.status = 'pending'
      and i.expires_at > clock_timestamp()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_get_marketing_preference_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_locale text,
  p_rate_limit_subject_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_consent public.client_portal_consents%rowtype;
begin
  perform portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );
  select * into v_consent
  from public.client_portal_consents c
  where c.user_id = p_actor_user_id
    and c.client_id = p_client_id
    and c.purpose = 'marketing'
  order by c.created_at desc
  limit 1;

  return jsonb_build_object(
    'enabled', coalesce(v_consent.status = 'granted', false),
    'status', coalesce(v_consent.status, 'withdrawn'),
    'version', v_consent.version,
    'textReference', v_consent.text_reference,
    'updatedAt', coalesce(v_consent.consented_at, v_consent.withdrawn_at, v_consent.created_at)
  );
end;
$$;

create or replace function public.portal_set_marketing_preference_trusted(
  p_actor_user_id uuid,
  p_client_id text,
  p_enabled boolean,
  p_locale text,
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
  v_document public.client_portal_consent_documents%rowtype;
  v_status text := case when p_enabled then 'granted' else 'withdrawn' end;
  v_now timestamptz := clock_timestamp();
begin
  v_membership_id := portal_private.assert_trusted_actor_membership(
    p_actor_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );
  if not portal_private.consume_rate_limit('marketing_preference', p_rate_limit_subject_hash, 20, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if p_locale !~ '^[a-z]{2}(-[A-Z]{2})?$' then
    raise exception 'invalid_preference' using errcode = '22023';
  end if;

  select * into v_document
  from public.client_portal_consent_documents d
  where d.purpose = 'marketing'
    and d.locale = p_locale
    and d.status = 'active'
  limit 1;
  if v_document.id is null then
    raise exception 'marketing_consent_unavailable' using errcode = 'P0001';
  end if;

  insert into public.client_portal_consents (
    user_id, application_id, client_id, purpose, status, version, text_reference,
    source, consented_at, withdrawn_at, correlation_id
  ) values (
    p_actor_user_id, null, p_client_id, 'marketing', v_status,
    v_document.document_version, v_document.text_reference, 'portal_account_preferences',
    case when p_enabled then v_now end, case when not p_enabled then v_now end, p_correlation_id
  )
  on conflict (user_id, client_id, purpose) where client_id is not null do update set
    status = excluded.status,
    version = excluded.version,
    text_reference = excluded.text_reference,
    source = excluded.source,
    consented_at = excluded.consented_at,
    withdrawn_at = excluded.withdrawn_at,
    correlation_id = excluded.correlation_id;

  perform portal_private.write_audit_event(
    'marketing_preference_changed', 'completed', p_actor_user_id, v_membership_id,
    p_client_id, 'marketing_preference', null, p_correlation_id, null, null,
    jsonb_build_object('enabled', p_enabled)
  );
  return jsonb_build_object(
    'enabled', p_enabled,
    'status', v_status,
    'version', v_document.document_version,
    'textReference', v_document.text_reference,
    'updatedAt', v_now
  );
end;
$$;

revoke all on function public.portal_list_members_trusted(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_list_members_trusted(uuid, text, text, uuid) to service_role;
revoke all on function public.portal_list_pending_invitations_trusted(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_list_pending_invitations_trusted(uuid, text, text, uuid) to service_role;
revoke all on function public.portal_get_marketing_preference_trusted(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_get_marketing_preference_trusted(uuid, text, text, text, uuid) to service_role;
revoke all on function public.portal_set_marketing_preference_trusted(uuid, text, boolean, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_set_marketing_preference_trusted(uuid, text, boolean, text, text, uuid) to service_role;

commit;
