\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin transaction read only;

with expected_functions(
  schema_name, function_name, arguments, volatility, authenticated_execute,
  comment_required
) as (
  values
    ('public', 'portal_submit_profile_change_request_v2', 'text, jsonb, uuid', 'v', true, true),
    ('public', 'portal_submit_property_change_request_v2', 'text, text, jsonb, uuid', 'v', true, true),
    ('public', 'portal_list_own_profile_change_requests_v2', 'text, integer', 's', true, true),
    ('public', 'portal_list_own_property_change_requests_v2', 'text, text, integer', 's', true, true),
    ('portal_private', 'normalize_profile_change_v2', 'jsonb', 'i', false, false),
    ('portal_private', 'normalize_property_change_v2', 'jsonb', 'i', false, false),
    ('portal_private', 'reviewed_change_receipt_v2', 'text, text, timestamp with time zone, jsonb, text', 's', false, false)
),
function_contract as (
  select
    e.schema_name, e.function_name,
    count(p.oid)::integer as signature_count,
    bool_and(pg_get_function_result(p.oid) = 'jsonb') as return_type,
    bool_and(p.provolatile = e.volatility) as volatility,
    bool_and(p.prosecdef) as security_definer,
    bool_and(r.rolname = 'postgres') as owner,
    bool_and(coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog'])
      as fixed_search_path,
    bool_and(not has_function_privilege('public', p.oid, 'EXECUTE')) as public_execute_denied,
    bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE')) as anon_execute_denied,
    bool_and(
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      = e.authenticated_execute
    ) as authenticated_execute,
    bool_and(not has_function_privilege('service_role', p.oid, 'EXECUTE'))
      as service_role_execute_denied,
    bool_and(not e.comment_required or obj_description(p.oid, 'pg_proc') is not null)
      as comment_present
  from expected_functions e
  left join pg_namespace n on n.nspname = e.schema_name
  left join pg_proc p
    on p.pronamespace = n.oid
    and p.proname = e.function_name
    and oidvectortypes(p.proargtypes) = e.arguments
  left join pg_roles r on r.oid = p.proowner
  group by e.schema_name, e.function_name
),
target_policies(table_name, policy_name) as (
  values
    ('client_portal_profile_change_requests', 'Portal reads same-client profile requests'),
    ('client_portal_property_change_requests', 'Portal reads same-client property requests')
),
target_functions(schema_name, function_name) as (
  select schema_name, function_name from expected_functions
)
select jsonb_build_object(
  'functionCount', (select count(*)::integer from function_contract where signature_count = 1),
  'functionContractPass', coalesce((
    select bool_and(
      signature_count = 1 and return_type and volatility and security_definer
      and owner and fixed_search_path and public_execute_denied
      and anon_execute_denied and authenticated_execute
      and service_role_execute_denied and comment_present
    ) from function_contract
  ), false),
  'columnCount', (
    select count(*)::integer from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      )
      and column_name in ('idempotency_key', 'public_reference')
      and is_nullable = 'YES' and column_default is null
  ),
  'constraintCount', (
    select count(*)::integer from pg_constraint
    where conname in (
      'client_portal_profile_change_public_reference_format',
      'client_portal_property_change_public_reference_format'
    ) and contype = 'c' and convalidated
  ),
  'constraintDefinitionPass', (
    select count(*) = 2 from pg_constraint
    where
      (conname = 'client_portal_profile_change_public_reference_format'
       and pg_get_constraintdef(oid) like '%^CC-PR-[0-9A-F]{24}$%')
      or
      (conname = 'client_portal_property_change_public_reference_format'
       and pg_get_constraintdef(oid) like '%^CC-PT-[0-9A-F]{24}$%')
  ),
  'indexCount', (
    select count(*)::integer from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'client_portal_profile_change_v2_idempotency_uidx',
        'client_portal_property_change_v2_idempotency_uidx',
        'client_portal_profile_change_v2_public_reference_uidx',
        'client_portal_property_change_v2_public_reference_uidx'
      )
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '% WHERE %IS NOT NULL%'
  ),
  'broadCustomerPolicyCount', (
    select count(*)::integer from pg_policies p
    join target_policies t
      on t.table_name = p.tablename and t.policy_name = p.policyname
    where p.schemaname = 'public'
  ),
  'internalStaffPolicyCount', (
    select count(*)::integer from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'client_portal_profile_change_requests'
         and policyname = 'Internal staff manage profile requests')
        or
        (tablename = 'client_portal_property_change_requests'
         and policyname = 'Internal staff manage property requests')
      )
  ),
  'legacyServiceGrantCount', (
    select
      has_function_privilege(
        'service_role',
        'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
        'EXECUTE'
      )::integer
      + has_function_privilege(
        'service_role',
        'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
        'EXECUTE'
      )::integer
  ),
  'profileRows', (select count(*)::integer from public.client_portal_profile_change_requests),
  'propertyRows', (select count(*)::integer from public.client_portal_property_change_requests),
  'profileDigest', (
    select md5(coalesce(string_agg(
      (to_jsonb(r) - 'idempotency_key' - 'public_reference')::text,
      '|' order by r.id
    ), '')) from public.client_portal_profile_change_requests r
  ),
  'propertyDigest', (
    select md5(coalesce(string_agg(
      (to_jsonb(r) - 'idempotency_key' - 'public_reference')::text,
      '|' order by r.id
    ), '')) from public.client_portal_property_change_requests r
  ),
  'newColumnsNullForHistoricalRows', (
    select
      not exists (
        select 1 from public.client_portal_profile_change_requests
        where idempotency_key is not null or public_reference is not null
      )
      and not exists (
        select 1 from public.client_portal_property_change_requests
        where idempotency_key is not null or public_reference is not null
      )
  ),
  'canonicalDigest', (
    select md5(string_agg(x.digest, '|' order by x.name))
    from (
      values
        ('clients', (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.clients t)),
        ('properties', (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.properties t)),
        ('jobs', (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.jobs t)),
        ('invoices', (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.invoices t)),
        ('quotes', (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.quotes t)),
        ('payments', (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.payments t))
    ) as x(name, digest)
  ),
  'financialSequenceDigest', (
    select md5(coalesce(string_agg(
      sequencename || ':' || last_value::text,
      '|' order by sequencename
    ), '')) from pg_sequences
    where schemaname = 'public'
      and sequencename ~ '(invoice|quote|payment|closing)'
  ),
  'authUserCount', (select count(*)::integer from auth.users),
  'authDigest', (
    select md5(coalesce(string_agg(
      id::text || ':' || coalesce(email, '') || ':'
        || coalesce(email_confirmed_at::text, ''),
      '|' order by id
    ), '')) from auth.users
  ),
  'tableGrantDigest', (
    select md5(coalesce(string_agg(
      c.oid::regclass::text || ':' || coalesce(c.relacl::text, ''),
      '|' order by c.oid::regclass::text
    ), ''))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
      and c.relkind in ('r', 'p', 'v', 'm')
  ),
  'unaffectedPolicyDigest', (
    select md5(coalesce(string_agg(
      p.schemaname || '.' || p.tablename || ':' || p.policyname || ':'
        || p.permissive || ':' || p.roles::text || ':' || p.cmd || ':'
        || coalesce(p.qual, '') || ':' || coalesce(p.with_check, ''),
      '|' order by p.schemaname, p.tablename, p.policyname
    ), ''))
    from pg_policies p
    where p.schemaname in ('public', 'storage')
      and not exists (
        select 1 from target_policies t
        where t.table_name = p.tablename and t.policy_name = p.policyname
      )
  ),
  'unaffectedFunctionDigest', (
    select md5(coalesce(string_agg(
      n.nspname || '.' || p.oid::regprocedure::text || ':'
        || pg_get_functiondef(p.oid) || ':' || coalesce(p.proacl::text, ''),
      '|' order by n.nspname, p.oid::regprocedure::text
    ), ''))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'portal_private')
      and p.proname like 'portal_%'
      and not exists (
        select 1 from target_functions t
        where t.schema_name = n.nspname and t.function_name = p.proname
      )
      and p.proname not in (
        'portal_submit_profile_change_trusted',
        'portal_submit_property_change_trusted'
      )
  ),
  'migrationHistoryCount', (
    select count(*)::integer from supabase_migrations.schema_migrations
  ),
  'migrationHistoryDigest', (
    select md5(coalesce(string_agg(
      version || ':' || coalesce(name, ''),
      '|' order by version
    ), '')) from supabase_migrations.schema_migrations
  )
) as cp3b2a_qa_postcheck_v2;

rollback;
