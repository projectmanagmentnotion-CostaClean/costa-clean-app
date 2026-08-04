begin transaction read only;

set local statement_timeout = '30s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

do $cp3b2a_postcheck$
declare
  v_project_ref text := current_setting('app.cp3b2a.project_ref', true);
  v_run_id text := current_setting('app.cp3b2a.run_id', true);
  v_baseline_auth_users bigint := nullif(current_setting('app.cp3b2a.baseline_auth_users_count', true), '')::bigint;
  v_baseline_clients bigint := nullif(current_setting('app.cp3b2a.baseline_clients_count', true), '')::bigint;
  v_baseline_properties bigint := nullif(current_setting('app.cp3b2a.baseline_properties_count', true), '')::bigint;
  v_baseline_memberships bigint := nullif(current_setting('app.cp3b2a.baseline_memberships_count', true), '')::bigint;
  v_baseline_profile_requests bigint := nullif(current_setting('app.cp3b2a.baseline_profile_requests_count', true), '')::bigint;
  v_baseline_property_requests bigint := nullif(current_setting('app.cp3b2a.baseline_property_requests_count', true), '')::bigint;
  v_baseline_audit_events bigint := nullif(current_setting('app.cp3b2a.baseline_audit_events_count', true), '')::bigint;
  v_baseline_rate_limits bigint := nullif(current_setting('app.cp3b2a.baseline_rate_limits_count', true), '')::bigint;
  v_baseline_profile_digest text := current_setting('app.cp3b2a.baseline_profile_history_digest', true);
  v_baseline_property_digest text := current_setting('app.cp3b2a.baseline_property_history_digest', true);
  v_baseline_migration_digest text := current_setting('app.cp3b2a.baseline_migration_history_digest', true);
  v_expected_columns integer;
  v_new_columns_null boolean;
  v_constraint_count integer;
  v_index_count integer;
  v_helper_count integer;
  v_rpc_count integer;
  v_profile_hist_digest text;
  v_property_hist_digest text;
  v_migration_hist_digest text;
  v_auth_users bigint;
  v_clients bigint;
  v_properties bigint;
  v_memberships bigint;
  v_profile_requests bigint;
  v_property_requests bigint;
  v_audit_events bigint;
  v_rate_limits bigint;
begin
  if v_project_ref is distinct from 'kpvvydthlxupjjqqdpxy' then
    raise exception 'cp3b2a_project_ref_mismatch' using errcode = '22023';
  end if;
  if v_run_id is null or char_length(v_run_id) < 8 then
    raise exception 'cp3b2a_run_id_required' using errcode = '22023';
  end if;

  select count(*) into v_expected_columns
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'client_portal_profile_change_requests' and column_name in ('idempotency_key', 'public_reference'))
      or (table_name = 'client_portal_property_change_requests' and column_name in ('idempotency_key', 'public_reference'))
    );
  if v_expected_columns <> 4 then
    raise exception 'column_contract_mismatch' using errcode = '23514';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'client_portal_profile_change_requests' and column_name in ('idempotency_key', 'public_reference'))
        or (table_name = 'client_portal_property_change_requests' and column_name in ('idempotency_key', 'public_reference'))
      )
      and (
        (column_name = 'idempotency_key' and (data_type <> 'uuid' or is_nullable <> 'YES'))
        or (column_name = 'public_reference' and (data_type <> 'text' or is_nullable <> 'YES'))
      )
  ) then
    raise exception 'column_type_or_nullability_mismatch' using errcode = '23514';
  end if;

  select not exists (
    select 1
    from public.client_portal_profile_change_requests
    where idempotency_key is not null
       or public_reference is not null
  )
  and not exists (
    select 1
    from public.client_portal_property_change_requests
    where idempotency_key is not null
       or public_reference is not null
  ) into v_new_columns_null;
  if not v_new_columns_null then
    raise exception 'historical_rows_modified' using errcode = '23514';
  end if;

  select count(*) into v_constraint_count
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
    and rel.relname in ('client_portal_profile_change_requests', 'client_portal_property_change_requests')
    and c.conname in (
      'client_portal_profile_change_public_reference_format',
      'client_portal_property_change_public_reference_format'
    );
  if v_constraint_count <> 2 then
    raise exception 'constraint_contract_mismatch' using errcode = '23514';
  end if;
  if exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'client_portal_profile_change_requests'
      and c.conname = 'client_portal_profile_change_public_reference_format'
      and not (
        pg_get_constraintdef(c.oid, true) like '%public_reference IS NULL%'
        and pg_get_constraintdef(c.oid, true) like '%^CC-PR-[0-9A-F]{24}$%'
      )
  ) then
    raise exception 'profile_constraint_definition_mismatch' using errcode = '23514';
  end if;
  if exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'client_portal_property_change_requests'
      and c.conname = 'client_portal_property_change_public_reference_format'
      and not (
        pg_get_constraintdef(c.oid, true) like '%public_reference IS NULL%'
        and pg_get_constraintdef(c.oid, true) like '%^CC-PT-[0-9A-F]{24}$%'
      )
  ) then
    raise exception 'property_constraint_definition_mismatch' using errcode = '23514';
  end if;

  select count(*) into v_index_count
  from pg_class idx
  join pg_index i on i.indexrelid = idx.oid
  join pg_namespace n on n.oid = idx.relnamespace
  where n.nspname = 'public'
    and idx.relname in (
      'client_portal_profile_change_v2_idempotency_uidx',
      'client_portal_property_change_v2_idempotency_uidx',
      'client_portal_profile_change_v2_public_reference_uidx',
      'client_portal_property_change_v2_public_reference_uidx'
    );
  if v_index_count <> 4 then
    raise exception 'index_contract_mismatch' using errcode = '23514';
  end if;

  if exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'client_portal_profile_change_v2_idempotency_uidx'
      and (
        not i.indisunique
        or pg_get_indexdef(idx.oid) not like '%(requested_by, idempotency_key)%'
        or coalesce(pg_get_expr(i.indpred, i.indrelid), '') not like '%idempotency_key IS NOT NULL%'
      )
  ) then
    raise exception 'profile_idempotency_index_definition_mismatch' using errcode = '23514';
  end if;
  if exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'client_portal_property_change_v2_idempotency_uidx'
      and (
        not i.indisunique
        or pg_get_indexdef(idx.oid) not like '%(requested_by, idempotency_key)%'
        or coalesce(pg_get_expr(i.indpred, i.indrelid), '') not like '%idempotency_key IS NOT NULL%'
      )
  ) then
    raise exception 'property_idempotency_index_definition_mismatch' using errcode = '23514';
  end if;
  if exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'client_portal_profile_change_v2_public_reference_uidx'
      and (
        not i.indisunique
        or pg_get_indexdef(idx.oid) not like '%(public_reference)%'
        or coalesce(pg_get_expr(i.indpred, i.indrelid), '') not like '%public_reference IS NOT NULL%'
      )
  ) then
    raise exception 'profile_reference_index_definition_mismatch' using errcode = '23514';
  end if;
  if exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_namespace n on n.oid = idx.relnamespace
    where n.nspname = 'public'
      and idx.relname = 'client_portal_property_change_v2_public_reference_uidx'
      and (
        not i.indisunique
        or pg_get_indexdef(idx.oid) not like '%(public_reference)%'
        or coalesce(pg_get_expr(i.indpred, i.indrelid), '') not like '%public_reference IS NOT NULL%'
      )
  ) then
    raise exception 'property_reference_index_definition_mismatch' using errcode = '23514';
  end if;

  select count(*) into v_helper_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'portal_private'
    and (
      (p.proname = 'normalize_profile_change_v2' and pg_get_function_identity_arguments(p.oid) = 'p_changes jsonb')
      or (p.proname = 'normalize_property_change_v2' and pg_get_function_identity_arguments(p.oid) = 'p_changes jsonb')
      or (p.proname = 'reviewed_change_receipt_v2' and pg_get_function_identity_arguments(p.oid) = 'p_reference text, p_status text, p_requested_at timestamp with time zone, p_changes jsonb, p_request_type text')
    )
    and pg_get_userbyid(p.proowner) = 'postgres'
    and p.prosecdef
    and p.proconfig = array['search_path=pg_catalog'];
  if v_helper_count <> 3 then
    raise exception 'helper_contract_mismatch' using errcode = '23514';
  end if;

  select count(*) into v_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      (p.proname = 'portal_submit_profile_change_request_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_proposed_changes jsonb, p_idempotency_key uuid')
      or (p.proname = 'portal_submit_property_change_request_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_property_id text, p_proposed_changes jsonb, p_idempotency_key uuid')
      or (p.proname = 'portal_list_own_profile_change_requests_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_limit integer')
      or (p.proname = 'portal_list_own_property_change_requests_v2' and pg_get_function_identity_arguments(p.oid) = 'p_client_id text, p_property_id text, p_limit integer')
    )
    and pg_get_userbyid(p.proowner) = 'postgres'
    and p.prosecdef
    and p.proconfig = array['search_path=pg_catalog'];
  if v_rpc_count <> 4 then
    raise exception 'rpc_contract_mismatch' using errcode = '23514';
  end if;

  if not has_function_privilege('authenticated', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.portal_list_own_profile_change_requests_v2(text,integer)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.portal_list_own_property_change_requests_v2(text,text,integer)', 'EXECUTE')
  then
    raise exception 'authenticated_execute_grant_missing' using errcode = '42501';
  end if;

  if has_function_privilege('anon', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)', 'EXECUTE')
  then
    raise exception 'unexpected_public_execute_grant' using errcode = '42501';
  end if;

  if has_function_privilege('authenticated', 'portal_private.normalize_profile_change_v2(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'portal_private.normalize_property_change_v2(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'portal_private.reviewed_change_receipt_v2(text,text,timestamp with time zone,jsonb,text)', 'EXECUTE')
    or has_function_privilege('public', 'portal_private.normalize_profile_change_v2(jsonb)', 'EXECUTE')
  then
    raise exception 'private_helper_execute_grant_leak' using errcode = '42501';
  end if;

  if (
    select count(*)
    from (
      select rel.relname
      from pg_class rel
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname in ('client_portal_profile_change_requests', 'client_portal_property_change_requests')
        and rel.relrowsecurity
    ) as r
  ) <> 2 then
    raise exception 'expected_rls_not_enabled' using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('clients', 'properties')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'customer_tables_write_policy_leak' using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_class rel
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname in ('clients', 'properties')
      and not rel.relrowsecurity
  ) then
    raise exception 'customer_tables_rls_disabled' using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_class rel
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname in ('clients', 'properties')
      and rel.relrowsecurity
  ) is false
  then
    raise exception 'customer_tables_rls_missing' using errcode = '42501';
  end if;

  select count(*) into v_auth_users from auth.users;
  select count(*) into v_clients from public.clients;
  select count(*) into v_properties from public.properties;
  select count(*) into v_memberships from public.client_portal_memberships;
  select count(*) into v_profile_requests from public.client_portal_profile_change_requests;
  select count(*) into v_property_requests from public.client_portal_property_change_requests;
  select count(*) into v_audit_events from public.client_portal_audit_events;
  select count(*) into v_rate_limits from public.client_portal_rate_limits;

  select coalesce(
    encode(
      sha256(convert_to(
        coalesce((select jsonb_agg(to_jsonb(r) order by r.id)::text from public.client_portal_profile_change_requests r), '[]'),
        'UTF8'
      )),
      'hex'
    ),
    ''
  ) into v_profile_hist_digest;
  select coalesce(
    encode(
      sha256(convert_to(
        coalesce((select jsonb_agg(to_jsonb(r) order by r.id)::text from public.client_portal_property_change_requests r), '[]'),
        'UTF8'
      )),
      'hex'
    ),
    ''
  ) into v_property_hist_digest;
  select coalesce(
    encode(
      sha256(convert_to(
        coalesce((select jsonb_agg(to_jsonb(r) order by r.version)::text from supabase_migrations.schema_migrations r), '[]'),
        'UTF8'
      )),
      'hex'
    ),
    ''
  ) into v_migration_hist_digest;

  if v_baseline_auth_users is not null and v_auth_users <> v_baseline_auth_users then
    raise exception 'auth_user_count_drift' using errcode = '23514';
  end if;
  if v_baseline_clients is not null and v_clients <> v_baseline_clients then
    raise exception 'client_count_drift' using errcode = '23514';
  end if;
  if v_baseline_properties is not null and v_properties <> v_baseline_properties then
    raise exception 'property_count_drift' using errcode = '23514';
  end if;
  if v_baseline_memberships is not null and v_memberships <> v_baseline_memberships then
    raise exception 'membership_count_drift' using errcode = '23514';
  end if;
  if v_baseline_profile_requests is not null and v_profile_requests <> v_baseline_profile_requests then
    raise exception 'profile_request_count_drift' using errcode = '23514';
  end if;
  if v_baseline_property_requests is not null and v_property_requests <> v_baseline_property_requests then
    raise exception 'property_request_count_drift' using errcode = '23514';
  end if;
  if v_baseline_audit_events is not null and v_audit_events <> v_baseline_audit_events then
    raise exception 'audit_event_count_drift' using errcode = '23514';
  end if;
  if v_baseline_rate_limits is not null and v_rate_limits <> v_baseline_rate_limits then
    raise exception 'rate_limit_count_drift' using errcode = '23514';
  end if;
  if v_baseline_profile_digest is not null and v_profile_hist_digest <> v_baseline_profile_digest then
    raise exception 'profile_history_digest_drift' using errcode = '23514';
  end if;
  if v_baseline_property_digest is not null and v_property_hist_digest <> v_baseline_property_digest then
    raise exception 'property_history_digest_drift' using errcode = '23514';
  end if;
  if v_baseline_migration_digest is not null and v_migration_hist_digest <> v_baseline_migration_digest then
    raise exception 'migration_history_digest_drift' using errcode = '23514';
  end if;
end;
$cp3b2a_postcheck$;

rollback;

select jsonb_build_object(
  'gate', 'CP-3B.2A REAL QA CLOSEOUT',
  'result', 'REAL_STRUCTURAL_POSTCHECK_PASS',
  'projectRef', current_setting('app.cp3b2a.project_ref', true),
  'runId', current_setting('app.cp3b2a.run_id', true),
  'counts', jsonb_build_object(
    'authUsers', (select count(*) from auth.users),
    'clients', (select count(*) from public.clients),
    'properties', (select count(*) from public.properties),
    'memberships', (select count(*) from public.client_portal_memberships),
    'profileRequests', (select count(*) from public.client_portal_profile_change_requests),
    'propertyRequests', (select count(*) from public.client_portal_property_change_requests),
    'auditEvents', (select count(*) from public.client_portal_audit_events),
    'rateLimits', (select count(*) from public.client_portal_rate_limits)
  )
)::text as cp3b2a_qa_real_postcheck;
