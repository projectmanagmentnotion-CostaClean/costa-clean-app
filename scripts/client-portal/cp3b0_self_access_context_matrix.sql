\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin;

do $local_only_guard$
begin
  if current_setting('app.cp3b0.local_disposable', true) <> 'true'
    or current_setting('app.cp3b0.project_ref', true) <> 'local-disposable'
  then
    raise exception 'cp3b0_local_disposable_required' using errcode = '42501';
  end if;
end;
$local_only_guard$;

set local session_replication_role = replica;

insert into public.clients (
  id, full_name, phone, email, tax_id, billing_address, status, display_code
) values
  (
    'CP3B0-CLIENT-A', 'CP3B0 Synthetic A', '+34900000101',
    'cp3b0-a@example.invalid', 'CP3B0-TAX-A', 'CP3B0 Address A',
    'active', 'CP3B0-CLIENT-A'
  ),
  (
    'CP3B0-CLIENT-B', 'CP3B0 Synthetic B', '+34900000102',
    'cp3b0-b@example.invalid', 'CP3B0-TAX-B', 'CP3B0 Address B',
    'active', 'CP3B0-CLIENT-B'
  ),
  (
    'CP3B0-CLIENT-C', 'CP3B0 Synthetic C', '+34900000103',
    'cp3b0-c@example.invalid', 'CP3B0-TAX-C', 'CP3B0 Address C',
    'active', 'CP3B0-CLIENT-C'
  );

set local session_replication_role = origin;

insert into public.client_portal_memberships (
  id, user_id, client_id, role, status, revoked_at
) values
  (
    '63000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000004',
    'CP3B0-CLIENT-A', 'client_admin', 'active', null
  ),
  (
    '63000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000005',
    'CP3B0-CLIENT-A', 'client_member', 'active', null
  ),
  (
    '63000000-0000-4000-8000-000000000003',
    '62000000-0000-4000-8000-000000000006',
    'CP3B0-CLIENT-B', 'client_member', 'active', null
  ),
  (
    '63000000-0000-4000-8000-000000000004',
    '62000000-0000-4000-8000-000000000006',
    'CP3B0-CLIENT-A', 'client_admin', 'active', null
  ),
  (
    '63000000-0000-4000-8000-000000000005',
    '62000000-0000-4000-8000-000000000007',
    'CP3B0-CLIENT-A', 'client_member', 'suspended', null
  ),
  (
    '63000000-0000-4000-8000-000000000006',
    '62000000-0000-4000-8000-000000000008',
    'CP3B0-CLIENT-A', 'client_member', 'revoked', clock_timestamp()
  ),
  (
    '63000000-0000-4000-8000-000000000007',
    '62000000-0000-4000-8000-000000000009',
    'CP3B0-CLIENT-A', 'client_member', 'active', null
  ),
  (
    '63000000-0000-4000-8000-000000000008',
    '62000000-0000-4000-8000-000000000009',
    'CP3B0-CLIENT-B', 'client_member', 'suspended', null
  ),
  (
    '63000000-0000-4000-8000-000000000009',
    '62000000-0000-4000-8000-000000000010',
    'CP3B0-CLIENT-C', 'client_admin', 'active', null
  ),
  (
    '63000000-0000-4000-8000-000000000010',
    '62000000-0000-4000-8000-000000000012',
    'CP3B0-CLIENT-A', 'client_member', 'active', null
  );

insert into public.client_portal_applications (
  id, user_id, email_normalized, status, reviewed_by, reviewed_at,
  approved_client_id, privacy_notice_version
) values
  (
    '64000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000002',
    'cp3b0-pending@example.invalid', 'pending_review', null, null, null,
    'cp3b0-local'
  ),
  (
    '64000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000003',
    'cp3b0-other@example.invalid', 'pending_review', null, null, null,
    'cp3b0-local'
  ),
  (
    '64000000-0000-4000-8000-000000000003',
    '62000000-0000-4000-8000-000000000010',
    'cp3b0-active-pending@example.invalid', 'pending_review', null, null, null,
    'cp3b0-local'
  ),
  (
    '64000000-0000-4000-8000-000000000004',
    '62000000-0000-4000-8000-000000000011',
    'cp3b0-approved@example.invalid', 'approved',
    '10000000-0000-4000-8000-000000000001', clock_timestamp(),
    'CP3B0-CLIENT-A', 'cp3b0-local'
  );

set local role anon;

do $anon_denied$
begin
  begin
    perform public.portal_resolve_self_access_context();
    raise exception 'anon_execute_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;
end;
$anon_denied$;

reset role;

set local role authenticated;

do $matrix$
declare
  v_result jsonb;
  v_membership jsonb;
  v_forbidden_key text;
begin
  if has_function_privilege(
    'anon',
    'public.portal_resolve_self_access_context()',
    'EXECUTE'
  ) then
    raise exception 'anon_execute_grant_present';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.portal_resolve_self_access_context()',
    'EXECUTE'
  ) then
    raise exception 'authenticated_execute_grant_missing';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000001',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result <> jsonb_build_object(
    'state', 'authenticated_without_access',
    'selectedClientId', null,
    'memberships', '[]'::jsonb,
    'applicationStatus', null
  ) then
    raise exception 'without_access_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000002',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'pending_review'
    or v_result ->> 'applicationStatus' <> 'pending_review'
    or jsonb_array_length(v_result -> 'memberships') <> 0
  then
    raise exception 'pending_review_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000001',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or v_result ->> 'applicationStatus' is not null
  then
    raise exception 'cross_user_application_exposed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000004',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  v_membership := v_result -> 'memberships' -> 0;
  if v_result ->> 'state' <> 'active_member'
    or v_result ->> 'selectedClientId' <> 'CP3B0-CLIENT-A'
    or jsonb_array_length(v_result -> 'memberships') <> 1
    or v_membership ->> 'role' <> 'client_admin'
    or v_membership ->> 'status' <> 'active'
  then
    raise exception 'active_admin_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000005',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result -> 'memberships' -> 0 ->> 'role' <> 'client_member'
  then
    raise exception 'active_member_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000006',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'client_selection_required'
    or v_result -> 'selectedClientId' <> 'null'::jsonb
    or jsonb_array_length(v_result -> 'memberships') <> 2
    or v_result -> 'memberships' -> 0 ->> 'clientId' <> 'CP3B0-CLIENT-A'
    or v_result -> 'memberships' -> 1 ->> 'clientId' <> 'CP3B0-CLIENT-B'
  then
    raise exception 'multi_client_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000007',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'suspended'
    or jsonb_array_length(v_result -> 'memberships') <> 0
    or v_result -> 'selectedClientId' <> 'null'::jsonb
  then
    raise exception 'suspended_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000008',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'revoked'
    or jsonb_array_length(v_result -> 'memberships') <> 0
    or v_result -> 'selectedClientId' <> 'null'::jsonb
  then
    raise exception 'revoked_contract_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000009',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result ->> 'selectedClientId' <> 'CP3B0-CLIENT-A'
    or jsonb_array_length(v_result -> 'memberships') <> 1
  then
    raise exception 'active_over_suspended_precedence_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000010',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result ->> 'selectedClientId' <> 'CP3B0-CLIENT-C'
    or v_result ->> 'applicationStatus' <> 'pending_review'
  then
    raise exception 'active_over_pending_precedence_failed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000011',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or v_result ->> 'applicationStatus' <> 'approved'
  then
    raise exception 'approved_without_membership_not_closed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000012',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or jsonb_array_length(v_result -> 'memberships') <> 0
  then
    raise exception 'unverified_active_membership_exposed: %', v_result;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or jsonb_array_length(v_result -> 'memberships') <> 0
  then
    raise exception 'internal_staff_became_portal_member: %', v_result;
  end if;

  for v_forbidden_key in
    select value
    from jsonb_array_elements_text(
      '["email","name","phone","address","taxId","tax_id","metadata","token","reason"]'::jsonb
    )
  loop
    if v_result ? v_forbidden_key then
      raise exception 'forbidden_top_level_key_returned: %', v_forbidden_key;
    end if;
  end loop;

  perform set_config(
    'request.jwt.claim.sub',
    '62000000-0000-4000-8000-000000000006',
    true
  );
  v_result := public.portal_resolve_self_access_context();
  for v_membership in
    select value from jsonb_array_elements(v_result -> 'memberships')
  loop
    if (
      select array_agg(key order by key)
      from jsonb_object_keys(v_membership) as key
    ) <> array['clientId', 'membershipId', 'role', 'status']::text[]
    then
      raise exception 'membership_shape_not_minimal: %', v_membership;
    end if;
  end loop;
end;
$matrix$;

reset role;

rollback;

select jsonb_build_object(
  'result', 'PASS',
  'states', 6,
  'anonExecute', 'DENIED',
  'authenticatedExecute', 'GRANTED',
  'piiFields', 0,
  'crossUserLeaks', 0,
  'fixtureResidue', 0
) as cp3b0_self_access_matrix;
