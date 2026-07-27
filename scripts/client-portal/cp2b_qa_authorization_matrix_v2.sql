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

select set_config('app.cp2b.project_ref', :'project_ref', false);
select set_config('app.cp2b.run_id', :'cp2b_run_id', false);
select set_config('app.cp2b.active_staff_user_id', :'active_staff_user_id', false);
select set_config('app.cp2b.suspended_staff_user_id', :'suspended_staff_user_id', false);
select set_config('app.cp2b.admin_a_user_id', :'admin_a_user_id', false);
select set_config('app.cp2b.member_a_user_id', :'member_a_user_id', false);
select set_config('app.cp2b.pending_user_id', :'pending_user_id', false);
select set_config('app.cp2b.suspended_member_user_id', :'suspended_member_user_id', false);
select set_config('app.cp2b.revoked_member_user_id', :'revoked_member_user_id', false);
select set_config('app.cp2b.unverified_user_id', :'unverified_user_id', false);
select set_config('app.cp2b.invitee_user_id', :'invitee_user_id', false);
select set_config('app.cp2b.client_a_id', :'client_a_id', false);
select set_config('app.cp2b.client_b_id', :'client_b_id', false);
select set_config('app.cp2b.property_a_id', :'property_a_id', false);
select set_config('app.cp2b.invoice_a_id', :'invoice_a_id', false);
select set_config('app.cp2b.invoice_b_id', :'invoice_b_id', false);
select set_config('app.cp2b.document_a_id', :'document_a_id', false);
select set_config('app.cp2b.document_b_id', :'document_b_id', false);
select set_config('app.cp2b.document_a_object_key', :'document_a_object_key', false);
select set_config('app.cp2b.correlation_id', :'correlation_id', false);
select set_config('app.cp2b.matrix_idempotency_key', :'matrix_idempotency_key', false);
select set_config('app.cp2b.random_record_id', :'random_record_id', false);

do $guard$
begin
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
end;
$guard$;

begin;

do $catalog$
declare
  v_table text;
begin
  foreach v_table in array array[
    'internal_staff_memberships',
    'client_portal_invitations',
    'client_portal_memberships',
    'client_portal_applications',
    'client_portal_profile_change_requests',
    'client_portal_property_change_requests',
    'client_service_requests',
    'client_portal_audit_events',
    'client_portal_rate_limits',
    'invoice_document_records',
    'client_portal_legal_acceptances'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'RLS/FORCE RLS missing on %', v_table;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and roles && array['authenticated'::name]
      and (
        lower(coalesce(qual, '')) in ('true', '(true)', '((auth.uid() is not null))')
        or lower(coalesce(with_check, '')) in ('true', '(true)', '((auth.uid() is not null))')
        or lower(coalesce(qual, '')) like '%(select auth.uid()) is not null%'
      )
  ) then
    raise exception 'any-authenticated policy remains';
  end if;

  if (select public from storage.buckets where id = 'invoice-documents')
    is distinct from false
  then
    raise exception 'invoice bucket is not private';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'portal_private')
      and p.prosecdef
      and (
        p.proconfig is null
        or not exists (
          select 1 from unnest(p.proconfig) setting
          where setting like 'search_path=%'
        )
      )
  ) then
    raise exception 'security definer without fixed search_path';
  end if;
end;
$catalog$;

-- Active member A: own data allowed, B and random IDs denied generically.
select set_config('request.jwt.claim.sub', :'member_a_user_id', true);
set local role authenticated;

do $member_a$
declare
  v_json jsonb;
begin
  v_json := public.portal_get_account_context(
    current_setting('app.cp2b.client_a_id')
  );
  if v_json ->> 'clientId' <> current_setting('app.cp2b.client_a_id') then
    raise exception 'member A own context failed';
  end if;
  if jsonb_array_length(public.portal_list_properties(
    current_setting('app.cp2b.client_a_id'), 50
  )) <> 1 then
    raise exception 'member A property list failed';
  end if;
  if jsonb_array_length(public.portal_list_services(
    current_setting('app.cp2b.client_a_id'), 50
  )) <> 1 then
    raise exception 'member A service list failed';
  end if;
  if jsonb_array_length(public.portal_list_invoices(
    current_setting('app.cp2b.client_a_id'), 50
  )) <> 1 then
    raise exception 'member A invoice list failed';
  end if;

  begin
    perform public.portal_get_client_profile(
      current_setting('app.cp2b.client_b_id')
    );
    raise exception 'cross-client profile unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;
  if public.portal_get_property(
    current_setting('app.cp2b.client_a_id'),
    current_setting('app.cp2b.random_record_id')
  ) is not null then
    raise exception 'random property unexpectedly enumerable';
  end if;
  begin
    perform public.portal_get_invoice(
      current_setting('app.cp2b.client_b_id'),
      current_setting('app.cp2b.invoice_b_id')
    );
    raise exception 'cross-client invoice unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;

  if (select count(*) from public.clients) <> 0
    or (select count(*) from public.invoices) <> 0
    or (select count(*) from public.payments) <> 0
  then
    raise exception 'portal canonical RLS exposure';
  end if;

  begin
    perform public.require_authenticated_write();
    raise exception 'portal operational guard unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.require_authenticated_financial_write();
    raise exception 'portal financial guard unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end;
$member_a$;

reset role;

-- Member cannot administer; admin is limited to its explicit client.
do $roles$
begin
  begin
    perform public.portal_create_invitation_trusted(
      current_setting('app.cp2b.member_a_user_id')::uuid,
      current_setting('app.cp2b.client_a_id'),
      'matrix-member.' || current_setting('app.cp2b.run_id')
        || '@example.invalid',
      'client_member',
      repeat('3', 64),
      clock_timestamp() + interval '1 hour',
      repeat('4', 64),
      current_setting('app.cp2b.correlation_id')::uuid
    );
    raise exception 'member invitation unexpectedly allowed';
  exception
    when insufficient_privilege or sqlstate 'P0002' then null;
  end;

  perform public.portal_create_invitation_trusted(
    current_setting('app.cp2b.admin_a_user_id')::uuid,
    current_setting('app.cp2b.client_a_id'),
    'matrix-admin.' || current_setting('app.cp2b.run_id')
      || '@example.invalid',
    'client_member',
    repeat('5', 64),
    clock_timestamp() + interval '1 hour',
    repeat('6', 64),
    current_setting('app.cp2b.correlation_id')::uuid
  );

  begin
    perform public.portal_create_invitation_trusted(
      current_setting('app.cp2b.admin_a_user_id')::uuid,
      current_setting('app.cp2b.client_b_id'),
      'matrix-cross.' || current_setting('app.cp2b.run_id')
        || '@example.invalid',
      'client_member',
      repeat('7', 64),
      clock_timestamp() + interval '1 hour',
      repeat('8', 64),
      current_setting('app.cp2b.correlation_id')::uuid
    );
    raise exception 'admin A cross-client invitation unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;
end;
$roles$;

-- Pending, suspended, revoked and unverified identities receive no CRM data.
do $inactive$
declare
  v_user uuid;
begin
  foreach v_user in array array[
    current_setting('app.cp2b.pending_user_id')::uuid,
    current_setting('app.cp2b.suspended_member_user_id')::uuid,
    current_setting('app.cp2b.revoked_member_user_id')::uuid,
    current_setting('app.cp2b.unverified_user_id')::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    begin
      perform public.portal_get_account_context(
        current_setting('app.cp2b.client_a_id')
      );
      raise exception 'inactive identity unexpectedly allowed';
    exception when sqlstate 'P0002' then null;
    end;
  end loop;

  perform set_config(
    'request.jwt.claim.sub',
    current_setting('app.cp2b.pending_user_id'),
    true
  );
  if public.portal_get_application_status() ->> 'status' <> 'pending_review' then
    raise exception 'pending application status failed';
  end if;
end;
$inactive$;

-- Service request remains pending_review and creates no canonical side effects.
do $service_request$
declare
  v_jobs bigint := (select count(*) from public.jobs);
  v_quotes bigint := (select count(*) from public.quotes);
  v_invoices bigint := (select count(*) from public.invoices);
  v_payments bigint := (select count(*) from public.payments);
  v_result jsonb;
begin
  v_result := public.portal_submit_service_request_trusted(
    current_setting('app.cp2b.member_a_user_id')::uuid,
    current_setting('app.cp2b.client_a_id'),
    current_setting('app.cp2b.property_a_id'),
    'regular_cleaning',
    current_date + 20,
    'flexible',
    null,
    current_setting('app.cp2b.matrix_idempotency_key')::uuid,
    repeat('9', 64),
    current_setting('app.cp2b.correlation_id')::uuid
  );
  if v_result ->> 'status' <> 'pending_review' then
    raise exception 'service request not pending_review';
  end if;
  if (select count(*) from public.jobs) <> v_jobs
    or (select count(*) from public.quotes) <> v_quotes
    or (select count(*) from public.invoices) <> v_invoices
    or (select count(*) from public.payments) <> v_payments
  then
    raise exception 'service request canonical side effect';
  end if;
  if public.portal_submit_service_request_trusted(
    current_setting('app.cp2b.member_a_user_id')::uuid,
    current_setting('app.cp2b.client_a_id'),
    current_setting('app.cp2b.property_a_id'),
    'regular_cleaning',
    current_date + 20,
    'flexible',
    null,
    current_setting('app.cp2b.matrix_idempotency_key')::uuid,
    repeat('9', 64),
    current_setting('app.cp2b.correlation_id')::uuid
  ) ->> 'id' <> v_result ->> 'id' then
    raise exception 'service request idempotency failed';
  end if;
end;
$service_request$;

-- Invitation acceptance is single-use; expired/revoked tokens fail.
do $invitations$
declare
  v_result jsonb;
begin
  v_result := public.portal_accept_invitation_trusted(
    current_setting('app.cp2b.invitee_user_id')::uuid,
    repeat('a', 64),
    repeat('a', 64),
    current_setting('app.cp2b.correlation_id')::uuid
  );
  if v_result ->> 'status' <> 'active' then
    raise exception 'invitation acceptance failed';
  end if;
  begin
    perform public.portal_accept_invitation_trusted(
      current_setting('app.cp2b.invitee_user_id')::uuid,
      repeat('a', 64),
      repeat('b', 64),
      current_setting('app.cp2b.correlation_id')::uuid
    );
    raise exception 'invitation replay unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.portal_accept_invitation_trusted(
      current_setting('app.cp2b.invitee_user_id')::uuid,
      repeat('b', 64),
      repeat('c', 64),
      current_setting('app.cp2b.correlation_id')::uuid
    );
    raise exception 'expired invitation unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.portal_accept_invitation_trusted(
      current_setting('app.cp2b.invitee_user_id')::uuid,
      repeat('c', 64),
      repeat('d', 64),
      current_setting('app.cp2b.correlation_id')::uuid
    );
    raise exception 'revoked invitation unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;
end;
$invitations$;

-- Document authorization returns only exact owner path and 60-second TTL.
do $documents$
declare
  v_result jsonb;
begin
  v_result := public.portal_get_invoice_download_authorization_trusted(
    current_setting('app.cp2b.member_a_user_id')::uuid,
    current_setting('app.cp2b.client_a_id'),
    current_setting('app.cp2b.invoice_a_id'),
    current_setting('app.cp2b.document_a_id')::uuid,
    repeat('e', 64),
    current_setting('app.cp2b.correlation_id')::uuid
  );
  if v_result ->> 'objectKey' <>
      current_setting('app.cp2b.document_a_object_key')
    or (v_result ->> 'expiresIn')::integer <> 60
  then
    raise exception 'document authorization contract failed';
  end if;
  begin
    perform public.portal_get_invoice_download_authorization_trusted(
      current_setting('app.cp2b.member_a_user_id')::uuid,
      current_setting('app.cp2b.client_b_id'),
      current_setting('app.cp2b.invoice_b_id'),
      current_setting('app.cp2b.document_b_id')::uuid,
      repeat('f', 64),
      current_setting('app.cp2b.correlation_id')::uuid
    );
    raise exception 'cross-client document unexpectedly allowed';
  exception when sqlstate 'P0002' then null;
  end;
end;
$documents$;

-- Active staff retains guarded access; synthetic suspended staff is denied.
select set_config('request.jwt.claim.sub', :'active_staff_user_id', true);
do $staff$
begin
  if not portal_private.is_active_internal_staff(
    current_setting('app.cp2b.active_staff_user_id')::uuid
  ) then
    raise exception 'active staff boundary failed';
  end if;
  perform public.require_authenticated_write();
  perform public.require_authenticated_financial_write();

  perform set_config(
    'request.jwt.claim.sub',
    current_setting('app.cp2b.suspended_staff_user_id'),
    true
  );
  if portal_private.is_active_internal_staff(
    current_setting('app.cp2b.suspended_staff_user_id')::uuid
  ) then
    raise exception 'suspended staff unexpectedly active';
  end if;
  begin
    perform public.require_authenticated_write();
    raise exception 'suspended staff operational guard unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end;
$staff$;

-- The matrix is non-persistent; every test mutation is rolled back.
rollback;
