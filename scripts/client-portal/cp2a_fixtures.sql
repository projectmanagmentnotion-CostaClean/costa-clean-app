\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

do $guard$
begin
  if current_setting('app.cp2a.local_disposable', true) <> 'true' then
    raise exception 'CP-2A fixtures are local-disposable only' using errcode = '42501';
  end if;
  if current_setting('app.cp2a.project_ref', true) in (
    'kpvvydthlxupjjqqdpxy',
    'wfxnwfcdjainpojhbdri'
  ) then
    raise exception 'CP-2A fixtures reject QA and production refs' using errcode = '42501';
  end if;
end;
$guard$;

set local session_replication_role = replica;

insert into public.clients (
  id, full_name, phone, email, tax_id, billing_address, status, display_code
) values
  (
    'QA-CP2-CLIENT-A', 'QA-CP2-Client A', '+34900000001',
    'client-a@example.invalid', 'QA-CP2-TAX-A', 'QA-CP2-Address A',
    'active', 'QA-CP2-CLIENT-A'
  ),
  (
    'QA-CP2-CLIENT-B', 'QA-CP2-Client B', '+34900000002',
    'client-b@example.invalid', 'QA-CP2-TAX-B', 'QA-CP2-Address B',
    'active', 'QA-CP2-CLIENT-B'
  );

insert into public.properties (
  id, client_id, name, property_type, address, city, postal_code,
  status, display_code
) values
  (
    'QA-CP2-PROPERTY-A', 'QA-CP2-CLIENT-A', 'QA-CP2-Property A',
    'apartment', 'QA-CP2-Property Address A', 'Barcelona', '08000',
    'active', 'QA-CP2-PROPERTY-A'
  ),
  (
    'QA-CP2-PROPERTY-B', 'QA-CP2-CLIENT-B', 'QA-CP2-Property B',
    'office', 'QA-CP2-Property Address B', 'Barcelona', '08000',
    'active', 'QA-CP2-PROPERTY-B'
  );

insert into public.quotes (
  id, client_id, property_id, status, subtotal, tax_amount, total, display_code
) values
  (
    'QA-CP2-QUOTE-A', 'QA-CP2-CLIENT-A', 'QA-CP2-PROPERTY-A',
    'draft', 10, 2.10, 12.10, 'QA-CP2-QUOTE-A'
  ),
  (
    'QA-CP2-QUOTE-B', 'QA-CP2-CLIENT-B', 'QA-CP2-PROPERTY-B',
    'draft', 20, 4.20, 24.20, 'QA-CP2-QUOTE-B'
  );

insert into public.jobs (
  id, client_id, property_id, quote_id, scheduled_date, status,
  service_type, display_code
) values
  (
    'QA-CP2-JOB-A', 'QA-CP2-CLIENT-A', 'QA-CP2-PROPERTY-A',
    'QA-CP2-QUOTE-A', current_date + 7, 'scheduled',
    'regular_cleaning', 'QA-CP2-JOB-A'
  ),
  (
    'QA-CP2-JOB-B', 'QA-CP2-CLIENT-B', 'QA-CP2-PROPERTY-B',
    'QA-CP2-QUOTE-B', current_date + 8, 'scheduled',
    'commercial_cleaning', 'QA-CP2-JOB-B'
  );

insert into public.invoices (
  id, display_code, job_id, client_id, property_id, quote_id,
  invoice_number, issue_date, status, subtotal, tax_amount, total
) values
  (
    'QA-CP2-INVOICE-A', 'QA-CP2-DRAFT-A', 'QA-CP2-JOB-A',
    'QA-CP2-CLIENT-A', 'QA-CP2-PROPERTY-A', 'QA-CP2-QUOTE-A',
    null, current_date, 'draft', 10, 2.10, 12.10
  ),
  (
    'QA-CP2-INVOICE-B', 'QA-CP2-DRAFT-B', 'QA-CP2-JOB-B',
    'QA-CP2-CLIENT-B', 'QA-CP2-PROPERTY-B', 'QA-CP2-QUOTE-B',
    null, current_date, 'draft', 20, 4.20, 24.20
  );

insert into public.invoice_lines (
  id, invoice_id, sort_order, concept, quantity, unit, unit_price, line_subtotal
) values
  ('QA-CP2-INVOICE-LINE-A', 'QA-CP2-INVOICE-A', 1, 'QA-CP2-Synthetic service A', 1, 'service', 10, 10),
  ('QA-CP2-INVOICE-LINE-B', 'QA-CP2-INVOICE-B', 1, 'QA-CP2-Synthetic service B', 1, 'service', 20, 20);

set local session_replication_role = origin;

insert into public.internal_staff_memberships (
  user_id, role, status, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000002',
  'operator',
  'suspended',
  clock_timestamp(),
  clock_timestamp()
);

insert into public.client_portal_invitations (
  id, client_id, email_normalized, role, token_hash, status, expires_at,
  invited_by, accepted_by, accepted_at, revoked_by, revoked_at
) values
  (
    '40000000-0000-4000-8000-000000000001',
    'QA-CP2-CLIENT-A',
    'invite-active@example.invalid',
    'client_member',
    repeat('a', 64),
    'pending',
    clock_timestamp() + interval '72 hours',
    '10000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'QA-CP2-CLIENT-A',
    'invite-expired@example.invalid',
    'client_member',
    repeat('b', 64),
    'expired',
    clock_timestamp() - interval '1 hour',
    '10000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'QA-CP2-CLIENT-A',
    'invite-revoked@example.invalid',
    'client_member',
    repeat('c', 64),
    'revoked',
    clock_timestamp() + interval '72 hours',
    '10000000-0000-4000-8000-000000000001',
    null,
    null,
    '10000000-0000-4000-8000-000000000001',
    clock_timestamp()
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    'QA-CP2-CLIENT-A',
    'member-a@example.invalid',
    'client_member',
    repeat('d', 64),
    'accepted',
    clock_timestamp() + interval '72 hours',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    clock_timestamp(),
    null,
    null
  );

insert into public.client_portal_memberships (
  id, user_id, client_id, role, status, invitation_id,
  invitation_accepted_at, revoked_at, revoked_by, revocation_reason_code
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'QA-CP2-CLIENT-A',
    'client_admin',
    'active',
    null,
    null,
    null,
    null,
    null
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'QA-CP2-CLIENT-A',
    'client_member',
    'active',
    '40000000-0000-4000-8000-000000000004',
    clock_timestamp(),
    null,
    null,
    null
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'QA-CP2-CLIENT-B',
    'client_admin',
    'active',
    null,
    null,
    null,
    null,
    null
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    'QA-CP2-CLIENT-B',
    'client_member',
    'active',
    null,
    null,
    null,
    null,
    null
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000006',
    'QA-CP2-CLIENT-A',
    'client_member',
    'suspended',
    null,
    null,
    null,
    null,
    null
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    '20000000-0000-4000-8000-000000000007',
    'QA-CP2-CLIENT-A',
    'client_member',
    'revoked',
    null,
    null,
    clock_timestamp(),
    '10000000-0000-4000-8000-000000000001',
    'QA-CP2-revoked'
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000008',
    'QA-CP2-CLIENT-A',
    'client_member',
    'active',
    null,
    null,
    null,
    null,
    null
  );

insert into public.client_portal_applications (
  id, user_id, email_normalized, contact_name, status, privacy_notice_version
) values (
  '41000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000005',
  'pending@example.invalid',
  'QA-CP2-Pending User',
  'pending_review',
  'qa-cp2-privacy-v1'
);

insert into public.client_portal_profile_change_requests (
  id, client_id, requested_by, proposed_changes
) values (
  '42000000-0000-4000-8000-000000000001',
  'QA-CP2-CLIENT-A',
  '20000000-0000-4000-8000-000000000002',
  '{"phone":"+34900000003"}'::jsonb
);

insert into public.client_portal_property_change_requests (
  id, client_id, property_id, requested_by, proposed_changes
) values (
  '43000000-0000-4000-8000-000000000001',
  'QA-CP2-CLIENT-A',
  'QA-CP2-PROPERTY-A',
  '20000000-0000-4000-8000-000000000002',
  '{"city":"QA-CP2-City"}'::jsonb
);

insert into public.client_service_requests (
  id, client_id, property_id, requested_by, service_type,
  preferred_date, preferred_time_window, notes, status, idempotency_key
) values
  (
    '44000000-0000-4000-8000-000000000001',
    'QA-CP2-CLIENT-A',
    'QA-CP2-PROPERTY-A',
    '20000000-0000-4000-8000-000000000002',
    'regular_cleaning',
    current_date + 10,
    'morning',
    'QA-CP2-Synthetic request A',
    'pending_review',
    '44000000-0000-4000-8000-000000000011'
  ),
  (
    '44000000-0000-4000-8000-000000000002',
    'QA-CP2-CLIENT-B',
    'QA-CP2-PROPERTY-B',
    '20000000-0000-4000-8000-000000000004',
    'commercial_cleaning',
    current_date + 11,
    'afternoon',
    'QA-CP2-Synthetic request B',
    'pending_review',
    '44000000-0000-4000-8000-000000000012'
  );

insert into public.invoice_document_records (
  id, invoice_id, object_key, sha256, byte_size, mime_type,
  renderer_version, template_version, invoice_snapshot_hash, status, created_by
) values
  (
    '50000000-0000-4000-8000-000000000001',
    'QA-CP2-INVOICE-A',
    '51000000-0000-4000-8000-000000000001/52000000-0000-4000-8000-000000000001.pdf',
    repeat('e', 64),
    128,
    'application/pdf',
    'QA-CP2-renderer',
    'QA-CP2-template',
    repeat('f', 64),
    'ready',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'QA-CP2-INVOICE-B',
    '51000000-0000-4000-8000-000000000002/52000000-0000-4000-8000-000000000002.pdf',
    repeat('1', 64),
    128,
    'application/pdf',
    'QA-CP2-renderer',
    'QA-CP2-template',
    repeat('2', 64),
    'ready',
    '10000000-0000-4000-8000-000000000001'
  );

insert into public.client_portal_legal_acceptances (
  id, document_key, document_version, document_sha256, user_id,
  membership_id, client_id, locale, correlation_id
) values (
  '53000000-0000-4000-8000-000000000001',
  'portal-terms',
  'QA-CP2-v1',
  repeat('3', 64),
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'QA-CP2-CLIENT-A',
  'es-ES',
  '53000000-0000-4000-8000-000000000011'
);
