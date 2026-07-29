\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif
\if :{?project_ref}
\else
\echo 'project_ref is required'
\quit 3
\endif
\if :{?run_id}
\else
\echo 'run_id is required'
\quit 3
\endif

begin;

select set_config('app.cp3b2a.project_ref', :'project_ref', true);
select set_config('app.cp3b2a.run_id', :'run_id', true);

do $guard$
begin
  if current_setting('app.cp3b2a.project_ref') <> 'kpvvydthlxupjjqqdpxy'
    or current_setting('app.cp3b2a.project_ref') = 'wfxnwfcdjainpojhbdri'
  then
    raise exception 'qa_target_rejected' using errcode = '42501';
  end if;
  if current_setting('app.cp3b2a.run_id') !~ '^CP3B2A-V4-[A-Z0-9]{12}$' then
    raise exception 'synthetic_run_id_rejected' using errcode = '22023';
  end if;
end;
$guard$;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if coalesce(p_value, false) is not true then
    raise exception 'assertion_failed:%', p_message using errcode = 'P0001';
  end if;
end;
$$;

create temp table cp3b2a_v4_case_results (
  case_id text primary key,
  actor_class text not null,
  sqlstate text not null,
  message_text text not null
) on commit drop;
grant select, insert on cp3b2a_v4_case_results to anon, authenticated;

create temp table cp3b2a_v4_actors (
  label text primary key,
  user_id uuid not null unique
) on commit drop;

insert into cp3b2a_v4_actors
select label, gen_random_uuid()
from (values ('active'), ('no_membership'), ('revoked'), ('suspended')) actors(label);
grant select on cp3b2a_v4_actors to authenticated;

create temp table cp3b2a_v4_prestate as
select
  (select count(*) from public.client_portal_profile_change_requests) profile_rows,
  (select count(*) from public.client_portal_property_change_requests) property_rows,
  (select count(*) from public.client_portal_audit_events) audit_rows,
  (select count(*) from public.client_portal_rate_limits) rate_rows,
  (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_profile_change_requests r) profile_digest,
  (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_property_change_requests r) property_digest,
  (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_audit_events r) audit_digest,
  (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by
      r.action, r.subject_hash, r.window_started_at), ''))
    from public.client_portal_rate_limits r) rate_digest,
  (select md5(coalesce(string_agg(row_to_json(r)::text, '|' order by r.id), ''))
    from public.clients r) clients_digest,
  (select md5(coalesce(string_agg(row_to_json(r)::text, '|' order by r.id), ''))
    from public.properties r) properties_digest;

do $collision$
begin
  if exists (
    select 1 from auth.users
    where email like lower(current_setting('app.cp3b2a.run_id')) || '-%@example.invalid'
  ) or exists (
    select 1 from public.clients
    where id like current_setting('app.cp3b2a.run_id') || '-%'
  ) or exists (
    select 1 from public.properties
    where id like current_setting('app.cp3b2a.run_id') || '-%'
  ) then
    raise exception 'synthetic_collision_detected' using errcode = '23505';
  end if;
end;
$collision$;

set local session_replication_role = replica;
insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
select user_id, lower(:'run_id') || '-' || label || '@example.invalid',
  clock_timestamp(), clock_timestamp(), clock_timestamp()
from cp3b2a_v4_actors;
set local session_replication_role = origin;

insert into public.clients(
  id, full_name, phone, email, tax_id, billing_address, status, display_code
) values
  (
    :'run_id' || '-CLIENT-A', 'QA Synthetic V4 Client A', '+34900000401',
    lower(:'run_id') || '-client-a@example.invalid', :'run_id' || '-TAX-A',
    'QA Synthetic V4 Address A', 'active', :'run_id' || '-CLIENT-A'
  ),
  (
    :'run_id' || '-CLIENT-B', 'QA Synthetic V4 Client B', '+34900000402',
    lower(:'run_id') || '-client-b@example.invalid', :'run_id' || '-TAX-B',
    'QA Synthetic V4 Address B', 'active', :'run_id' || '-CLIENT-B'
  );

insert into public.properties(
  id, client_id, name, property_type, address, city, postal_code,
  status, archived_at, deleted_at, display_code
) values
  (:'run_id' || '-PROP-A', :'run_id' || '-CLIENT-A', 'QA Synthetic V4 A', 'home',
   'QA Synthetic V4 A', 'Barcelona', '08001', 'active', null, null,
   :'run_id' || '-PROP-A'),
  (:'run_id' || '-PROP-B', :'run_id' || '-CLIENT-B', 'QA Synthetic V4 B', 'home',
   'QA Synthetic V4 B', 'Barcelona', '08002', 'active', null, null,
   :'run_id' || '-PROP-B');

insert into public.client_portal_memberships(
  id, user_id, client_id, role, status, revoked_at
)
select gen_random_uuid(), user_id, :'run_id' || '-CLIENT-A',
  'client_member', status, revoked_at
from (
  select user_id, 'active'::text status, null::timestamptz revoked_at
  from cp3b2a_v4_actors where label = 'active'
  union all
  select user_id, 'revoked', clock_timestamp()
  from cp3b2a_v4_actors where label = 'revoked'
  union all
  select user_id, 'suspended', null
  from cp3b2a_v4_actors where label = 'suspended'
) memberships;

-- Case 1: these are real RPC invocations under the anon database role.
set local role anon;
do $anon_rpc$
declare
  v_state text;
  v_message text;
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      '{"phone":"+34900000411"}', gen_random_uuid()
    );
    raise exception 'anon_profile_submit_accepted';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into cp3b2a_v4_case_results
    values ('anon.profile.submit', 'anon', v_state, v_message);
  end;
  begin
    perform public.portal_submit_property_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      current_setting('app.cp3b2a.run_id') || '-PROP-A',
      '{"city":"Girona"}', gen_random_uuid()
    );
    raise exception 'anon_property_submit_accepted';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into cp3b2a_v4_case_results
    values ('anon.property.submit', 'anon', v_state, v_message);
  end;
  begin
    perform public.portal_list_own_profile_change_requests_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A', 50
    );
    raise exception 'anon_profile_list_accepted';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into cp3b2a_v4_case_results
    values ('anon.profile.list', 'anon', v_state, v_message);
  end;
  begin
    perform public.portal_list_own_property_change_requests_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      current_setting('app.cp3b2a.run_id') || '-PROP-A', 50
    );
    raise exception 'anon_property_list_accepted';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into cp3b2a_v4_case_results
    values ('anon.property.list', 'anon', v_state, v_message);
  end;
end;
$anon_rpc$;
reset role;

-- Cases 2 and 3: authenticated identities with no, revoked or suspended membership.
set local role authenticated;
do $membership_denials$
declare
  v_label text;
  v_state text;
  v_message text;
begin
  foreach v_label in array array['no_membership', 'revoked', 'suspended'] loop
    perform set_config(
      'request.jwt.claim.sub',
      (select user_id::text from cp3b2a_v4_actors where label = v_label),
      true
    );
    begin
      perform public.portal_submit_profile_change_request_v2(
        current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
        '{"phone":"+34900000412"}', gen_random_uuid()
      );
      raise exception 'membership_profile_submit_accepted:%', v_label;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into cp3b2a_v4_case_results values (
        'membership.' || v_label || '.profile.submit',
        v_label, v_state, v_message
      );
    end;
    begin
      perform public.portal_submit_property_change_request_v2(
        current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
        current_setting('app.cp3b2a.run_id') || '-PROP-A',
        '{"city":"Girona"}', gen_random_uuid()
      );
      raise exception 'membership_property_submit_accepted:%', v_label;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into cp3b2a_v4_case_results values (
        'membership.' || v_label || '.property.submit',
        v_label, v_state, v_message
      );
    end;
    begin
      perform public.portal_list_own_profile_change_requests_v2(
        current_setting('app.cp3b2a.run_id') || '-CLIENT-A', 50
      );
      raise exception 'membership_profile_list_accepted:%', v_label;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into cp3b2a_v4_case_results values (
        'membership.' || v_label || '.profile.list',
        v_label, v_state, v_message
      );
    end;
    begin
      perform public.portal_list_own_property_change_requests_v2(
        current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
        current_setting('app.cp3b2a.run_id') || '-PROP-A', 50
      );
      raise exception 'membership_property_list_accepted:%', v_label;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into cp3b2a_v4_case_results values (
        'membership.' || v_label || '.property.list',
        v_label, v_state, v_message
      );
    end;
  end loop;
end;
$membership_denials$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v4_actors where label = 'active'),
  true
);

-- Case 4: real RPC calls prove server-side normalization and allowlist rejection.
create temp table cp3b2a_v4_invalid_cases (
  case_id text primary key,
  request_type text not null,
  payload jsonb not null
) on commit drop;
grant select on cp3b2a_v4_invalid_cases to authenticated;

insert into cp3b2a_v4_invalid_cases values
  ('profile.array', 'profile', '[]'),
  ('profile.scalar', 'profile', '"x"'),
  ('profile.empty', 'profile', '{}'),
  ('profile.unknown', 'profile', '{"unknown":"x"}'),
  ('profile.protected', 'profile', '{"status":"inactive"}'),
  ('profile.id', 'profile', '{"id":"forbidden"}'),
  ('profile.client_id', 'profile', '{"client_id":"forbidden"}'),
  ('profile.wrong_type', 'profile', '{"phone":42}'),
  ('profile.oversized', 'profile', jsonb_build_object('billingAddress', repeat('x', 321))),
  ('profile.valid_plus_extra', 'profile', '{"phone":"+34900000413","status":"inactive"}'),
  ('property.array', 'property', '[]'),
  ('property.scalar', 'property', '"x"'),
  ('property.empty', 'property', '{}'),
  ('property.unknown', 'property', '{"unknown":"x"}'),
  ('property.protected', 'property', '{"status":"inactive"}'),
  ('property.id', 'property', '{"id":"forbidden"}'),
  ('property.client_id', 'property', '{"client_id":"forbidden"}'),
  ('property.wrong_type', 'property', '{"city":42}'),
  ('property.oversized', 'property', jsonb_build_object('address', repeat('x', 321))),
  ('property.valid_plus_extra', 'property', '{"city":"Girona","status":"inactive"}');

do $invalid_payloads$
declare
  v_case record;
  v_state text;
  v_message text;
begin
  for v_case in select * from cp3b2a_v4_invalid_cases order by case_id
  loop
    begin
      if v_case.request_type = 'profile' then
        perform public.portal_submit_profile_change_request_v2(
          current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
          v_case.payload, gen_random_uuid()
        );
      else
        perform public.portal_submit_property_change_request_v2(
          current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
          current_setting('app.cp3b2a.run_id') || '-PROP-A',
          v_case.payload, gen_random_uuid()
        );
      end if;
      raise exception 'invalid_payload_accepted:%', v_case.case_id;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into cp3b2a_v4_case_results values (
        'invalid.' || v_case.case_id, 'active_invalid', v_state, v_message
      );
    end;
  end loop;

  begin
    perform public.portal_submit_property_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      current_setting('app.cp3b2a.run_id') || '-PROP-B',
      '{"city":"Girona"}', gen_random_uuid()
    );
    raise exception 'foreign_property_accepted';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into cp3b2a_v4_case_results values (
      'invalid.property.foreign', 'active_invalid', v_state, v_message
    );
  end;
end;
$invalid_payloads$;
reset role;

select pg_temp.assert_true(
  (select count(*) = 4 and bool_and(sqlstate = '42501')
   from cp3b2a_v4_case_results where actor_class = 'anon'),
  'anon_exact_42501'
);
select pg_temp.assert_true(
  (select count(*) = 12
    and count(distinct case_id) = 12
    and bool_and(sqlstate = 'P0002' and message_text = 'resource_not_found')
   from cp3b2a_v4_case_results
   where actor_class in ('no_membership', 'revoked', 'suspended')),
  'membership_denials_exact_neutral_envelope'
);
select pg_temp.assert_true(
  (select count(*) = 20
    and count(distinct case_id) = 20
    and bool_and(sqlstate = '22023' and message_text = 'invalid_change_request')
   from cp3b2a_v4_case_results
   where case_id like 'invalid.%' and case_id <> 'invalid.property.foreign'),
  'invalid_payloads_exact_22023'
);
select pg_temp.assert_true(
  (select sqlstate = 'P0002' and message_text = 'resource_not_found'
   from cp3b2a_v4_case_results where case_id = 'invalid.property.foreign'),
  'foreign_property_exact_neutral_envelope'
);
select pg_temp.assert_true(
  not exists (
    select 1 from cp3b2a_v4_case_results
    where message_text ilike '%' || current_setting('app.cp3b2a.run_id') || '%'
      or message_text ~* '([0-9a-f]{8}-[0-9a-f-]{27}|@|[+][0-9]{8,})'
  ),
  'public_errors_contain_no_identifiers_or_pii'
);

select pg_temp.assert_true(
  (select count(*) from public.client_portal_profile_change_requests)
    = (select profile_rows from cp3b2a_v4_prestate)
  and (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_profile_change_requests r)
    = (select profile_digest from cp3b2a_v4_prestate),
  'profile_requests_zero_side_effects'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_property_change_requests)
    = (select property_rows from cp3b2a_v4_prestate)
  and (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_property_change_requests r)
    = (select property_digest from cp3b2a_v4_prestate),
  'property_requests_zero_side_effects'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_audit_events)
    = (select audit_rows from cp3b2a_v4_prestate)
  and (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_audit_events r)
    = (select audit_digest from cp3b2a_v4_prestate),
  'audit_zero_side_effects'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_rate_limits)
    = (select rate_rows from cp3b2a_v4_prestate)
  and (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by
      r.action, r.subject_hash, r.window_started_at), ''))
    from public.client_portal_rate_limits r)
    = (select rate_digest from cp3b2a_v4_prestate),
  'rate_limit_zero_consumption'
);
select pg_temp.assert_true(
  (select md5(coalesce(string_agg(row_to_json(r)::text, '|' order by r.id), ''))
   from public.clients r
   where r.id not like current_setting('app.cp3b2a.run_id') || '-%')
    = (select clients_digest from cp3b2a_v4_prestate),
  'canonical_clients_unchanged'
);
select pg_temp.assert_true(
  (select md5(coalesce(string_agg(row_to_json(r)::text, '|' order by r.id), ''))
   from public.properties r
   where r.id not like current_setting('app.cp3b2a.run_id') || '-%')
    = (select properties_digest from cp3b2a_v4_prestate),
  'canonical_properties_unchanged'
);

select 'CP3B2A_V4_JSON:' || jsonb_build_object(
  'version', 4,
  'kind', 'transactional_matrix',
  'result', 'PASS',
  'transaction', 'ROLLED_BACK',
  'anonActualRpcInvocations', (
    select count(*) from cp3b2a_v4_case_results where actor_class = 'anon'
  ),
  'noMembershipActualRpcInvocations', (
    select count(*) from cp3b2a_v4_case_results where actor_class = 'no_membership'
  ),
  'revokedMembershipActualRpcInvocations', (
    select count(*) from cp3b2a_v4_case_results where actor_class = 'revoked'
  ),
  'suspendedMembershipActualRpcInvocations', (
    select count(*) from cp3b2a_v4_case_results where actor_class = 'suspended'
  ),
  'invalidPayloadActualRpcInvocations', (
    select count(*) from cp3b2a_v4_case_results where actor_class = 'active_invalid'
  ),
  'requestSideEffects', 0,
  'auditSideEffects', 0,
  'rateLimitSideEffects', 0,
  'canonicalRowsChanged', 0,
  'realPii', 0
)::text;

rollback;
