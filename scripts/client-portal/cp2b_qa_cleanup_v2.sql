\set ON_ERROR_STOP on

\if :{?project_ref}
\else
  \echo 'project_ref is required'
  \quit 3
\endif
\if :{?cp2b_run_id}
\else
  \echo 'cp2b_run_id is required'
  \quit 3
\endif
\if :{?active_staff_user_id}
\else
  \echo 'active_staff_user_id is required'
  \quit 3
\endif

select set_config('app.cp2b.project_ref', :'project_ref', false);
select set_config('app.cp2b.run_id', :'cp2b_run_id', false);

select (
  current_setting('app.cp2b.project_ref', true) = 'kpvvydthlxupjjqqdpxy'
  and current_setting('app.cp2b.project_ref', true) <> 'wfxnwfcdjainpojhbdri'
  and current_setting('app.cp2b.run_id', true) ~ '^cp2b-[0-9a-f-]{36}$'
) as cleanup_target_valid
\gset

\if :cleanup_target_valid
\else
  \echo 'cleanup target rejected'
  \quit 4
\endif

begin;

delete from public.client_portal_legal_acceptances
where id in (
  :'legal_acceptance_id'::uuid
);

delete from public.client_portal_audit_events
where id in (
  :'audit_event_id'::uuid
);

delete from public.invoice_document_records
where id in (
  :'document_a_id'::uuid,
  :'document_b_id'::uuid
);

delete from public.client_service_requests
where id in (
  :'service_request_a_id'::uuid,
  :'service_request_b_id'::uuid
);

delete from public.client_portal_profile_change_requests
where id in (
  :'profile_change_id'::uuid
);

delete from public.client_portal_property_change_requests
where id in (
  :'property_change_id'::uuid
);

delete from public.client_portal_applications
where id = :'application_id'::uuid;

delete from public.client_portal_memberships
where id in (
  :'membership_admin_a_id'::uuid,
  :'membership_member_a_id'::uuid,
  :'membership_admin_b_id'::uuid,
  :'membership_member_b_id'::uuid,
  :'membership_suspended_id'::uuid,
  :'membership_revoked_id'::uuid
);

delete from public.client_portal_invitations
where id in (
  :'invitation_active_id'::uuid,
  :'invitation_expired_id'::uuid,
  :'invitation_revoked_id'::uuid,
  :'invitation_used_id'::uuid
);

delete from public.internal_staff_memberships
where user_id = :'suspended_staff_user_id'::uuid
  and status = 'suspended';

set local session_replication_role = replica;

delete from public.invoice_lines
where id in (
  :'invoice_line_a_id',
  :'invoice_line_b_id'
);

delete from public.invoices
where id in (
  :'invoice_a_id',
  :'invoice_b_id'
);

delete from public.jobs
where id in (
  :'job_a_id',
  :'job_b_id'
);

delete from public.quotes
where id in (
  :'quote_a_id',
  :'quote_b_id'
);

delete from public.properties
where id in (
  :'property_a_id',
  :'property_b_id'
);

delete from public.clients
where id in (
  :'client_a_id',
  :'client_b_id'
);

set local session_replication_role = origin;

select (
  not exists (
    select 1 from public.clients
    where id in (:'client_a_id', :'client_b_id')
  )
  and not exists (
    select 1 from public.client_portal_memberships
    where id in (
      :'membership_admin_a_id'::uuid,
      :'membership_member_a_id'::uuid,
      :'membership_admin_b_id'::uuid,
      :'membership_member_b_id'::uuid,
      :'membership_suspended_id'::uuid,
      :'membership_revoked_id'::uuid
    )
  )
  and not exists (
    select 1 from public.client_portal_invitations
    where id in (
      :'invitation_active_id'::uuid,
      :'invitation_expired_id'::uuid,
      :'invitation_revoked_id'::uuid,
      :'invitation_used_id'::uuid
    )
  )
  and not exists (
    select 1 from public.client_service_requests
    where id in (
      :'service_request_a_id'::uuid,
      :'service_request_b_id'::uuid
    )
  )
  and not exists (
    select 1 from public.invoice_document_records
    where id in (:'document_a_id'::uuid, :'document_b_id'::uuid)
  )
  and (
    select count(*)
    from public.internal_staff_memberships
    where user_id = :'active_staff_user_id'::uuid
      and status = 'active'
  ) = 1
) as exact_cleanup_pass
\gset

\if :exact_cleanup_pass
\else
  \echo 'exact cleanup reconciliation failed'
  \quit 5
\endif

commit;
