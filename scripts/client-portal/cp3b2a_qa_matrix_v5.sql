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
\if :{?v3_run_id}
\else
\echo 'v3_run_id is required'
\quit 3
\endif
\if :{?v4_run_id}
\else
\echo 'v4_run_id is required'
\quit 3
\endif
\if :{?v5_run_id}
\else
\echo 'v5_run_id is required'
\quit 3
\endif

-- V5 is the explicit executable orchestrator. Both frozen transactional
-- matrices must succeed before the typed V5 capability envelope can exist.
\set run_id :v3_run_id
\ir cp3b2a_qa_matrix_v3.sql

\set run_id :v4_run_id
\ir cp3b2a_qa_matrix_v4.sql

-- V3 proves the property reference format but not the equivalent profile
-- reference. V5 executes both receipt privacy assertions explicitly.
begin;
select set_config('app.cp3b2a.project_ref', :'project_ref', true);
select set_config('app.cp3b2a.run_id', :'v5_run_id', true);

do $guard$
begin
  if current_setting('app.cp3b2a.project_ref') <> 'kpvvydthlxupjjqqdpxy'
    or current_setting('app.cp3b2a.run_id') !~ '^CP3B2A-V5-[A-Z0-9]{12}$'
  then raise exception 'v5_privacy_target_rejected' using errcode = '42501';
  end if;
end;
$guard$;

create temp table cp3b2a_v5_privacy_actor (
  user_id uuid primary key
) on commit drop;
insert into cp3b2a_v5_privacy_actor values (gen_random_uuid());
grant select on cp3b2a_v5_privacy_actor to authenticated;

set local session_replication_role=replica;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
select user_id,lower(:'v5_run_id') || '-privacy@example.invalid',
  clock_timestamp(),clock_timestamp(),clock_timestamp()
from cp3b2a_v5_privacy_actor;
set local session_replication_role=origin;

insert into public.clients(
  id,full_name,phone,email,tax_id,billing_address,status,display_code
) values (
  :'v5_run_id' || '-CLIENT','QA Synthetic V5 Privacy','+34900000491',
  lower(:'v5_run_id') || '-client@example.invalid',:'v5_run_id' || '-TAX',
  'QA Synthetic V5 Address','active',:'v5_run_id' || '-CLIENT'
);
insert into public.properties(
  id,client_id,name,property_type,address,city,postal_code,status,display_code
) values (
  :'v5_run_id' || '-PROPERTY',:'v5_run_id' || '-CLIENT',
  'QA Synthetic V5 Privacy Property','home','QA Synthetic V5 Address',
  'Barcelona','08001','active',:'v5_run_id' || '-PROPERTY'
);
insert into public.client_portal_memberships(
  id,user_id,client_id,role,status
)
select gen_random_uuid(),user_id,:'v5_run_id' || '-CLIENT',
  'client_admin','active'
from cp3b2a_v5_privacy_actor;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from cp3b2a_v5_privacy_actor),
  true
);
do $privacy$
declare
  v_profile jsonb;
  v_property jsonb;
  v_uuid_pattern constant text :=
    '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
begin
  v_profile := public.portal_submit_profile_change_request_v2(
    current_setting('app.cp3b2a.run_id') || '-CLIENT',
    '{"phone":"+34900000492"}',
    gen_random_uuid()
  );
  v_property := public.portal_submit_property_change_request_v2(
    current_setting('app.cp3b2a.run_id') || '-CLIENT',
    current_setting('app.cp3b2a.run_id') || '-PROPERTY',
    '{"city":"Badalona"}',
    gen_random_uuid()
  );
  if v_profile->>'reference' !~ '^CC-PR-[0-9A-F]{24}$'
    or v_property->>'reference' !~ '^CC-PT-[0-9A-F]{24}$'
    or v_profile::text ~* v_uuid_pattern
    or v_property::text ~* v_uuid_pattern
    or (select array_agg(k order by k) from jsonb_object_keys(v_profile) k)
      <> array['changedFields','reference','requestType','requestedAt','status']
    or (select array_agg(k order by k) from jsonb_object_keys(v_property) k)
      <> array['changedFields','reference','requestType','requestedAt','status']
  then raise exception 'v5_receipt_privacy_rejected' using errcode = 'P0001';
  end if;
end;
$privacy$;
reset role;
rollback;

select 'CP3B2A_V5_JSON:' || jsonb_build_object(
  'version', 5,
  'kind', 'transactional_matrix_complete',
  'result', 'PASS',
  'transaction', 'ROLLED_BACK',
  'executedArtifacts', jsonb_build_array(
    'cp3b2a_qa_matrix_v3.sql',
    'cp3b2a_qa_matrix_v4.sql',
    'cp3b2a_qa_matrix_v5.sql'
  ),
  'assertionIds', jsonb_build_array(
    'auth.no_session',
    'auth.anon_real_rpc',
    'auth.no_membership',
    'auth.revoked_membership',
    'auth.suspended_membership',
    'auth.active_member',
    'auth.client_admin',
    'isolation.cross_client',
    'isolation.same_client_cross_user',
    'isolation.foreign_property',
    'isolation.archived_property',
    'isolation.deleted_property',
    'isolation.missing_resource_neutral',
    'payload.non_object',
    'payload.empty_object',
    'payload.unknown_field',
    'payload.outside_allowlist',
    'payload.protected_field',
    'payload.id_mutation',
    'payload.client_id_mutation',
    'payload.wrong_type',
    'payload.oversized',
    'payload.valid_plus_extra',
    'payload.foreign_property',
    'idempotency.sequential_retry',
    'idempotency.same_key_same_payload',
    'idempotency.same_key_different_payload',
    'idempotency.receipt_stable',
    'idempotency.public_reference_stable',
    'idempotency.requested_at_stable',
    'privacy.requester_only',
    'privacy.no_internal_uuid',
    'privacy.no_unneeded_pii',
    'privacy.receipt_minimized',
    'privacy.profile_list',
    'privacy.property_list',
    'residue.transactional_request_delta',
    'residue.transactional_audit_delta',
    'residue.transactional_rate_delta',
    'residue.canonical_unchanged',
    'residue.historical_unchanged',
    'residue.financial_sequences_unchanged'
  ),
  'requestSideEffects', 0,
  'auditSideEffects', 0,
  'rateLimitSideEffects', 0,
  'canonicalRowsChanged', 0,
  'historicalRowsChanged', 0,
  'financialSequencesChanged', 0,
  'realPii', 0
)::text;
