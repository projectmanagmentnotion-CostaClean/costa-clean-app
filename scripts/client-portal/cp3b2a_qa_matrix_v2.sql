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
  then raise exception 'qa_target_rejected' using errcode = '42501';
  end if;
  if current_setting('app.cp3b2a.run_id') !~ '^CP3B2A-V2-[A-Z0-9]{12}$' then
    raise exception 'synthetic_run_id_rejected' using errcode = '22023';
  end if;
end;
$guard$;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if coalesce(p_value, false) is not true then
    raise exception 'assertion_failed:%', p_message;
  end if;
end;
$$;

create temp table cp3b2a_v2_actors (
  label text primary key,
  user_id uuid not null unique,
  verified boolean not null
) on commit drop;
insert into cp3b2a_v2_actors
select label, gen_random_uuid(), verified
from (values
  ('admin', true), ('member', true), ('foreign', true),
  ('suspended', true), ('unverified', false)
) as actors(label, verified);
grant select on cp3b2a_v2_actors to authenticated;

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
  ) then raise exception 'synthetic_collision_detected' using errcode = '23505';
  end if;
end;
$collision$;

set local session_replication_role = replica;
insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
select user_id,
  lower(:'run_id') || '-' || label || '@example.invalid',
  case when verified then clock_timestamp() else null end,
  clock_timestamp(), clock_timestamp()
from cp3b2a_v2_actors;

insert into public.clients(
  id, full_name, phone, email, tax_id, billing_address, status, display_code
) values
  (
    :'run_id' || '-CLIENT-A', 'Synthetic Client A', '+34900000301',
    lower(:'run_id') || '-a@example.invalid', :'run_id' || '-TAX-A',
    'Synthetic A', 'active', :'run_id' || '-CLIENT-A'
  ),
  (
    :'run_id' || '-CLIENT-B', 'Synthetic Client B', '+34900000302',
    lower(:'run_id') || '-b@example.invalid', :'run_id' || '-TAX-B',
    'Synthetic B', 'active', :'run_id' || '-CLIENT-B'
  );
insert into public.properties(
  id, client_id, name, property_type, address, city, postal_code,
  status, archived_at, deleted_at, display_code
) values
  (:'run_id' || '-PROP-A', :'run_id' || '-CLIENT-A', 'Active A', 'home',
   'Synthetic A', 'Barcelona', '08001', 'active', null, null, :'run_id' || '-PROP-A'),
  (:'run_id' || '-PROP-A2', :'run_id' || '-CLIENT-A', 'Active A2', 'home',
   'Synthetic A2', 'Barcelona', '08002', 'active', null, null, :'run_id' || '-PROP-A2'),
  (:'run_id' || '-PROP-ARCHIVED', :'run_id' || '-CLIENT-A', 'Archived', 'home',
   'Synthetic archived', 'Barcelona', '08003', 'active', clock_timestamp(), null,
   :'run_id' || '-PROP-ARCHIVED'),
  (:'run_id' || '-PROP-DELETED', :'run_id' || '-CLIENT-A', 'Deleted', 'home',
   'Synthetic deleted', 'Barcelona', '08004', 'active', null, clock_timestamp(),
   :'run_id' || '-PROP-DELETED'),
  (:'run_id' || '-PROP-B', :'run_id' || '-CLIENT-B', 'Foreign B', 'home',
   'Synthetic B', 'Barcelona', '08005', 'active', null, null, :'run_id' || '-PROP-B');

insert into public.client_portal_memberships(
  id, user_id, client_id, role, status, revoked_at
)
select gen_random_uuid(), user_id, :'run_id' || '-CLIENT-A', role, status, revoked_at
from (
  select user_id, 'client_admin'::text role, 'active'::text status,
    null::timestamptz revoked_at from cp3b2a_v2_actors where label = 'admin'
  union all
  select user_id, 'client_member', 'active', null
    from cp3b2a_v2_actors where label = 'member'
  union all
  select user_id, 'client_admin', 'active', null
    from cp3b2a_v2_actors where label = 'foreign'
  union all
  select user_id, 'client_member', 'suspended', null
    from cp3b2a_v2_actors where label = 'suspended'
  union all
  select user_id, 'client_member', 'active', null
    from cp3b2a_v2_actors where label = 'unverified'
) as memberships;
update public.client_portal_memberships
set client_id = :'run_id' || '-CLIENT-B'
where user_id = (select user_id from cp3b2a_v2_actors where label = 'foreign');
set local session_replication_role = origin;

create temp table cp3b2a_v2_baseline as
select
  (select md5(row_to_json(c)::text) from public.clients c
   where id = :'run_id' || '-CLIENT-A') as client_digest,
  (select md5(row_to_json(p)::text) from public.properties p
   where id = :'run_id' || '-PROP-A') as property_digest;

select pg_temp.assert_true(
  not has_function_privilege(
    'anon', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE'
  ), 'anon_denied'
);
select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)',
    'EXECUTE'
  ), 'authenticated_granted'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)',
    'EXECUTE'
  ), 'service_role_denied'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v2_actors where label = 'admin'),
  true
);

do $admin_matrix$
declare
  v_profile jsonb;
  v_retry jsonb;
  v_property jsonb;
  v_profile_audits integer;
  v_profile_key uuid := gen_random_uuid();
begin
  v_profile := public.portal_submit_profile_change_request_v2(
    current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
    '{"fullName":"Synthetic Client A Updated","email":"UPDATED@EXAMPLE.INVALID"}',
    v_profile_key
  );
  select count(*) into v_profile_audits
  from public.client_portal_audit_events
  where actor_user_id = current_setting('request.jwt.claim.sub')::uuid
    and event_type = 'profile_change_requested';
  select public.portal_submit_profile_change_request_v2(
    current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
    '{"email":"updated@example.invalid","fullName":"Synthetic Client A Updated"}',
    v_profile_key
  ) into v_retry;
  perform pg_temp.assert_true(v_retry = v_profile, 'profile_retry_same_receipt');
  perform pg_temp.assert_true(
    v_profile_audits = (
      select count(*) from public.client_portal_audit_events
      where actor_user_id = current_setting('request.jwt.claim.sub')::uuid
        and event_type = 'profile_change_requested'
    ), 'profile_retry_no_duplicate_audit'
  );
  perform pg_temp.assert_true(
    (select array_agg(k order by k) from jsonb_object_keys(v_profile) k)
      = array['changedFields','reference','requestType','requestedAt','status'],
    'profile_receipt_minimized'
  );
  begin
    perform public.portal_submit_profile_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      '{"phone":"+34999999999"}',
      v_profile_key
    );
    raise exception 'expected_idempotency_conflict';
  exception when unique_violation then null;
  end;

  v_property := public.portal_submit_property_change_request_v2(
    current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
    current_setting('app.cp3b2a.run_id') || '-PROP-A',
    '{"name":"Active A Updated","city":"Badalona"}', gen_random_uuid()
  );
  perform pg_temp.assert_true(
    v_property ->> 'reference' ~ '^CC-PT-[0-9A-F]{24}$'
      and v_property ->> 'requestType' = 'property',
    'property_receipt'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_profile_change_requests_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A', 50
    )) = 1, 'profile_list_own'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(public.portal_list_own_property_change_requests_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      current_setting('app.cp3b2a.run_id') || '-PROP-A', 50
    )) = 1, 'property_list_own'
  );
  perform pg_temp.assert_true(
    public.portal_list_own_profile_change_requests_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A', 50
    )::text !~* '(clientId|membershipId|userId|proposedChanges|decision_reason|@)',
    'list_hides_internal_and_pii'
  );
end;
$admin_matrix$;

do $ineligible_properties$
declare v_id text;
begin
  foreach v_id in array array[
    current_setting('app.cp3b2a.run_id') || '-PROP-ARCHIVED',
    current_setting('app.cp3b2a.run_id') || '-PROP-DELETED',
    current_setting('app.cp3b2a.run_id') || '-PROP-B',
    current_setting('app.cp3b2a.run_id') || '-MISSING'
  ] loop
    begin
      perform public.portal_submit_property_change_request_v2(
        current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
        v_id, '{"city":"Denied"}', gen_random_uuid()
      );
      raise exception 'ineligible_property_accepted';
    exception when no_data_found then null;
    end;
  end loop;
end;
$ineligible_properties$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v2_actors where label = 'member'),
  true
);
select public.portal_submit_profile_change_request_v2(
  :'run_id' || '-CLIENT-A', '{"phone":"+34900000999"}', gen_random_uuid()
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_profile_change_requests) = 0,
  'direct_request_table_read_denied'
);
select pg_temp.assert_true(
  jsonb_array_length(public.portal_list_own_profile_change_requests_v2(
    :'run_id' || '-CLIENT-A', 50
  )) = 1, 'same_client_cross_user_hidden'
);

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v2_actors where label = 'foreign'),
  true
);
do $foreign_denied$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      '{"phone":"+34900000888"}', gen_random_uuid()
    );
    raise exception 'cross_client_accepted';
  exception when no_data_found then null;
  end;
end;
$foreign_denied$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v2_actors where label = 'suspended'),
  true
);
do $suspended_denied$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      '{"phone":"+34900000777"}', gen_random_uuid()
    );
    raise exception 'suspended_accepted';
  exception when no_data_found then null;
  end;
end;
$suspended_denied$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v2_actors where label = 'unverified'),
  true
);
do $unverified_denied$
begin
  begin
    perform public.portal_submit_profile_change_request_v2(
      current_setting('app.cp3b2a.run_id') || '-CLIENT-A',
      '{"phone":"+34900000666"}', gen_random_uuid()
    );
    raise exception 'unverified_accepted';
  exception when no_data_found then null;
  end;
end;
$unverified_denied$;

reset role;

select pg_temp.assert_true(
  (select md5(row_to_json(c)::text) from public.clients c
   where id = :'run_id' || '-CLIENT-A')
    = (select client_digest from cp3b2a_v2_baseline),
  'canonical_client_unchanged'
);
select pg_temp.assert_true(
  (select md5(row_to_json(p)::text) from public.properties p
   where id = :'run_id' || '-PROP-A')
    = (select property_digest from cp3b2a_v2_baseline),
  'canonical_property_unchanged'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.client_portal_audit_events
    where actor_user_id in (select user_id from cp3b2a_v2_actors)
      and metadata::text ~* '(updated@example.invalid|Synthetic Client A Updated|Badalona)'
  ), 'audit_metadata_has_no_values_or_pii'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_profile_change_requests) = 2,
  'profile_rows_exact'
);
select pg_temp.assert_true(
  (select count(*) from public.client_portal_property_change_requests) = 1,
  'property_rows_exact'
);

rollback;

select jsonb_build_object(
  'result', 'PASS',
  'transaction', 'ROLLED_BACK',
  'syntheticAuthAdminApiCalls', 0,
  'canonicalRowsChanged', 0,
  'crossClient', 'DENIED',
  'directTableRead', 'DENIED'
) as cp3b2a_qa_matrix_v2;
