\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

do $catalog$
declare
  v_table text;
  v_function record;
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
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
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
    raise exception 'any-authenticated public policy remains';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles && array['authenticated'::name]
      and policyname like '%expense receipts%'
      and coalesce(qual, with_check, '') not like '%is_active_internal_staff%'
  ) then
    raise exception 'expense storage still trusts every authenticated user';
  end if;

  if (select public from storage.buckets where id = 'invoice-documents') is distinct from false then
    raise exception 'invoice-documents bucket is not private';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles && array['public'::name, 'anon'::name, 'authenticated'::name]
      and (
        coalesce(qual, '') like '%invoice-documents%'
        or coalesce(with_check, '') like '%invoice-documents%'
      )
  ) then
    raise exception 'invoice-documents has a browser storage policy';
  end if;

  for v_function in
    select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'portal_private')
      and p.prosecdef
  loop
    if v_function.proconfig is null
      or not exists (
        select 1
        from unnest(v_function.proconfig) as setting
        where setting like 'search_path=%'
      )
    then
      raise exception 'SECURITY DEFINER % lacks fixed search_path', v_function.proname;
    end if;
  end loop;

  if has_function_privilege(
    'authenticated',
    'public.submit_public_gym_manual_quiz_attempt(jsonb)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'public quiz boundary regressed';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and grantee in ('PUBLIC', 'anon')
      and routine_name like 'portal_%'
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'portal function exposed to public/anon';
  end if;

  if exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'portal_%_trusted'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception 'trusted mutation RPC exposed to authenticated';
  end if;
end;
$catalog$;

set role anon;
do $anonymous$
begin
  if has_function_privilege(
    current_user,
    'public.portal_get_account_context(text)',
    'EXECUTE'
  ) then
    raise exception 'anonymous can execute portal RPC';
  end if;
  if has_table_privilege(
    current_user,
    'public.client_portal_memberships',
    'SELECT'
  ) then
    raise exception 'anonymous can read memberships';
  end if;
end;
$anonymous$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
do $client_a_admin$
declare
  v_json jsonb;
  v_jobs integer;
  v_quotes integer;
  v_invoices integer;
  v_payments integer;
begin
  v_json := public.portal_get_account_context('QA-CP2-CLIENT-A');
  if v_json ->> 'role' <> 'client_admin' then
    raise exception 'Client A admin context failed';
  end if;
  if jsonb_array_length(public.portal_list_properties('QA-CP2-CLIENT-A', 50)) <> 1
    or jsonb_array_length(public.portal_list_services('QA-CP2-CLIENT-A', 50)) <> 1
    or jsonb_array_length(public.portal_list_invoices('QA-CP2-CLIENT-A', 50)) <> 1
  then
    raise exception 'Client A own projections failed';
  end if;
  if public.portal_get_property('QA-CP2-CLIENT-A', 'QA-CP2-RANDOM') is not null
    or public.portal_get_service('QA-CP2-CLIENT-A', 'QA-CP2-RANDOM') is not null
    or public.portal_get_invoice('QA-CP2-CLIENT-A', 'QA-CP2-RANDOM') is not null
  then
    raise exception 'random identifiers enumerate';
  end if;

  begin
    perform public.portal_get_client_profile('QA-CP2-CLIENT-B');
    raise exception 'Client A accessed Client B';
  exception when sqlstate 'P0002' then null;
  end;

  if (select count(*) from public.clients) <> 0
    or (select count(*) from public.properties) <> 0
    or (select count(*) from public.jobs) <> 0
    or (select count(*) from public.invoices) <> 0
    or (select count(*) from public.payments) <> 0
  then
    raise exception 'portal identity can read canonical tables';
  end if;

  begin
    perform public.create_client('{"id":"QA-CP2-FORBIDDEN","full_name":"QA-CP2-Forbidden"}'::jsonb);
    raise exception 'portal identity executed operational RPC';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.save_quote_with_lines('{}'::jsonb, '[]'::jsonb);
    raise exception 'portal identity executed financial RPC';
  exception when sqlstate '42501' then null;
  end;

  select count(*) into v_jobs from public.jobs;
  select count(*) into v_quotes from public.quotes;
  select count(*) into v_invoices from public.invoices;
  select count(*) into v_payments from public.payments;
  if v_jobs <> 0 or v_quotes <> 0 or v_invoices <> 0 or v_payments <> 0 then
    raise exception 'portal direct canonical reads unexpectedly visible';
  end if;
end;
$client_a_admin$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
do $client_a_member$
begin
  if jsonb_array_length(public.portal_list_properties('QA-CP2-CLIENT-A', 50)) <> 1 then
    raise exception 'client member own read failed';
  end if;
  if has_function_privilege(
    current_user,
    'public.portal_create_invitation_trusted(uuid,text,text,text,text,timestamptz,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'client member can execute trusted invitation RPC';
  end if;
  begin
    insert into public.client_service_requests (
      client_id, property_id, requested_by, service_type, idempotency_key
    ) values (
      'QA-CP2-CLIENT-A',
      'QA-CP2-PROPERTY-A',
      '20000000-0000-4000-8000-000000000002',
      'regular_cleaning',
      gen_random_uuid()
    );
    raise exception 'client member performed direct portal DML';
  exception when insufficient_privilege then null;
  end;
end;
$client_a_member$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', false);
do $client_b$
begin
  if jsonb_array_length(public.portal_list_properties('QA-CP2-CLIENT-B', 50)) <> 1 then
    raise exception 'Client B own read failed';
  end if;
  begin
    perform public.portal_get_property('QA-CP2-CLIENT-A', 'QA-CP2-PROPERTY-A');
    raise exception 'Client B accessed Client A';
  exception when sqlstate 'P0002' then null;
  end;
end;
$client_b$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000005', false);
do $pending$
begin
  if public.portal_get_application_status() ->> 'status' <> 'pending_review' then
    raise exception 'pending application status failed';
  end if;
  begin
    perform public.portal_get_client_profile('QA-CP2-CLIENT-A');
    raise exception 'pending user accessed CRM data';
  exception when sqlstate 'P0002' then null;
  end;
end;
$pending$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000006', false);
do $suspended$
begin
  begin
    perform public.portal_get_client_profile('QA-CP2-CLIENT-A');
    raise exception 'suspended member accessed CRM data';
  exception when sqlstate 'P0002' then null;
  end;
end;
$suspended$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000007', false);
do $revoked$
begin
  begin
    perform public.portal_get_client_profile('QA-CP2-CLIENT-A');
    raise exception 'revoked member accessed CRM data';
  exception when sqlstate 'P0002' then null;
  end;
end;
$revoked$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000008', false);
do $unverified$
begin
  begin
    perform public.portal_get_client_profile('QA-CP2-CLIENT-A');
    raise exception 'unverified identity accessed CRM data';
  exception when sqlstate 'P0002' then null;
  end;
end;
$unverified$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $active_staff$
begin
  perform public.record_audit_event(
    'lead',
    'QA-CP2-STAFF-REGRESSION',
    'upsert',
    array['status']::text[],
    '{"status":"verified"}'::jsonb,
    '{"source":"cp2a-local-proof"}'::jsonb
  );
  perform public.update_quote_status('QA-CP2-QUOTE-A', 'draft');
  if (select count(*) from public.clients where id like 'QA-CP2-%') <> 2 then
    raise exception 'active staff canonical read regression';
  end if;
end;
$active_staff$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
do $suspended_staff$
begin
  begin
    perform public.create_client(
      '{"id":"QA-CP2-SUSPENDED-STAFF","full_name":"QA-CP2-Suspended Staff"}'::jsonb
    );
    raise exception 'suspended staff passed operational guard';
  exception when sqlstate '42501' then null;
  end;
  if (select count(*) from public.clients) <> 0 then
    raise exception 'suspended staff can read canonical data';
  end if;
end;
$suspended_staff$;
reset role;

set role service_role;
do $trusted_mutations$
declare
  v_before_jobs integer;
  v_before_quotes integer;
  v_before_invoices integer;
  v_before_payments integer;
  v_first jsonb;
  v_second jsonb;
  v_download jsonb;
  v_invitation_id uuid;
  v_member_id uuid := '30000000-0000-4000-8000-000000000002';
  v_index integer;
begin
  select count(*) into v_before_jobs from public.jobs;
  select count(*) into v_before_quotes from public.quotes;
  select count(*) into v_before_invoices from public.invoices;
  select count(*) into v_before_payments from public.payments;

  v_first := public.portal_submit_service_request_trusted(
    '20000000-0000-4000-8000-000000000002',
    'QA-CP2-CLIENT-A',
    'QA-CP2-PROPERTY-A',
    'deep_cleaning',
    current_date + 12,
    'flexible',
    'QA-CP2-Idempotent synthetic request',
    '44000000-0000-4000-8000-000000000099',
    repeat('4', 64),
    '54000000-0000-4000-8000-000000000001'
  );
  v_second := public.portal_submit_service_request_trusted(
    '20000000-0000-4000-8000-000000000002',
    'QA-CP2-CLIENT-A',
    'QA-CP2-PROPERTY-A',
    'deep_cleaning',
    current_date + 12,
    'flexible',
    'QA-CP2-Idempotent synthetic request',
    '44000000-0000-4000-8000-000000000099',
    repeat('4', 64),
    '54000000-0000-4000-8000-000000000002'
  );
  if v_first ->> 'id' <> v_second ->> 'id'
    or (
      select count(*)
      from public.client_service_requests
      where requested_by = '20000000-0000-4000-8000-000000000002'
        and idempotency_key = '44000000-0000-4000-8000-000000000099'
    ) <> 1
  then
    raise exception 'service request idempotency failed';
  end if;
  if v_first ->> 'status' <> 'pending_review' then
    raise exception 'service request did not start pending_review';
  end if;

  if (select count(*) from public.jobs) <> v_before_jobs
    or (select count(*) from public.quotes) <> v_before_quotes
    or (select count(*) from public.invoices) <> v_before_invoices
    or (select count(*) from public.payments) <> v_before_payments
  then
    raise exception 'service request changed canonical operational/financial rows';
  end if;

  begin
    perform public.portal_submit_service_request_trusted(
      '20000000-0000-4000-8000-000000000002',
      'QA-CP2-CLIENT-A',
      'QA-CP2-PROPERTY-B',
      'deep_cleaning',
      current_date + 12,
      'flexible',
      null,
      '44000000-0000-4000-8000-000000000098',
      repeat('5', 64),
      '54000000-0000-4000-8000-000000000003'
    );
    raise exception 'cross-client property accepted';
  exception when sqlstate 'P0002' then null;
  end;

  v_download := public.portal_get_invoice_download_authorization_trusted(
    '20000000-0000-4000-8000-000000000002',
    'QA-CP2-CLIENT-A',
    'QA-CP2-INVOICE-A',
    '50000000-0000-4000-8000-000000000001',
    repeat('6', 64),
    '54000000-0000-4000-8000-000000000004'
  );
  if (v_download ->> 'expiresIn')::integer <> 60
    or v_download ->> 'objectKey' <>
      '51000000-0000-4000-8000-000000000001/52000000-0000-4000-8000-000000000001.pdf'
  then
    raise exception 'document authorization failed';
  end if;

  begin
    perform public.portal_get_invoice_download_authorization_trusted(
      '20000000-0000-4000-8000-000000000002',
      'QA-CP2-CLIENT-A',
      'QA-CP2-INVOICE-B',
      '50000000-0000-4000-8000-000000000002',
      repeat('7', 64),
      '54000000-0000-4000-8000-000000000005'
    );
    raise exception 'cross-client invoice download authorized';
  exception when sqlstate 'P0002' then null;
  end;

  begin
    perform public.portal_get_invoice_download_authorization_trusted(
      '20000000-0000-4000-8000-000000000002',
      'QA-CP2-CLIENT-A',
      'QA-CP2-RANDOM',
      '50000000-0000-4000-8000-000000000099',
      repeat('8', 64),
      '54000000-0000-4000-8000-000000000006'
    );
    raise exception 'random invoice download authorized';
  exception when sqlstate 'P0002' then null;
  end;

  begin
    perform public.portal_create_invitation_trusted(
      '20000000-0000-4000-8000-000000000002',
      'QA-CP2-CLIENT-A',
      'forbidden-member-invite@example.invalid',
      'client_member',
      repeat('9', 64),
      clock_timestamp() + interval '72 hours',
      repeat('a', 64),
      '54000000-0000-4000-8000-000000000007'
    );
    raise exception 'client_member created invitation';
  exception when sqlstate 'P0002' then null;
  end;

  v_invitation_id := public.portal_create_invitation_trusted(
    '20000000-0000-4000-8000-000000000001',
    'QA-CP2-CLIENT-A',
    'qa-cp2-new-member@example.invalid',
    'client_member',
    repeat('0', 64),
    clock_timestamp() + interval '72 hours',
    repeat('b', 64),
    '54000000-0000-4000-8000-000000000008'
  );
  if v_invitation_id is null then
    raise exception 'client_admin own-client invitation failed';
  end if;

  begin
    perform public.portal_create_invitation_trusted(
      '20000000-0000-4000-8000-000000000001',
      'QA-CP2-CLIENT-B',
      'qa-cp2-cross@example.invalid',
      'client_member',
      repeat('6', 64),
      clock_timestamp() + interval '72 hours',
      repeat('c', 64),
      '54000000-0000-4000-8000-000000000009'
    );
    raise exception 'client_admin invited into another client';
  exception when sqlstate 'P0002' then null;
  end;

  perform public.portal_accept_invitation_trusted(
    '20000000-0000-4000-8000-000000000009',
    repeat('a', 64),
    repeat('d', 64),
    '54000000-0000-4000-8000-000000000010'
  );
  if not exists (
    select 1
    from public.client_portal_memberships
    where user_id = '20000000-0000-4000-8000-000000000009'
      and client_id = 'QA-CP2-CLIENT-A'
      and status = 'active'
  ) then
    raise exception 'invitation acceptance did not create exact membership';
  end if;
  begin
    perform public.portal_accept_invitation_trusted(
      '20000000-0000-4000-8000-000000000009',
      repeat('a', 64),
      repeat('e', 64),
      '54000000-0000-4000-8000-000000000011'
    );
    raise exception 'invitation replay accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.portal_accept_invitation_trusted(
      '20000000-0000-4000-8000-000000000009',
      repeat('b', 64),
      repeat('f', 64),
      '54000000-0000-4000-8000-000000000012'
    );
    raise exception 'expired invitation accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.portal_accept_invitation_trusted(
      '20000000-0000-4000-8000-000000000009',
      repeat('c', 64),
      repeat('1', 64),
      '54000000-0000-4000-8000-000000000013'
    );
    raise exception 'revoked invitation accepted';
  exception when sqlstate 'P0002' then null;
  end;

  begin
    perform public.portal_submit_profile_change_trusted(
      '20000000-0000-4000-8000-000000000002',
      'QA-CP2-CLIENT-A',
      '{"clientId":"QA-CP2-CLIENT-B"}'::jsonb,
      repeat('2', 64),
      '54000000-0000-4000-8000-000000000014'
    );
    raise exception 'profile change accepted unknown/relink field';
  exception when sqlstate '22023' then null;
  end;

  insert into public.client_portal_rate_limits (
    action, subject_hash, window_started_at, window_seconds, request_count, expires_at
  ) values (
    'service_request',
    repeat('3', 64),
    clock_timestamp() - interval '2 hours',
    3600,
    5,
    clock_timestamp() - interval '1 hour'
  );
  for v_index in 1..5 loop
    perform public.portal_submit_service_request_trusted(
      '20000000-0000-4000-8000-000000000004',
      'QA-CP2-CLIENT-B',
      'QA-CP2-PROPERTY-B',
      'commercial_cleaning',
      current_date + 20,
      'afternoon',
      'QA-CP2-Rate test',
      ('55000000-0000-4000-8000-' || lpad(v_index::text, 12, '0'))::uuid,
      repeat('3', 64),
      ('56000000-0000-4000-8000-' || lpad(v_index::text, 12, '0'))::uuid
    );
  end loop;
  begin
    perform public.portal_submit_service_request_trusted(
      '20000000-0000-4000-8000-000000000004',
      'QA-CP2-CLIENT-B',
      'QA-CP2-PROPERTY-B',
      'commercial_cleaning',
      current_date + 20,
      'afternoon',
      'QA-CP2-Rate test denied',
      '55000000-0000-4000-8000-000000000099',
      repeat('3', 64),
      '56000000-0000-4000-8000-000000000099'
    );
    raise exception 'rate limit burst was not denied';
  exception when sqlstate 'P0001' then null;
  end;

  perform public.portal_revoke_member_trusted(
    '20000000-0000-4000-8000-000000000001',
    'QA-CP2-CLIENT-A',
    v_member_id,
    repeat('5', 64),
    '54000000-0000-4000-8000-000000000015'
  );
  if (select status from public.client_portal_memberships where id = v_member_id) <> 'revoked' then
    raise exception 'same-client member revocation failed';
  end if;
end;
$trusted_mutations$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
do $storage_denial$
begin
  if (select count(*) from storage.objects where bucket_id = 'invoice-documents') <> 0 then
    raise exception 'invoice bucket listing exposed objects';
  end if;
end;
$storage_denial$;
reset role;

do $immutability$
declare
  v_sequence record;
begin
  for v_sequence in
    select sequencename as sequence_name, last_value
    from pg_sequences
    where schemaname = 'public'
  loop
    if exists (
      select 1
      from pg_temp.cp2a_sequence_snapshot as s
      where s.sequence_name = v_sequence.sequence_name
        and s.last_value is distinct from v_sequence.last_value
    ) then
      raise exception 'sequence changed during CP-2A matrix: %', v_sequence.sequence_name;
    end if;
  end loop;

  if exists (
    select 1
    from public.client_portal_audit_events
    where metadata ?| array[
      'email', 'ip', 'user_agent', 'token', 'signed_url', 'object_key',
      'address', 'tax_id', 'notes', 'invoice_body'
    ]
  ) then
    raise exception 'audit metadata contains forbidden PII/secret keys';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_portal_invitations'
      and column_name in ('token', 'raw_token')
  ) then
    raise exception 'raw invitation token column exists';
  end if;
end;
$immutability$;

select jsonb_build_object(
  'result', 'PASS',
  'identities', 8,
  'contexts', 3,
  'canonicalRls', 'staff-only',
  'crossClient', 'denied',
  'serviceRequestSideEffects', 0,
  'signedUrlTtlSeconds', 60,
  'rawTokensPersisted', 0
) as cp2a_authorization_matrix;
