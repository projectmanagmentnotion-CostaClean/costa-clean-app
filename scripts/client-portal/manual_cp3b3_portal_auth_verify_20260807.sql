begin transaction read only;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

select jsonb_build_object(
  'AUTH_USERS', (
    select count(*)
    from auth.users
    where id in (
      '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
      '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
    )
      and email in (
        'qa.client.cp3b3.73125246@qa.invalid',
        'qa.client.cp3b3.b9a2330a@qa.invalid'
      )
      and email_confirmed_at is not null
  ),
  'CLIENTS', (
    select count(*)
    from public.clients
    where id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
      and status = 'active'
  ),
  'MEMBERSHIPS', (
    select count(*)
    from public.client_portal_memberships
    where user_id in (
      '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
      '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
    )
      and client_id in (
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
      )
      and role = 'client_admin'
      and status = 'active'
      and revoked_at is null
  ),
  'PROPERTIES', (
    select count(*)
    from public.properties
    where id in (
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A',
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
    )
      and client_id in (
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
      )
      and status = 'active'
      and archived_at is null
      and deleted_at is null
  ),
  'JOBS', (
    select count(*)
    from public.jobs
    where id in (
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2',
      'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE'
    )
      and client_id in (
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
      )
      and property_id in (
        'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A',
        'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
      )
      and status in ('completed', 'scheduled')
      and service_type in ('regular_cleaning', 'deep_cleaning')
      and archived_at is null
      and deleted_at is null
  ),
  'SERVICE_REQUESTS', (
    select count(*)
    from public.client_service_requests
    where requested_by in (
      '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
      '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
    )
       or client_id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
  ),
  'USER_A_ACTIVE_MEMBER', (
    exists (
      select 1
      from public.client_portal_memberships
      where user_id = '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid
        and client_id = 'CP3B3-PORTAL-AUTH-20260807-CLIENT-A'
        and role = 'client_admin'
        and status = 'active'
        and revoked_at is null
    )
    and not exists (
      select 1
      from public.client_portal_memberships
      where user_id = '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid
        and client_id <> 'CP3B3-PORTAL-AUTH-20260807-CLIENT-A'
    )
  ),
  'USER_B_ACTIVE_MEMBER', (
    exists (
      select 1
      from public.client_portal_memberships
      where user_id = '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
        and client_id = 'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
        and role = 'client_admin'
        and status = 'active'
        and revoked_at is null
    )
    and not exists (
      select 1
      from public.client_portal_memberships
      where user_id = '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
        and client_id <> 'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
  ),
  'CROSS_CLIENT_MEMBERSHIP_LEAK', (
    select count(*)
    from public.client_portal_memberships
    where user_id in (
      '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
      '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
    )
      and client_id not in (
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
      )
  ),
  'READY_FOR_PORTAL_AUTH', (
    (
      select count(*)
      from auth.users
      where id in (
        '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
        '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
      )
        and email_confirmed_at is not null
    ) = 2
    and (
      select count(*)
      from public.clients
      where id in (
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
      )
        and status = 'active'
    ) = 2
    and (
      select count(*)
      from public.client_portal_memberships
      where user_id in (
        '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
        '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
      )
        and client_id in (
          'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
          'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
        )
        and role = 'client_admin'
        and status = 'active'
        and revoked_at is null
    ) = 2
    and (
      select count(*)
      from public.properties
      where id in (
        'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A',
        'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
      )
        and status = 'active'
        and archived_at is null
        and deleted_at is null
    ) = 2
    and (
      select count(*)
      from public.jobs
      where id in (
        'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST',
        'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1',
        'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2',
        'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE'
      )
        and archived_at is null
        and deleted_at is null
    ) = 4
    and (
      select count(*)
      from public.client_service_requests
      where requested_by in (
        '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
        '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
      )
         or client_id in (
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
        'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
      )
    ) = 0
    and (
      select count(*)
      from public.client_portal_memberships
      where user_id in (
        '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
        '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
      )
        and client_id not in (
          'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
          'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
        )
    ) = 0
  )
) as cp3b3_portal_auth_verify_20260807;

rollback;
