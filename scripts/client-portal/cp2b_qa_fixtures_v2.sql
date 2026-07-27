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
\if :{?suspended_staff_user_id}
\else
  \echo 'suspended_staff_user_id is required'
  \quit 3
\endif
\if :{?admin_a_user_id}
\else
  \echo 'admin_a_user_id is required'
  \quit 3
\endif
\if :{?member_a_user_id}
\else
  \echo 'member_a_user_id is required'
  \quit 3
\endif
\if :{?admin_b_user_id}
\else
  \echo 'admin_b_user_id is required'
  \quit 3
\endif
\if :{?member_b_user_id}
\else
  \echo 'member_b_user_id is required'
  \quit 3
\endif
\if :{?pending_user_id}
\else
  \echo 'pending_user_id is required'
  \quit 3
\endif
\if :{?suspended_member_user_id}
\else
  \echo 'suspended_member_user_id is required'
  \quit 3
\endif
\if :{?revoked_member_user_id}
\else
  \echo 'revoked_member_user_id is required'
  \quit 3
\endif
\if :{?unverified_user_id}
\else
  \echo 'unverified_user_id is required'
  \quit 3
\endif
\if :{?invitee_user_id}
\else
  \echo 'invitee_user_id is required'
  \quit 3
\endif
\if :{?client_a_id}
\else
  \echo 'client_a_id is required'
  \quit 3
\endif
\if :{?client_b_id}
\else
  \echo 'client_b_id is required'
  \quit 3
\endif

select set_config('app.cp2b.project_ref', :'project_ref', false);
select set_config('app.cp2b.run_id', :'cp2b_run_id', false);

do $guard$
begin
  if current_setting('app.cp2a.local_disposable', true) = 'true' then
    raise exception 'local_disposable is not a QA authorization' using errcode = '42501';
  end if;
  if current_setting('app.cp2b.project_ref', true) =
    'wfxnwfcdjainpojhbdri'
  then
    raise exception 'production_target_rejected' using errcode = '42501';
  end if;
  if current_setting('app.cp2b.project_ref', true) <>
    'kpvvydthlxupjjqqdpxy'
  then
    raise exception 'qa_target_required' using errcode = '42501';
  end if;
  if current_setting('app.cp2b.run_id', true) !~
    '^cp2b-[0-9a-f-]{36}$'
  then
    raise exception 'invalid_cp2b_run_id' using errcode = '22023';
  end if;
end;
$guard$;

begin;

-- Trigger suppression is limited to deterministic non-fiscal canonical fixtures.
-- It prevents existing numbering/automation triggers from consuming sequences.
set local session_replication_role = replica;

insert into public.clients (
  id, full_name, phone, email, tax_id, billing_address, status, display_code
) values
  (
    :'client_a_id', 'CP2B synthetic client A', null,
    null, null, null, 'active', :'client_a_id'
  ),
  (
    :'client_b_id', 'CP2B synthetic client B', null,
    null, null, null, 'active', :'client_b_id'
  );

insert into public.properties (
  id, client_id, name, property_type, address, city, postal_code,
  status, display_code
) values
  (
    :'property_a_id', :'client_a_id', 'CP2B synthetic property A',
    'apartment', 'Synthetic address A', 'Barcelona', '08000',
    'active', :'property_a_id'
  ),
  (
    :'property_b_id', :'client_b_id', 'CP2B synthetic property B',
    'office', 'Synthetic address B', 'Barcelona', '08000',
    'active', :'property_b_id'
  );

insert into public.quotes (
  id, client_id, property_id, status, subtotal, tax_amount, total, display_code
) values
  (
    :'quote_a_id', :'client_a_id', :'property_a_id',
    'draft', 10, 2.10, 12.10, :'quote_a_id'
  ),
  (
    :'quote_b_id', :'client_b_id', :'property_b_id',
    'draft', 20, 4.20, 24.20, :'quote_b_id'
  );

insert into public.jobs (
  id, client_id, property_id, quote_id, scheduled_date, status,
  service_type, display_code
) values
  (
    :'job_a_id', :'client_a_id', :'property_a_id', :'quote_a_id',
    current_date + 7, 'scheduled', 'regular_cleaning', :'job_a_id'
  ),
  (
    :'job_b_id', :'client_b_id', :'property_b_id', :'quote_b_id',
    current_date + 8, 'scheduled', 'commercial_cleaning', :'job_b_id'
  );

insert into public.invoices (
  id, display_code, job_id, client_id, property_id, quote_id,
  invoice_number, issue_date, status, subtotal, tax_amount, total
) values
  (
    :'invoice_a_id', :'invoice_a_id', :'job_a_id', :'client_a_id',
    :'property_a_id', :'quote_a_id', null, current_date, 'draft',
    10, 2.10, 12.10
  ),
  (
    :'invoice_b_id', :'invoice_b_id', :'job_b_id', :'client_b_id',
    :'property_b_id', :'quote_b_id', null, current_date, 'draft',
    20, 4.20, 24.20
  );

insert into public.invoice_lines (
  id, invoice_id, sort_order, concept, quantity, unit, unit_price, line_subtotal
) values
  (
    :'invoice_line_a_id', :'invoice_a_id', 1,
    'CP2B synthetic non-fiscal service A', 1, 'service', 10, 10
  ),
  (
    :'invoice_line_b_id', :'invoice_b_id', 1,
    'CP2B synthetic non-fiscal service B', 1, 'service', 20, 20
  );

set local session_replication_role = origin;

insert into public.internal_staff_memberships (
  user_id, role, status, created_at, updated_at
) values (
  :'suspended_staff_user_id'::uuid,
  'operator',
  'suspended',
  clock_timestamp(),
  clock_timestamp()
);

insert into public.client_portal_memberships (
  id, user_id, client_id, role, status, approved_by,
  revoked_at, revoked_by, revocation_reason_code
) values
  (
    :'membership_admin_a_id'::uuid, :'admin_a_user_id'::uuid,
    :'client_a_id', 'client_admin', 'active', :'active_staff_user_id'::uuid,
    null, null, null
  ),
  (
    :'membership_member_a_id'::uuid, :'member_a_user_id'::uuid,
    :'client_a_id', 'client_member', 'active', :'active_staff_user_id'::uuid,
    null, null, null
  ),
  (
    :'membership_admin_b_id'::uuid, :'admin_b_user_id'::uuid,
    :'client_b_id', 'client_admin', 'active', :'active_staff_user_id'::uuid,
    null, null, null
  ),
  (
    :'membership_member_b_id'::uuid, :'member_b_user_id'::uuid,
    :'client_b_id', 'client_member', 'active', :'active_staff_user_id'::uuid,
    null, null, null
  ),
  (
    :'membership_suspended_id'::uuid, :'suspended_member_user_id'::uuid,
    :'client_a_id', 'client_member', 'suspended', :'active_staff_user_id'::uuid,
    null, null, null
  ),
  (
    :'membership_revoked_id'::uuid, :'revoked_member_user_id'::uuid,
    :'client_a_id', 'client_member', 'revoked', :'active_staff_user_id'::uuid,
    clock_timestamp(), :'active_staff_user_id'::uuid, 'cp2b_test'
  );

insert into public.client_portal_applications (
  id, user_id, email_normalized, status, privacy_notice_version
) values (
  :'application_id'::uuid,
  :'pending_user_id'::uuid,
  'pending.' || :'cp2b_run_id' || '@example.invalid',
  'pending_review',
  'cp2b-v2'
);

insert into public.client_portal_invitations (
  id, client_id, email_normalized, role, token_hash, status, expires_at,
  invited_by, accepted_by, accepted_at, revoked_by, revoked_at
) values
  (
    :'invitation_active_id'::uuid, :'client_a_id',
    'invitee.' || :'cp2b_run_id' || '@example.invalid',
    'client_member', repeat('a', 64), 'pending',
    clock_timestamp() + interval '72 hours', :'active_staff_user_id'::uuid,
    null, null, null, null
  ),
  (
    :'invitation_expired_id'::uuid, :'client_a_id',
    'expired.' || :'cp2b_run_id' || '@example.invalid',
    'client_member', repeat('b', 64), 'expired',
    clock_timestamp() - interval '1 hour', :'active_staff_user_id'::uuid,
    null, null, null, null
  ),
  (
    :'invitation_revoked_id'::uuid, :'client_a_id',
    'revoked.' || :'cp2b_run_id' || '@example.invalid',
    'client_member', repeat('c', 64), 'revoked',
    clock_timestamp() + interval '24 hours', :'active_staff_user_id'::uuid,
    null, null, :'active_staff_user_id'::uuid, clock_timestamp()
  ),
  (
    :'invitation_used_id'::uuid, :'client_a_id',
    'used.' || :'cp2b_run_id' || '@example.invalid',
    'client_member', repeat('d', 64), 'accepted',
    clock_timestamp() + interval '24 hours', :'active_staff_user_id'::uuid,
    :'invitee_user_id'::uuid, clock_timestamp(), null, null
  );

insert into public.client_service_requests (
  id, client_id, property_id, requested_by, service_type,
  preferred_date, preferred_time_window, notes, status, idempotency_key
) values
  (
    :'service_request_a_id'::uuid, :'client_a_id', :'property_a_id',
    :'member_a_user_id'::uuid, 'regular_cleaning',
    current_date + 14, 'morning', null, 'pending_review',
    :'service_idempotency_a'::uuid
  ),
  (
    :'service_request_b_id'::uuid, :'client_b_id', :'property_b_id',
    :'member_b_user_id'::uuid, 'commercial_cleaning',
    current_date + 15, 'afternoon', null, 'pending_review',
    :'service_idempotency_b'::uuid
  );

insert into public.invoice_document_records (
  id, invoice_id, object_key, sha256, byte_size, mime_type,
  renderer_version, template_version, invoice_snapshot_hash, status, created_by
) values
  (
    :'document_a_id'::uuid, :'invoice_a_id', :'document_a_object_key',
    repeat('e', 64), 64, 'application/pdf', 'cp2b-v2', 'cp2b-v2',
    repeat('f', 64), 'ready', :'active_staff_user_id'::uuid
  ),
  (
    :'document_b_id'::uuid, :'invoice_b_id', :'document_b_object_key',
    repeat('1', 64), 64, 'application/pdf', 'cp2b-v2', 'cp2b-v2',
    repeat('2', 64), 'ready', :'active_staff_user_id'::uuid
  );

commit;
