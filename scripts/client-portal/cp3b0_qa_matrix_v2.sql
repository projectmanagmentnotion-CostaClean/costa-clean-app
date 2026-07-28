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

select set_config('app.cp3b0.project_ref', :'project_ref', true);
select set_config('app.cp3b0.run_id', :'run_id', true);

do $target_guard$
begin
  if current_setting('app.cp3b0.project_ref') <> 'kpvvydthlxupjjqqdpxy'
    or current_setting('app.cp3b0.project_ref') = 'wfxnwfcdjainpojhbdri'
  then
    raise exception 'qa_target_rejected' using errcode = '42501';
  end if;
  if current_setting('app.cp3b0.run_id') !~ '^CP3B0-V2-[A-Z0-9]{12}$' then
    raise exception 'synthetic_run_id_rejected' using errcode = '22023';
  end if;
end;
$target_guard$;

create temp table cp3b0_v2_actors (
  label text primary key,
  user_id uuid not null unique,
  verified boolean not null
) on commit drop;

insert into cp3b0_v2_actors(label, user_id, verified)
select label, gen_random_uuid(), verified
from (values
  ('no_access', true),
  ('pending', true),
  ('other_pending', true),
  ('admin', true),
  ('member', true),
  ('multi', true),
  ('suspended', true),
  ('revoked', true),
  ('active_suspended', true),
  ('active_pending', true),
  ('approved', true),
  ('unverified', false),
  ('staff', true)
) as actors(label, verified);

do $collision_guard$
begin
  if exists (
    select 1 from auth.users
    where email like lower(current_setting('app.cp3b0.run_id'))
      || '-%@example.invalid'
  ) or exists (
    select 1 from public.clients
    where id like current_setting('app.cp3b0.run_id') || '-%'
  ) then
    raise exception 'synthetic_collision_detected' using errcode = '23505';
  end if;
end;
$collision_guard$;

set local session_replication_role = replica;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at
)
select
  user_id,
  lower(:'run_id') || '-' || label || '@example.invalid',
  case when verified then clock_timestamp() else null end,
  clock_timestamp(),
  clock_timestamp()
from cp3b0_v2_actors;

insert into public.clients (
  id, full_name, phone, email, tax_id, billing_address, status, display_code
) values
  (
    :'run_id' || '-CLIENT-A', 'CP3B0 V2 Synthetic A', '+34900000201',
    lower(:'run_id') || '-client-a@example.invalid', :'run_id' || '-TAX-A',
    'Synthetic address A', 'active', :'run_id' || '-CLIENT-A'
  ),
  (
    :'run_id' || '-CLIENT-B', 'CP3B0 V2 Synthetic B', '+34900000202',
    lower(:'run_id') || '-client-b@example.invalid', :'run_id' || '-TAX-B',
    'Synthetic address B', 'active', :'run_id' || '-CLIENT-B'
  ),
  (
    :'run_id' || '-CLIENT-C', 'CP3B0 V2 Synthetic C', '+34900000203',
    lower(:'run_id') || '-client-c@example.invalid', :'run_id' || '-TAX-C',
    'Synthetic address C', 'active', :'run_id' || '-CLIENT-C'
  );

insert into public.internal_staff_memberships(user_id, role, status)
select user_id, 'operator', 'active'
from cp3b0_v2_actors where label = 'staff';

insert into public.client_portal_memberships (
  id, user_id, client_id, role, status, revoked_at
)
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_admin', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'admin'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_member', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'member'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_admin', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'multi'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-B',
  'client_member', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'multi'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_member', 'suspended', null::timestamptz
from cp3b0_v2_actors a where a.label = 'suspended'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_member', 'revoked', clock_timestamp()
from cp3b0_v2_actors a where a.label = 'revoked'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_member', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'active_suspended'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-B',
  'client_member', 'suspended', null::timestamptz
from cp3b0_v2_actors a where a.label = 'active_suspended'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-C',
  'client_admin', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'active_pending'
union all
select gen_random_uuid(), a.user_id, :'run_id' || '-CLIENT-A',
  'client_member', 'active', null::timestamptz
from cp3b0_v2_actors a where a.label = 'unverified';

insert into public.client_portal_applications (
  id, user_id, email_normalized, status, reviewed_by, reviewed_at,
  approved_client_id, privacy_notice_version
)
select
  gen_random_uuid(), a.user_id,
  lower(:'run_id') || '-pending@example.invalid',
  'pending_review', null::uuid, null::timestamptz, null::text, 'cp3b0-v2'
from cp3b0_v2_actors a where a.label = 'pending'
union all
select
  gen_random_uuid(), a.user_id,
  lower(:'run_id') || '-other-pending@example.invalid',
  'pending_review', null::uuid, null::timestamptz, null::text, 'cp3b0-v2'
from cp3b0_v2_actors a where a.label = 'other_pending'
union all
select
  gen_random_uuid(), a.user_id,
  lower(:'run_id') || '-active-pending@example.invalid',
  'pending_review', null::uuid, null::timestamptz, null::text, 'cp3b0-v2'
from cp3b0_v2_actors a where a.label = 'active_pending'
union all
select
  gen_random_uuid(), a.user_id,
  lower(:'run_id') || '-approved@example.invalid',
  'approved', staff.user_id, clock_timestamp(),
  :'run_id' || '-CLIENT-A', 'cp3b0-v2'
from cp3b0_v2_actors a
cross join cp3b0_v2_actors staff
where a.label = 'approved' and staff.label = 'staff';

set local session_replication_role = origin;

select set_config('app.cp3b0.client_a', :'run_id' || '-CLIENT-A', true);
select set_config('app.cp3b0.client_b', :'run_id' || '-CLIENT-B', true);
select set_config('app.cp3b0.client_c', :'run_id' || '-CLIENT-C', true);
select set_config('app.cp3b0.actor.' || label, user_id::text, true)
from cp3b0_v2_actors;

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

do $authorization_matrix$
declare
  v_result jsonb;
  v_membership jsonb;
  v_expected_keys text[] := array[
    'applicationStatus', 'memberships', 'selectedClientId', 'state'
  ];
begin
  if has_function_privilege(
    'anon', 'public.portal_resolve_self_access_context()', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.portal_resolve_self_access_context()', 'EXECUTE'
  ) then
    raise exception 'function_grant_matrix_failed';
  end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.no_access'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result <> jsonb_build_object(
    'state', 'authenticated_without_access',
    'selectedClientId', null,
    'memberships', '[]'::jsonb,
    'applicationStatus', null
  ) then raise exception 'without_access_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.pending'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'pending_review'
    or v_result ->> 'applicationStatus' <> 'pending_review'
    or jsonb_array_length(v_result -> 'memberships') <> 0
  then raise exception 'pending_review_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.no_access'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'applicationStatus' is not null
  then raise exception 'cross_user_isolation_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.admin'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result ->> 'selectedClientId' <> current_setting('app.cp3b0.client_a')
    or v_result -> 'memberships' -> 0 ->> 'role' <> 'client_admin'
  then raise exception 'active_admin_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.member'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result -> 'memberships' -> 0 ->> 'role' <> 'client_member'
  then raise exception 'active_member_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.multi'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'client_selection_required'
    or v_result -> 'selectedClientId' <> 'null'::jsonb
    or jsonb_array_length(v_result -> 'memberships') <> 2
    or v_result -> 'memberships' -> 0 ->> 'clientId'
      <> current_setting('app.cp3b0.client_a')
    or v_result -> 'memberships' -> 1 ->> 'clientId'
      <> current_setting('app.cp3b0.client_b')
  then raise exception 'multiple_active_memberships_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.suspended'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'suspended'
    or v_result -> 'selectedClientId' <> 'null'::jsonb
    or jsonb_array_length(v_result -> 'memberships') <> 0
    or v_result::text like '%' || current_setting('app.cp3b0.client_a') || '%'
  then raise exception 'suspended_minimization_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.revoked'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'revoked'
    or v_result -> 'selectedClientId' <> 'null'::jsonb
    or jsonb_array_length(v_result -> 'memberships') <> 0
    or v_result::text like '%' || current_setting('app.cp3b0.client_a') || '%'
  then raise exception 'revoked_minimization_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub',
    current_setting('app.cp3b0.actor.active_suspended'),
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result ->> 'selectedClientId' <> current_setting('app.cp3b0.client_a')
    or v_result::text like '%' || current_setting('app.cp3b0.client_b') || '%'
  then raise exception 'active_over_suspended_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub',
    current_setting('app.cp3b0.actor.active_pending'),
    true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'active_member'
    or v_result ->> 'applicationStatus' <> 'pending_review'
  then raise exception 'active_over_pending_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.approved'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or v_result ->> 'applicationStatus' <> 'approved'
  then raise exception 'approved_without_membership_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.unverified'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or jsonb_array_length(v_result -> 'memberships') <> 0
  then raise exception 'unverified_user_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.staff'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if v_result ->> 'state' <> 'authenticated_without_access'
    or jsonb_array_length(v_result -> 'memberships') <> 0
  then raise exception 'internal_staff_isolation_failed'; end if;

  perform set_config(
    'request.jwt.claim.sub', current_setting('app.cp3b0.actor.multi'), true
  );
  v_result := public.portal_resolve_self_access_context();
  if (
    select array_agg(key order by key) from jsonb_object_keys(v_result) key
  ) <> v_expected_keys then
    raise exception 'top_level_dto_keys_failed';
  end if;
  for v_membership in
    select value from jsonb_array_elements(v_result -> 'memberships')
  loop
    if (
      select array_agg(key order by key)
      from jsonb_object_keys(v_membership) key
    ) <> array['clientId', 'membershipId', 'role', 'status']::text[]
    then raise exception 'membership_dto_keys_failed'; end if;
  end loop;
  if v_result::text ~* 'example[.]invalid|synthetic|phone|address|tax'
  then raise exception 'pii_exposure_failed'; end if;
end;
$authorization_matrix$;

reset role;
rollback;

select jsonb_build_object(
  'result', 'PASS',
  'transaction', 'ROLLED_BACK',
  'statesCovered', 6,
  'authAdminApiUsed', false,
  'realUsersUsed', false,
  'piiFields', 0
) as cp3b0_qa_matrix_v2;
