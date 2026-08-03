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
\if :{?client_name}
\else
\echo 'client_name is required'
\quit 3
\endif
\if :{?property_name}
\else
\echo 'property_name is required'
\quit 3
\endif
\if :{?client_display_code}
\else
\echo 'client_display_code is required'
\quit 3
\endif
\if :{?property_display_code}
\else
\echo 'property_display_code is required'
\quit 3
\endif

begin transaction;

select set_config('app.cp3b2a.project_ref', :'project_ref', true);
select set_config('app.cp3b2a.run_id', :'run_id', true);

set local session_replication_role = replica;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  :'auth_user_id'::uuid,
  :'auth_email',
  clock_timestamp(),
  clock_timestamp(),
  clock_timestamp()
);

insert into public.clients (
  id,
  full_name,
  phone,
  email,
  tax_id,
  billing_address,
  status,
  display_code
) values (
  :'client_id',
  :'client_name',
  null,
  null,
  null,
  null,
  'active',
  :'client_display_code'
);

insert into public.properties (
  id,
  client_id,
  name,
  property_type,
  address,
  city,
  postal_code,
  status,
  display_code
) values (
  :'property_id',
  :'client_id',
  :'property_name',
  'apartment',
  'Synthetic fixture address',
  'Barcelona',
  '08000',
  'active',
  :'property_display_code'
);

set local session_replication_role = origin;

insert into public.client_portal_memberships (
  id,
  user_id,
  client_id,
  role,
  status,
  approved_by,
  invitation_id,
  invitation_accepted_at,
  created_at,
  updated_at
) values (
  :'membership_id'::uuid,
  :'auth_user_id'::uuid,
  :'client_id',
  'client_admin',
  'active',
  :'staff_user_id'::uuid,
  null,
  null,
  clock_timestamp(),
  clock_timestamp()
);

insert into public.client_portal_profile_change_requests (
  id,
  client_id,
  requested_by,
  proposed_changes,
  status,
  requested_at
) values (
  :'profile_request_id'::uuid,
  :'client_id',
  :'auth_user_id'::uuid,
  jsonb_build_object(
    'fullName', :'client_name',
    'email', :'auth_email'
  ),
  'pending_review',
  clock_timestamp()
);

insert into public.client_portal_property_change_requests (
  id,
  client_id,
  property_id,
  requested_by,
  proposed_changes,
  status,
  requested_at
) values (
  :'property_request_id'::uuid,
  :'client_id',
  :'property_id',
  :'auth_user_id'::uuid,
  jsonb_build_object(
    'name', :'property_name',
    'city', 'Barcelona'
  ),
  'pending_review',
  clock_timestamp()
);

insert into public.client_service_requests (
  id,
  client_id,
  property_id,
  requested_by,
  service_type,
  preferred_date,
  preferred_time_window,
  notes,
  status,
  idempotency_key,
  created_at,
  updated_at,
  version
) values (
  :'service_request_id'::uuid,
  :'client_id',
  :'property_id',
  :'auth_user_id'::uuid,
  'regular_cleaning',
  current_date + 7,
  'morning',
  'Synthetic CP3B2A V6R1E service request',
  'pending_review',
  :'service_request_id'::uuid,
  clock_timestamp(),
  clock_timestamp(),
  1
);

insert into public.client_portal_audit_events (
  id,
  occurred_at,
  event_type,
  result,
  actor_user_id,
  membership_id,
  client_id,
  target_type,
  target_id,
  correlation_id,
  aal,
  risk_code,
  metadata
) values (
  :'audit_event_id'::uuid,
  clock_timestamp(),
  'service_request_submitted',
  'completed',
  :'auth_user_id'::uuid,
  :'membership_id'::uuid,
  :'client_id',
  'client_service_request',
  :'service_request_id'::uuid,
  :'audit_event_id'::uuid,
  null,
  null,
  jsonb_build_object('runId', :'run_id')
);

insert into public.client_portal_rate_limits (
  action,
  subject_hash,
  window_started_at,
  window_seconds,
  request_count,
  expires_at
) values (
  :'rate_limit_action',
  :'rate_limit_subject_hash',
  clock_timestamp(),
  3600,
  1,
  clock_timestamp() + interval '1 hour'
);

commit;

select jsonb_build_object(
  'gate', 'CP-3B.2A.6R.1E',
  'kind', 'fixture_setup',
  'projectRef', :'project_ref',
  'runId', :'run_id',
  'authUserId', :'auth_user_id',
  'clientId', :'client_id',
  'propertyId', :'property_id',
  'membershipId', :'membership_id',
  'profileRequestId', :'profile_request_id',
  'propertyRequestId', :'property_request_id',
  'serviceRequestId', :'service_request_id',
  'auditEventId', :'audit_event_id'
)::text as cp3b2a_qa_fixture_setup_v6;
