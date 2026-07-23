\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

do $guard$
begin
  if current_setting('app.cp2a.local_disposable', true) <> 'true' then
    raise exception 'CP-2A cleanup is local-disposable only' using errcode = '42501';
  end if;
  if current_setting('app.cp2a.project_ref', true) in (
    'kpvvydthlxupjjqqdpxy',
    'wfxnwfcdjainpojhbdri'
  ) then
    raise exception 'CP-2A cleanup rejects QA and production refs' using errcode = '42501';
  end if;
end;
$guard$;

delete from public.client_portal_audit_events
where actor_user_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009'
);
delete from public.audit_events
where entity_id like 'QA-CP2-%';
delete from public.client_portal_rate_limits;
delete from public.client_portal_legal_acceptances
where document_version = 'QA-CP2-v1';
delete from public.invoice_document_records
where invoice_id in ('QA-CP2-INVOICE-A', 'QA-CP2-INVOICE-B');
delete from public.client_service_requests
where client_id in ('QA-CP2-CLIENT-A', 'QA-CP2-CLIENT-B');
delete from public.client_portal_property_change_requests
where client_id in ('QA-CP2-CLIENT-A', 'QA-CP2-CLIENT-B');
delete from public.client_portal_profile_change_requests
where client_id in ('QA-CP2-CLIENT-A', 'QA-CP2-CLIENT-B');
delete from public.client_portal_applications
where email_normalized like '%@example.invalid';
delete from public.client_portal_memberships
where client_id in ('QA-CP2-CLIENT-A', 'QA-CP2-CLIENT-B');
delete from public.client_portal_invitations
where client_id in ('QA-CP2-CLIENT-A', 'QA-CP2-CLIENT-B');
delete from public.internal_staff_memberships
where user_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);

set local session_replication_role = replica;
delete from public.invoice_lines
where invoice_id in ('QA-CP2-INVOICE-A', 'QA-CP2-INVOICE-B');
delete from public.invoices
where id in ('QA-CP2-INVOICE-A', 'QA-CP2-INVOICE-B');
delete from public.jobs
where id in ('QA-CP2-JOB-A', 'QA-CP2-JOB-B');
delete from public.quote_lines
where quote_id in ('QA-CP2-QUOTE-A', 'QA-CP2-QUOTE-B');
delete from public.quotes
where id in ('QA-CP2-QUOTE-A', 'QA-CP2-QUOTE-B');
delete from public.properties
where id in ('QA-CP2-PROPERTY-A', 'QA-CP2-PROPERTY-B');
delete from public.clients
where id in ('QA-CP2-CLIENT-A', 'QA-CP2-CLIENT-B');
set local session_replication_role = origin;

do $assertions$
begin
  if exists (
    select 1
    from public.clients
    where id like 'QA-CP2-%'
  ) or exists (
    select 1
    from public.properties
    where id like 'QA-CP2-%'
  ) or exists (
    select 1
    from public.jobs
    where id like 'QA-CP2-%'
  ) or exists (
    select 1
    from public.quotes
    where id like 'QA-CP2-%'
  ) or exists (
    select 1
    from public.invoices
    where id like 'QA-CP2-%'
  ) or exists (
    select 1 from public.client_portal_memberships
  ) or exists (
    select 1 from public.client_portal_invitations
  ) or exists (
    select 1 from public.client_service_requests
  ) or exists (
    select 1 from public.invoice_document_records
  ) then
    raise exception 'CP-2A cleanup residue detected';
  end if;
end;
$assertions$;
