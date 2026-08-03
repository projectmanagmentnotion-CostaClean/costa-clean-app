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
\if :{?auth_user_id}
\else
\echo 'auth_user_id is required'
\quit 3
\endif
\if :{?staff_user_id}
\else
\echo 'staff_user_id is required'
\quit 3
\endif
\if :{?client_id}
\else
\echo 'client_id is required'
\quit 3
\endif
\if :{?property_id}
\else
\echo 'property_id is required'
\quit 3
\endif
\if :{?membership_id}
\else
\echo 'membership_id is required'
\quit 3
\endif
\if :{?profile_request_id}
\else
\echo 'profile_request_id is required'
\quit 3
\endif
\if :{?property_request_id}
\else
\echo 'property_request_id is required'
\quit 3
\endif
\if :{?service_request_id}
\else
\echo 'service_request_id is required'
\quit 3
\endif
\if :{?audit_event_id}
\else
\echo 'audit_event_id is required'
\quit 3
\endif
\if :{?rate_limit_action}
\else
\echo 'rate_limit_action is required'
\quit 3
\endif
\if :{?rate_limit_subject_hash}
\else
\echo 'rate_limit_subject_hash is required'
\quit 3
\endif
\if :{?auth_email}
\else
\echo 'auth_email is required'
\quit 3
\endif

begin transaction;

delete from public.client_portal_rate_limits
  where action = :'rate_limit_action'
    and subject_hash = :'rate_limit_subject_hash';

delete from public.client_portal_audit_events
  where id = :'audit_event_id'::uuid
     or correlation_id = :'audit_event_id'::uuid;

delete from public.client_service_requests
  where id = :'service_request_id'::uuid
     or requested_by = :'auth_user_id'::uuid;

delete from public.client_portal_property_change_requests
  where id = :'property_request_id'::uuid
     or requested_by = :'auth_user_id'::uuid
     or property_id = :'property_id';

delete from public.client_portal_profile_change_requests
  where id = :'profile_request_id'::uuid
     or requested_by = :'auth_user_id'::uuid;

delete from public.client_portal_memberships
  where id = :'membership_id'::uuid
     or user_id = :'auth_user_id'::uuid
     or client_id = :'client_id';

set local session_replication_role = replica;
delete from auth.users
  where id = :'auth_user_id'::uuid
     or email = :'auth_email';
set local session_replication_role = origin;

delete from public.properties
  where id = :'property_id'
     or client_id = :'client_id';

delete from public.clients
  where id = :'client_id';

commit;

select jsonb_build_object(
  'gate', 'CP-3B.2A.6R.1E',
  'kind', 'fixture_cleanup',
  'projectRef', :'project_ref',
  'runId', :'run_id',
  'result', 'PASS_CLEANED'
)::text as cp3b2a_qa_fixture_cleanup_v6;
