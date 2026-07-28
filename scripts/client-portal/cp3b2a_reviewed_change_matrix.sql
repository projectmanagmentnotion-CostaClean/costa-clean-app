\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if coalesce(p_value, false) is not true then
    raise exception 'assertion_failed:%', p_message;
  end if;
end;
$$;

insert into public.clients (
  id, full_name, phone, email, tax_id, billing_address, status
) values
  ('CP3B2A-CLIENT-A', 'Client Alpha', '+34000000001', 'alpha@example.invalid',
   'B00000001', 'Alpha Street 1', 'active'),
  ('CP3B2A-CLIENT-B', 'Client Beta', '+34000000002', 'beta@example.invalid',
   'B00000002', 'Beta Street 2', 'active'),
  ('CP3B2A-CLIENT-INACTIVE', 'Client Inactive', '+34000000003',
   'inactive@example.invalid', 'B00000003', 'Idle Street', 'inactive');

insert into public.properties (
  id, client_id, name, property_type, address, city, postal_code, status,
  archived_at, deleted_at
) values
  ('CP3B2A-PROP-A1', 'CP3B2A-CLIENT-A', 'Active home', 'home',
   'Alpha Street 1', 'Barcelona', '08001', 'active', null, null),
  ('CP3B2A-PROP-A2', 'CP3B2A-CLIENT-A', 'Second home', 'home',
   'Alpha Street 2', 'Barcelona', '08002', 'active', null, null),
  ('CP3B2A-PROP-ARCHIVED', 'CP3B2A-CLIENT-A', 'Archived home', 'home',
   'Old Street', 'Barcelona', '08003', 'active', clock_timestamp(), null),
  ('CP3B2A-PROP-DELETED', 'CP3B2A-CLIENT-A', 'Deleted home', 'home',
   'Gone Street', 'Barcelona', '08004', 'active', null, clock_timestamp()),
  ('CP3B2A-PROP-INACTIVE', 'CP3B2A-CLIENT-A', 'Inactive home', 'home',
   'Idle Street', 'Barcelona', '08007', 'inactive', null, null),
  ('CP3B2A-PROP-B1', 'CP3B2A-CLIENT-B', 'Other home', 'home',
   'Beta Street 2', 'Barcelona', '08005', 'active', null, null);

insert into public.client_portal_memberships (
  id, user_id, client_id, role, status, revoked_at
) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001',
   'CP3B2A-CLIENT-A', 'client_admin', 'active', null),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002',
   'CP3B2A-CLIENT-A', 'client_member', 'active', null),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000003',
   'CP3B2A-CLIENT-B', 'client_admin', 'active', null),
  ('73000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000004',
   'CP3B2A-CLIENT-A', 'client_member', 'suspended', null),
  ('73000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000005',
   'CP3B2A-CLIENT-A', 'client_member', 'revoked', clock_timestamp()),
  ('73000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000006',
   'CP3B2A-CLIENT-INACTIVE', 'client_member', 'active', null),
  ('73000000-0000-4000-8000-000000000007', '72000000-0000-4000-8000-000000000007',
   'CP3B2A-CLIENT-A', 'client_member', 'active', null);

select pg_temp.assert_true(
  not has_function_privilege(
    'anon', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE'
  ), 'anon_profile_execute_denied'
);
select pg_temp.assert_true(
  has_function_privilege(
    'authenticated', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE'
  ), 'authenticated_profile_execute_granted'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE'
  ), 'service_role_profile_execute_denied'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
    'EXECUTE'
  ), 'legacy_profile_edge_bypass_retired'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
    'EXECUTE'
  ), 'legacy_property_edge_bypass_retired'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_first jsonb;
  v_retry jsonb;
  v_property jsonb;
  v_profile_list jsonb;
  v_property_list jsonb;
  v_audit_before bigint;
  v_audit_after bigint;
begin
  v_first := public.portal_submit_profile_change_request_v2(
    'CP3B2A-CLIENT-A',
    '{"fullName":"  Client Alpha Updated  ","email":"NEW@EXAMPLE.INVALID"}'::jsonb,
    '74000000-0000-4000-8000-000000000001'
  );
  perform pg_temp.assert_true(
    (select array_agg(k order by k) from jsonb_object_keys(v_first) as k)
      = array['changedFields','reference','requestType','requestedAt','status'],
    'profile_receipt_exact_keys'
  );
  perform pg_temp.assert_true(
    v_first ->> 'status' = 'pending_review'
      and v_first ->> 'requestType' = 'profile'
      and v_first ->> 'reference' ~ '^CC-PR-[0-9A-F]{24}$'
      and jsonb_array_length(v_first -> 'changedFields') = 2,
    'profile_receipt_values'
  );
  perform pg_temp.assert_true(
    v_first::text !~* '(clientId|membershipId|userId|propertyId|taxId|billingAddress|@)',
    'profile_receipt_minimized'
  );

  select count(*) into v_audit_before
  from public.client_portal_audit_events
  where event_type = 'profile_change_requested'
    and actor_user_id = '72000000-0000-4000-8000-000000000001';
  v_retry := public.portal_submit_profile_change_request_v2(
    'CP3B2A-CLIENT-A',
    '{"email":"new@example.invalid","fullName":"Client Alpha Updated"}'::jsonb,
    '74000000-0000-4000-8000-000000000001'
  );
  select count(*) into v_audit_after
  from public.client_portal_audit_events
  where event_type = 'profile_change_requested'
    and actor_user_id = '72000000-0000-4000-8000-000000000001';
  perform pg_temp.assert_true(v_retry = v_first, 'profile_retry_same_receipt');
  perform pg_temp.assert_true(v_audit_after = v_audit_before, 'profile_retry_no_audit');
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"fullName":"Different"}',
      '74000000-0000-4000-8000-000000000001'
    );
    raise exception 'expected_idempotency_conflict';
  exception when unique_violation then null;
  end;

  v_property := public.portal_submit_property_change_request_v2(
    'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1',
    '{"name":"Active home updated","city":"Badalona"}',
    '74000000-0000-4000-8000-000000000002'
  );
  perform pg_temp.assert_true(
    (select array_agg(k order by k) from jsonb_object_keys(v_property) as k)
      = array['changedFields','reference','requestType','requestedAt','status']
      and v_property ->> 'requestType' = 'property'
      and v_property ->> 'reference' ~ '^CC-PT-[0-9A-F]{24}$',
    'property_receipt_exact'
  );
  perform pg_temp.assert_true(
    public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1',
      '{"city":"Badalona","name":"Active home updated"}',
      '74000000-0000-4000-8000-000000000002'
    ) = v_property,
    'property_retry_same_receipt'
  );

  v_profile_list := public.portal_list_own_profile_change_requests_v2(
    'CP3B2A-CLIENT-A', 50
  );
  perform pg_temp.assert_true(
    jsonb_array_length(v_profile_list) = 1
      and (v_profile_list -> 0) ?& array[
        'reference','status','requestedAt','resolvedAt','changedFields','requestType'
      ]
      and not ((v_profile_list -> 0) ?| array[
        'id','clientId','userId','proposedChanges','decision_reason_code','reviewed_by'
      ]),
    'profile_list_minimized'
  );
  v_property_list := public.portal_list_own_property_change_requests_v2(
    'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', 50
  );
  perform pg_temp.assert_true(
    jsonb_array_length(v_property_list) = 1
      and (v_property_list -> 0) ->> 'reference' = v_property ->> 'reference',
    'property_list_own'
  );
end;
$$;

do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"phone":"+34000000777"}',
      '00000000-0000-0000-0000-000000000000'
    );
    raise exception 'nil_profile_idempotency_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', '{"city":"Lleida"}',
      '00000000-0000-0000-0000-000000000000'
    );
    raise exception 'nil_property_idempotency_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{}'::jsonb,
      '74000000-0000-4000-8000-000000000010'
    );
    raise exception 'empty_payload_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"status":"active"}'::jsonb,
      '74000000-0000-4000-8000-000000000011'
    );
    raise exception 'unknown_field_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"fullName":{"nested":true}}'::jsonb,
      '74000000-0000-4000-8000-000000000012'
    );
    raise exception 'nested_value_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', jsonb_build_object('fullName', repeat('x', 201)),
      '74000000-0000-4000-8000-000000000013'
    );
    raise exception 'long_value_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', jsonb_build_object('phone', E'123\n456'),
      '74000000-0000-4000-8000-000000000014'
    );
    raise exception 'control_character_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"fullName":"Client Alpha"}',
      '74000000-0000-4000-8000-000000000015'
    );
    raise exception 'profile_noop_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', '{"status":"inactive"}',
      '74000000-0000-4000-8000-000000000016'
    );
    raise exception 'property_status_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', '{"name":"Active home"}',
      '74000000-0000-4000-8000-000000000017'
    );
    raise exception 'property_noop_accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A2', '{"name":"Changed target"}',
      '74000000-0000-4000-8000-000000000002'
    );
    raise exception 'property_target_conflict_accepted';
  exception when unique_violation then null;
  end;
end;
$$;

do $$
declare
  v_target text;
begin
  foreach v_target in array array[
    'CP3B2A-PROP-ARCHIVED', 'CP3B2A-PROP-DELETED', 'CP3B2A-PROP-INACTIVE',
    'CP3B2A-PROP-B1', 'CP3B2A-PROP-MISSING'
  ] loop
    begin
      perform public.portal_submit_property_change_request_v2(
        'CP3B2A-CLIENT-A', v_target, '{"name":"Denied"}',
        gen_random_uuid()
      );
      raise exception 'ineligible_property_accepted:%', v_target;
    exception when no_data_found then null;
    end;
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  jsonb_array_length(
    public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-A', 50)
  ) = 0, 'same_client_cross_user_hidden'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_profile_change_requests) = 0,
  'direct_authenticated_table_read_denied'
);
select public.portal_submit_profile_change_request_v2(
  'CP3B2A-CLIENT-A', '{"phone":"+34000000999"}',
  '74000000-0000-4000-8000-000000000020'
);
select public.portal_submit_property_change_request_v2(
  'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A2', '{"city":"Girona"}',
  '74000000-0000-4000-8000-000000000021'
);

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-B', '{"fullName":"Cross client"}', gen_random_uuid()
    );
    raise exception 'cross_client_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000004', true);
do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"phone":"+34000000888"}', gen_random_uuid()
    );
    raise exception 'suspended_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', '{"city":"Terrassa"}', gen_random_uuid()
    );
    raise exception 'suspended_property_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000005', true);
do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"phone":"+34000000888"}', gen_random_uuid()
    );
    raise exception 'revoked_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000006', true);
do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"phone":"+34000000888"}', gen_random_uuid()
    );
    raise exception 'no_membership_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-INACTIVE', '{"phone":"+34000000888"}', gen_random_uuid()
    );
    raise exception 'inactive_client_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000007', true);
do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"phone":"+34000000888"}', gen_random_uuid()
    );
    raise exception 'unverified_user_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', '{"city":"Terrassa"}', gen_random_uuid()
    );
    raise exception 'unverified_property_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-A', '{"phone":"+34000000888"}', gen_random_uuid()
    );
    raise exception 'missing_session_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

reset role;

select pg_temp.assert_true(
  (select count(*) from public.client_portal_property_change_requests
   where property_id in (
     'CP3B2A-PROP-ARCHIVED', 'CP3B2A-PROP-DELETED', 'CP3B2A-PROP-INACTIVE',
     'CP3B2A-PROP-B1', 'CP3B2A-PROP-MISSING'
   )) = 0, 'denied_property_zero_rows'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_audit_events
   where actor_user_id = '72000000-0000-4000-8000-000000000001'
     and event_type = 'property_change_requested') = 1,
  'denied_property_zero_audits'
);

insert into public.client_portal_profile_change_requests (
  client_id, requested_by, proposed_changes, status, requested_at, reviewed_at,
  decision_reason_code, idempotency_key, public_reference
) values
  ('CP3B2A-CLIENT-A', '72000000-0000-4000-8000-000000000001',
   '{"phone":"+341"}', 'approved', clock_timestamp() - interval '4 minutes',
   clock_timestamp(), 'internal-one', '74000000-0000-4000-8000-000000000031',
   'CC-PR-000000000000000000000031'),
  ('CP3B2A-CLIENT-A', '72000000-0000-4000-8000-000000000001',
   '{"phone":"+342"}', 'rejected', clock_timestamp() - interval '3 minutes',
   clock_timestamp(), 'internal-two', '74000000-0000-4000-8000-000000000032',
   'CC-PR-000000000000000000000032'),
  ('CP3B2A-CLIENT-A', '72000000-0000-4000-8000-000000000001',
   '{"phone":"+343"}', 'withdrawn', clock_timestamp() - interval '2 minutes',
   clock_timestamp(), 'internal-three', '74000000-0000-4000-8000-000000000033',
   'CC-PR-000000000000000000000033');

set role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
do $$
declare
  v_list jsonb;
begin
  v_list := public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-A', 50);
  perform pg_temp.assert_true(
    v_list::text !~* '(internal-one|internal-two|internal-three|decision_reason|proposedChanges)',
    'list_hides_review_and_payload'
  );
  perform pg_temp.assert_true(
    v_list @> '[{"status":"approved"},{"status":"rejected"},{"status":"withdrawn"}]'::jsonb,
    'list_statuses'
  );
  perform pg_temp.assert_true(
    (v_list -> 0 ->> 'requestedAt') >= (v_list -> 1 ->> 'requestedAt'),
    'list_descending_order'
  );
  perform pg_temp.assert_true(
    exists (
      select 1 from jsonb_array_elements(v_list) as item
      where item ->> 'status' in ('approved','rejected','withdrawn')
        and item ->> 'resolvedAt' is not null
    ), 'list_resolved_at'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(
      public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-A', 1)
    ) = 1, 'list_effective_limit'
  );
  begin
    perform public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-A', 0);
    raise exception 'zero_limit_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-A', 51);
    raise exception 'large_limit_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-A', null);
    raise exception 'null_limit_accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_list_own_property_change_requests_v2(
      'CP3B2A-CLIENT-A', 'CP3B2A-PROP-A1', null
    );
    raise exception 'null_property_limit_accepted';
  exception when no_data_found then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000003', true);
do $$
declare
  v_attempt integer;
begin
  for v_attempt in 1..5 loop
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-B',
      jsonb_build_object('fullName', 'Rate Test ' || v_attempt),
      ('77000000-0000-4000-8000-' || lpad(v_attempt::text, 12, '0'))::uuid
    );
  end loop;
  begin
    perform public.portal_submit_profile_change_request_v2(
      'CP3B2A-CLIENT-B', '{"fullName":"Rate Test 6"}',
      '77000000-0000-4000-8000-000000000006'
    );
    raise exception 'rate_limit_threshold_not_enforced';
  exception when raise_exception then
    if sqlerrm <> 'rate_limited' then
      raise;
    end if;
  end;
  perform pg_temp.assert_true(
    jsonb_array_length(
      public.portal_list_own_profile_change_requests_v2('CP3B2A-CLIENT-B', 50)
    ) = 5, 'rate_limit_five_persisted'
  );
end;
$$;

reset role;
rollback;

\echo CP3B2A reviewed change matrix PASS
