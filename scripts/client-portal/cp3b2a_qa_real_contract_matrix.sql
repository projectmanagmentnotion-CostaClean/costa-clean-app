begin transaction;

set local statement_timeout = '30s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

create or replace function pg_temp.assert_true(condition boolean, label text)
returns void
language plpgsql
as $$
begin
  if not condition then
    raise exception using message = label, errcode = 'P0001';
  end if;
end;
$$;

create or replace function pg_temp.expect_error(
  sql_text text,
  expected_sqlstate text,
  expected_message text default null,
  label text default null
)
returns void
language plpgsql
as $$
declare
  v_sqlstate text;
  v_message text;
begin
  execute sql_text;
  raise exception using message = coalesce(label, 'unexpected_success'), errcode = 'P0001';
exception
  when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_message = message_text;
    if v_sqlstate <> expected_sqlstate then
      raise exception using message = coalesce(label, 'sqlstate_mismatch') || ':' || v_sqlstate, errcode = 'P0001';
    end if;
    if expected_message is not null and position(expected_message in coalesce(v_message, '')) = 0 then
      raise exception using message = coalesce(label, 'message_mismatch') || ':' || coalesce(v_message, ''), errcode = 'P0001';
    end if;
end;
$$;

create or replace function pg_temp.assert_json_keys(value jsonb, expected text[], label text)
returns void
language plpgsql
as $$
declare
  actual text[];
begin
  select array_agg(k order by k) into actual
  from jsonb_object_keys(coalesce(value, '{}'::jsonb)) as k;
  if actual is distinct from expected then
    raise exception using message = label || ':' || coalesce(array_to_string(actual, ','), '<null>'), errcode = 'P0001';
  end if;
end;
$$;

create or replace function pg_temp.set_auth_context(user_id uuid)
returns void
language plpgsql
as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

do $cp3b2a_matrix$
declare
  v_run_id text := coalesce(current_setting('app.cp3b2a.run_id', true), 'CP3B2A-REAL-MATRIX');
  v_project_ref text := current_setting('app.cp3b2a.project_ref', true);
  v_staff_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
  v_member_id uuid := gen_random_uuid();
  v_suspended_id uuid := gen_random_uuid();
  v_revoked_id uuid := gen_random_uuid();
  v_outsider_id uuid := gen_random_uuid();
  v_no_membership_id uuid := gen_random_uuid();
  v_client_a text := v_run_id || '-CLIENT-A';
  v_client_b text := v_run_id || '-CLIENT-B';
  v_property_a1 text := v_run_id || '-PROP-A1';
  v_property_a2 text := v_run_id || '-PROP-A2';
  v_property_archived text := v_run_id || '-PROP-ARCHIVED';
  v_property_deleted text := v_run_id || '-PROP-DELETED';
  v_profile_key uuid := gen_random_uuid();
  v_profile_second_key uuid := gen_random_uuid();
  v_property_key uuid := gen_random_uuid();
  v_property_second_key uuid := gen_random_uuid();
  v_profile_receipt jsonb;
  v_profile_retry jsonb;
  v_property_receipt jsonb;
  v_property_retry jsonb;
  v_profile_list jsonb;
  v_property_list jsonb;
  v_payload jsonb;
  v_expected_receipt_keys text[] := array['changedFields','reference','requestedAt','requestType','status'];
  v_expected_list_keys text[] := array['changedFields','reference','requestedAt','requestType','resolvedAt','status'];
  v_profile_invalid_payloads jsonb[] := ARRAY[
    NULL::jsonb,
    '{}'::jsonb,
    '{"unknown":"x"}'::jsonb,
    '{"clientId":"x"}'::jsonb,
    '{"id":"x"}'::jsonb,
    '{"fullName":123}'::jsonb,
    '{"fullName":""}'::jsonb,
    '{"fullName":"<tag>"}'::jsonb,
    ('{"fullName":"' || repeat('A', 201) || '"}')::jsonb,
    ('{"phone":"' || repeat('1', 41) || '"}')::jsonb,
    '{"email":"invalid"}'::jsonb,
    ('{"taxId":"' || repeat('T', 81) || '"}')::jsonb,
    ('{"billingAddress":"' || repeat('B', 321) || '"}')::jsonb
  ];
  v_property_invalid_payloads jsonb[] := ARRAY[
    NULL::jsonb,
    '{}'::jsonb,
    '{"unknown":"x"}'::jsonb,
    '{"name":"x","rooms":1}'::jsonb,
    '{"propertyType":123}'::jsonb,
    '{"address":""}'::jsonb,
    '{"city":"<tag>"}'::jsonb,
    ('{"postalCode":"' || repeat('9', 33) || '"}')::jsonb,
    '{"serviceType":"cleaning"}'::jsonb,
    '{"id":"x"}'::jsonb,
    '{"rooms":3}'::jsonb,
    '{"accessCode":"1234"}'::jsonb
  ];
  v_state jsonb;
begin
  if v_project_ref is distinct from 'kpvvydthlxupjjqqdpxy' then
    raise exception 'qa_target_required' using errcode = '22023';
  end if;

  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
  values
    (v_staff_id, v_run_id || '.staff@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
    (v_admin_id, v_run_id || '.admin@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
    (v_member_id, v_run_id || '.member@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
    (v_suspended_id, v_run_id || '.suspended@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
    (v_revoked_id, v_run_id || '.revoked@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
    (v_outsider_id, v_run_id || '.outsider@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
    (v_no_membership_id, v_run_id || '.no-membership@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp());
  insert into public.clients (
    id, created_at, updated_at, full_name, phone, email, tax_id, billing_address, status, display_code
  ) values
    (v_client_a, clock_timestamp(), clock_timestamp(), 'Synthetic Client A', '+34910000001', 'client-a@example.invalid', 'ES-A-0001', 'Synthetic Address A', 'active', v_run_id || '-CA'),
    (v_client_b, clock_timestamp(), clock_timestamp(), 'Synthetic Client B', '+34910000002', 'client-b@example.invalid', 'ES-B-0002', 'Synthetic Address B', 'active', v_run_id || '-CB');

  insert into public.properties (
    id, created_at, updated_at, client_id, name, property_type, address, city, postal_code, status, display_code, archived_at, deleted_at
  ) values
    (v_property_a1, clock_timestamp(), clock_timestamp(), v_client_a, 'Synthetic Property A1', 'apartment', 'A1 Street 1', 'Barcelona', '08001', 'active', v_run_id || '-PA1', null, null),
    (v_property_a2, clock_timestamp(), clock_timestamp(), v_client_a, 'Synthetic Property A2', 'studio', 'A2 Street 2', 'Barcelona', '08002', 'active', v_run_id || '-PA2', null, null),
    (v_property_archived, clock_timestamp(), clock_timestamp(), v_client_a, 'Synthetic Property Archived', 'apartment', 'A3 Street 3', 'Barcelona', '08003', 'active', v_run_id || '-PARCH', clock_timestamp(), null),
    (v_property_deleted, clock_timestamp(), clock_timestamp(), v_client_a, 'Synthetic Property Deleted', 'apartment', 'A4 Street 4', 'Barcelona', '08004', 'active', v_run_id || '-PDEL', null, clock_timestamp());

  insert into public.client_portal_memberships (
    id, user_id, client_id, role, status, approved_by, invitation_id, invitation_accepted_at, created_at, updated_at, revoked_at, revoked_by
  ) values
    (gen_random_uuid(), v_admin_id, v_client_a, 'client_admin', 'active', v_staff_id, null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null),
    (gen_random_uuid(), v_member_id, v_client_a, 'client_member', 'active', v_staff_id, null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null),
    (gen_random_uuid(), v_suspended_id, v_client_a, 'client_member', 'suspended', v_staff_id, null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null),
    (gen_random_uuid(), v_revoked_id, v_client_a, 'client_member', 'revoked', v_staff_id, null, clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp(), v_staff_id),
    (gen_random_uuid(), v_outsider_id, v_client_b, 'client_member', 'active', v_staff_id, null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null);

  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE'),
    'authenticated_profile_submit_granted'
  );
  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)', 'EXECUTE'),
    'authenticated_property_submit_granted'
  );
  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.portal_list_own_profile_change_requests_v2(text,integer)', 'EXECUTE'),
    'authenticated_profile_list_granted'
  );
  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.portal_list_own_property_change_requests_v2(text,text,integer)', 'EXECUTE'),
    'authenticated_property_list_granted'
  );
  perform pg_temp.assert_true(
    has_function_privilege('anon', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE') = false,
    'anon_denied_profile_submit'
  );

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"fullName":"No Session"}',
      gen_random_uuid()
    ),
    'P0002',
    'resource_not_found',
    'no_session_neutral'
  );

  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"fullName":"Anon User"}',
      gen_random_uuid()
    ),
    '42501',
    null,
    'anon_denied'
  );

  perform pg_temp.set_auth_context(v_no_membership_id);
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"phone":"+34915555555"}',
      gen_random_uuid()
    ),
    'P0002',
    'resource_not_found',
    'no_membership_neutral'
  );

  perform pg_temp.set_auth_context(v_suspended_id);
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"phone":"+34914444444"}',
      gen_random_uuid()
    ),
    'P0002',
    'resource_not_found',
    'suspended_membership_neutral'
  );

  perform pg_temp.set_auth_context(v_revoked_id);
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"phone":"+34913333333"}',
      gen_random_uuid()
    ),
    'P0002',
    'resource_not_found',
    'revoked_membership_neutral'
  );

  perform pg_temp.set_auth_context(v_outsider_id);
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"phone":"+34912222222"}',
      gen_random_uuid()
    ),
    'P0002',
    'resource_not_found',
    'cross_client_neutral'
  );

  perform pg_temp.set_auth_context(v_admin_id);
  v_profile_receipt := public.portal_submit_profile_change_request_v2(
    v_client_a,
    '{"fullName":"Synthetic Client A Prime","billingAddress":"Prime Street 9"}'::jsonb,
    v_profile_key
  );
  perform pg_temp.assert_json_keys(v_profile_receipt, v_expected_receipt_keys, 'profile_receipt_shape');
  v_profile_retry := public.portal_submit_profile_change_request_v2(
    v_client_a,
    '{"billingAddress":"Prime Street 9","fullName":"Synthetic Client A Prime"}'::jsonb,
    v_profile_key
  );
  perform pg_temp.assert_true(v_profile_retry = v_profile_receipt, 'profile_idempotency_same_payload');
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      '{"fullName":"Synthetic Client A Prime Changed"}',
      v_profile_key
    ),
    '23505',
    'idempotency_conflict',
    'profile_idempotency_conflict'
  );
  v_profile_list := public.portal_list_own_profile_change_requests_v2(v_client_a, 50);
  perform pg_temp.assert_true(jsonb_array_length(v_profile_list) = 1, 'profile_list_count_one');
  perform pg_temp.assert_json_keys(v_profile_list -> 0, v_expected_list_keys, 'profile_list_shape');
  perform pg_temp.assert_true((v_profile_list -> 0) ->> 'reference' = v_profile_receipt ->> 'reference', 'profile_list_reference_matches');

  v_profile_second_key := gen_random_uuid();
  v_state := public.portal_submit_profile_change_request_v2(
    v_client_a,
    '{"taxId":"ES-A-0003"}'::jsonb,
    v_profile_second_key
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_profile_change_requests_v2(v_client_a, 50)) = 2,
    'profile_list_limit_fifty'
  );
  perform pg_temp.assert_true(
    (public.portal_list_own_profile_change_requests_v2(v_client_a, 50) -> 0) ->> 'reference' = v_state ->> 'reference',
    'profile_list_order_desc'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_profile_change_requests_v2(v_client_a, 1)) = 1,
    'profile_list_limit_minimum'
  );

  v_property_receipt := public.portal_submit_property_change_request_v2(
    v_client_a,
    v_property_a1,
    '{"name":"Synthetic Property A1 Prime","city":"Terrassa"}'::jsonb,
    v_property_key
  );
  perform pg_temp.assert_json_keys(v_property_receipt, v_expected_receipt_keys, 'property_receipt_shape');
  v_property_retry := public.portal_submit_property_change_request_v2(
    v_client_a,
    v_property_a1,
    '{"city":"Terrassa","name":"Synthetic Property A1 Prime"}'::jsonb,
    v_property_key
  );
  perform pg_temp.assert_true(v_property_retry = v_property_receipt, 'property_idempotency_same_payload');
  perform pg_temp.expect_error(
    format($q$select public.portal_submit_property_change_request_v2(%L, %L, %L::jsonb, %L::uuid)$q$,
      v_client_a,
      v_property_a1,
      '{"name":"Synthetic Property A1 Prime Changed"}',
      v_property_key
    ),
    '23505',
    'idempotency_conflict',
    'property_idempotency_conflict'
  );
  v_property_list := public.portal_list_own_property_change_requests_v2(v_client_a, v_property_a1, 50);
  perform pg_temp.assert_true(jsonb_array_length(v_property_list) = 1, 'property_list_count_one');
  perform pg_temp.assert_json_keys(v_property_list -> 0, v_expected_list_keys, 'property_list_shape');
  perform pg_temp.assert_true((v_property_list -> 0) ->> 'reference' = v_property_receipt ->> 'reference', 'property_list_reference_matches');

  v_property_second_key := gen_random_uuid();
  v_state := public.portal_submit_property_change_request_v2(
    v_client_a,
    v_property_a1,
    '{"name":"Synthetic Property A1 Second","postalCode":"08099"}'::jsonb,
    v_property_second_key
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_property_change_requests_v2(v_client_a, v_property_a1, 50)) = 2,
    'property_list_limit_fifty'
  );
  perform pg_temp.assert_true(
    (public.portal_list_own_property_change_requests_v2(v_client_a, v_property_a1, 50) -> 0) ->> 'reference' = v_state ->> 'reference',
    'property_list_order_desc'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_property_change_requests_v2(v_client_a, v_property_a1, 1)) = 1,
    'property_list_limit_minimum'
  );

  perform pg_temp.set_auth_context(v_member_id);
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_profile_change_requests_v2(v_client_a, 50)) = 0,
    'same_client_cross_user_profile_hidden'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_property_change_requests_v2(v_client_a, v_property_a1, 50)) = 0,
    'same_client_cross_user_property_hidden'
  );

  perform pg_temp.set_auth_context(v_admin_id);
  for v_payload in select * from unnest(v_profile_invalid_payloads) loop
    perform pg_temp.expect_error(
      format($q$select public.portal_submit_profile_change_request_v2(%L, %L::jsonb, %L::uuid)$q$,
        v_client_a,
        coalesce(v_payload::text, 'null'),
        gen_random_uuid()
      ),
      '22023',
      'invalid_change_request',
      'profile_payload_rejected'
    );
  end loop;

  perform pg_temp.set_auth_context(v_member_id);
  for v_payload in select * from unnest(v_property_invalid_payloads) loop
    perform pg_temp.expect_error(
      format($q$select public.portal_submit_property_change_request_v2(%L, %L, %L::jsonb, %L::uuid)$q$,
        v_client_a,
        v_property_a2,
        coalesce(v_payload::text, 'null'),
        gen_random_uuid()
      ),
      '22023',
      'invalid_change_request',
      'property_payload_rejected'
    );
  end loop;

  perform pg_temp.expect_error(
    format($q$select public.portal_list_own_profile_change_requests_v2(%L, 0)$q$, v_client_a),
    'P0002',
    'resource_not_found',
    'profile_list_limit_minimum_rejected'
  );
  perform pg_temp.expect_error(
    format($q$select public.portal_list_own_profile_change_requests_v2(%L, 51)$q$, v_client_a),
    'P0002',
    'resource_not_found',
    'profile_list_limit_maximum_rejected'
  );
  perform pg_temp.expect_error(
    format($q$select public.portal_list_own_property_change_requests_v2(%L, %L, 0)$q$, v_client_a, v_property_a1),
    'P0002',
    'resource_not_found',
    'property_list_limit_minimum_rejected'
  );
  perform pg_temp.expect_error(
    format($q$select public.portal_list_own_property_change_requests_v2(%L, %L, 51)$q$, v_client_a, v_property_a1),
    'P0002',
    'resource_not_found',
    'property_list_limit_maximum_rejected'
  );
  reset role;
  delete from public.client_portal_rate_limits
    where subject_hash in (
      encode(sha256(convert_to('profile_change_v2:' || v_admin_id::text || ':' || v_client_a, 'UTF8')), 'hex'),
      encode(sha256(convert_to('property_change_v2:' || v_admin_id::text || ':' || v_client_a, 'UTF8')), 'hex')
    );
  delete from public.client_portal_audit_events
    where actor_user_id in (
      v_staff_id, v_admin_id, v_member_id, v_suspended_id, v_revoked_id, v_outsider_id, v_no_membership_id
    )
      or client_id in (v_client_a, v_client_b);
  delete from public.client_portal_property_change_requests
    where requested_by in (
      v_admin_id, v_member_id, v_suspended_id, v_revoked_id, v_outsider_id, v_no_membership_id
    )
      or client_id in (v_client_a, v_client_b)
      or property_id in (v_property_a1, v_property_a2, v_property_archived, v_property_deleted);
  delete from public.client_portal_profile_change_requests
    where requested_by in (
      v_admin_id, v_member_id, v_suspended_id, v_revoked_id, v_outsider_id, v_no_membership_id
    )
      or client_id in (v_client_a, v_client_b);
  delete from public.client_portal_memberships
    where user_id in (
      v_admin_id, v_member_id, v_suspended_id, v_revoked_id, v_outsider_id, v_no_membership_id
    )
      or client_id in (v_client_a, v_client_b);
  delete from public.properties
    where id in (v_property_a1, v_property_a2, v_property_archived, v_property_deleted)
      or client_id in (v_client_a, v_client_b);
  delete from public.clients where id in (v_client_a, v_client_b);
  delete from auth.users
    where id in (
      v_staff_id, v_admin_id, v_member_id, v_suspended_id, v_revoked_id, v_outsider_id, v_no_membership_id
    );
end;
$cp3b2a_matrix$;

rollback;

select jsonb_build_object(
  'gate', 'CP-3B.2A REAL QA CLOSEOUT',
  'result', 'REAL_CONTRACT_MATRIX_PASS',
  'transaction', 'ROLLED_BACK',
  'runId', current_setting('app.cp3b2a.run_id', true)
)::text as cp3b2a_qa_real_contract_matrix;
