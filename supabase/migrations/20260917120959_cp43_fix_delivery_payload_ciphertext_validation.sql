-- CP-4.3C QA repair: PostgreSQL regex bounds permit values only through 255.
-- Keep the 512-character ciphertext contract by separating length validation
-- from the Base64URL alphabet check. This replaces no tables, data, policies,
-- grants, or delivery state.
begin;

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

revoke all on function public.portal_create_invitation_delivery_trusted(uuid, uuid, text, text, text, text, timestamptz, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_create_invitation_delivery_trusted(uuid, uuid, text, text, text, text, timestamptz, text, text, text, text, uuid) to service_role;

commit;
