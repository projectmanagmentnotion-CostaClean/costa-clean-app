begin transaction read only;

set local statement_timeout = '30s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

do $cp3b3_qa_postcheck$
declare
  v_project_ref text := current_setting('app.cp3b3.project_ref', true);
  v_count integer;
begin
  if v_project_ref is distinct from 'kpvvydthlxupjjqqdpxy' then
    raise exception 'cp3b3_project_ref_mismatch' using errcode = '22023';
  end if;

  select count(*)
    into v_count
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'jobs' and column_name = 'public_reference')
      or (table_name = 'client_service_requests' and column_name in ('public_reference', 'idempotency_key'))
    );
  if v_count <> 3 then
    raise exception 'service_columns_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'public_reference'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'jobs_public_reference_not_null' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_service_requests'
      and column_name = 'public_reference'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'service_request_public_reference_not_null' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_service_requests'
      and column_name = 'idempotency_key'
      and data_type = 'uuid'
      and is_nullable = 'NO'
  ) then
    raise exception 'service_request_idempotency_not_null' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'public_reference'
      and column_default like '%generate_service_public_reference_v2%'
  ) then
    raise exception 'jobs_public_reference_default_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_service_requests'
      and column_name = 'public_reference'
      and column_default like '%generate_service_request_public_reference_v2%'
  ) then
    raise exception 'service_request_public_reference_default_missing' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
    and rel.relname in ('jobs', 'client_service_requests')
    and c.conname in (
      'jobs_public_reference_format',
      'client_service_requests_public_reference_format'
    );
  if v_count <> 2 then
    raise exception 'public_reference_constraint_mismatch' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'jobs'
      and c.conname = 'jobs_public_reference_format'
      and pg_get_constraintdef(c.oid, true) like '%public_reference IS NULL%'
      and pg_get_constraintdef(c.oid, true) like '%^CC-SV-[0-9A-F]{24}$%'
  ) then
    raise exception 'jobs_public_reference_constraint_invalid' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'client_service_requests'
      and c.conname = 'client_service_requests_public_reference_format'
      and pg_get_constraintdef(c.oid, true) like '%public_reference IS NULL%'
      and pg_get_constraintdef(c.oid, true) like '%^CC-SR-[0-9A-F]{24}$%'
  ) then
    raise exception 'service_request_public_reference_constraint_invalid' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
  from pg_class idx
  join pg_index i on i.indexrelid = idx.oid
  join pg_namespace n on n.oid = idx.relnamespace
  where n.nspname = 'public'
    and idx.relname in (
      'jobs_v2_public_reference_uidx',
      'client_service_requests_v2_public_reference_uidx',
      'client_service_requests_v2_idempotency_uidx'
    );
  if v_count <> 3 then
    raise exception 'service_reference_index_mismatch' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'jobs_v2_public_reference_uidx'
      and i.indisunique
      and pg_get_indexdef(idx.oid) like '%(public_reference)%'
      and coalesce(pg_get_expr(i.indpred, i.indrelid), '') like '%public_reference IS NOT NULL%'
  ) then
    raise exception 'jobs_public_reference_index_invalid' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'client_service_requests_v2_public_reference_uidx'
      and i.indisunique
      and pg_get_indexdef(idx.oid) like '%(public_reference)%'
      and coalesce(pg_get_expr(i.indpred, i.indrelid), '') like '%public_reference IS NOT NULL%'
  ) then
    raise exception 'service_request_public_reference_index_invalid' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'client_service_requests_v2_idempotency_uidx'
      and i.indisunique
      and pg_get_indexdef(idx.oid) like '%(requested_by, idempotency_key)%'
      and coalesce(pg_get_expr(i.indpred, i.indrelid), '') like '%idempotency_key IS NOT NULL%'
  ) then
    raise exception 'service_request_idempotency_index_invalid' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'portal_private'
    and p.proname in (
      'generate_service_public_reference_v2',
      'generate_service_request_public_reference_v2',
      'resolve_property_public_ref_v2',
      'resolve_property_id_by_public_ref_v2'
    );
  if v_count <> 4 then
    raise exception 'service_reference_helper_missing' using errcode = 'P0001';
  end if;

  if not (
    has_function_privilege('postgres', 'portal_private.resolve_property_public_ref_v2(text, text)', 'EXECUTE')
    and has_function_privilege('postgres', 'portal_private.resolve_property_id_by_public_ref_v2(text, text)', 'EXECUTE')
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'portal_private'
        and p.proname in (
          'resolve_property_public_ref_v2',
          'resolve_property_id_by_public_ref_v2'
        )
        and p.prosecdef
        and pg_get_userbyid(p.proowner) = 'postgres'
        and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=pg_catalog, public, portal_private%'
    )
  ) then
    raise exception 'property_resolution_helper_contract_mismatch' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      (p.proname = 'portal_list_services_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_limit integer')
      or (p.proname = 'portal_get_service_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_service_reference text')
      or (p.proname = 'portal_list_own_service_requests_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_limit integer')
      or (p.proname = 'portal_get_own_service_request_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_request_reference text')
      or (p.proname = 'portal_submit_service_request_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_property_public_ref text, p_service_type text, p_preferred_date date, p_idempotency_key uuid, p_preferred_time_window text, p_notes text')
      or (p.proname = 'portal_cancel_own_service_request_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_request_reference text, p_expected_version integer')
    )
    and p.prosecdef
    and pg_get_userbyid(p.proowner) = 'postgres'
    and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=pg_catalog, public, portal_private%';
  if v_count <> 6 then
    raise exception 'service_rpc_contract_mismatch' using errcode = 'P0001';
  end if;

  if not (
    has_function_privilege('authenticated', 'public.portal_list_services_v2(text, integer)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.portal_get_service_v2(text, text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.portal_list_own_service_requests_v2(text, integer)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.portal_get_own_service_request_v2(text, text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.portal_submit_service_request_v2(text, text, text, date, uuid, text, text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.portal_cancel_own_service_request_v2(text, text, integer)', 'EXECUTE')
  ) then
    raise exception 'authenticated_service_rpc_execute_missing' using errcode = 'P0001';
  end if;

  if has_function_privilege('anon', 'public.portal_list_services_v2(text, integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.portal_get_service_v2(text, text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.portal_list_own_service_requests_v2(text, integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.portal_get_own_service_request_v2(text, text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.portal_submit_service_request_v2(text, text, text, date, uuid, text, text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.portal_cancel_own_service_request_v2(text, text, integer)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_list_services_v2(text, integer)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_get_service_v2(text, text)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_list_own_service_requests_v2(text, integer)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_get_own_service_request_v2(text, text)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_submit_service_request_v2(text, text, text, date, uuid, text, text)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_cancel_own_service_request_v2(text, text, integer)', 'EXECUTE')
  then
    raise exception 'service_rpc_execute_privilege_leak' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'portal_list_services_v2',
        'portal_get_service_v2',
        'portal_get_own_service_request_v2'
      )
      and pg_get_functiondef(p.oid) like '%display_code%'
  ) then
    raise exception 'service_rpc_display_code_leak' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
  from (
    values
      ('jobs'),
      ('client_service_requests'),
      ('clients'),
      ('properties'),
      ('invoices'),
      ('payments')
  ) as tables(table_name)
  where
    has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') = false
    and has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE') = false
    and has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') = false;
  if v_count <> 6 then
    raise exception 'client_write_privileges_present' using errcode = 'P0001';
  end if;
end;
$cp3b3_qa_postcheck$;

select 'cp3b3_qa_postcheck'::text as cp3b3_qa_postcheck;

rollback;
