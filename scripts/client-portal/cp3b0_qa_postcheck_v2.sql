\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin transaction read only;

select jsonb_build_object(
  'signatureCount', (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'portal_resolve_self_access_context'
  ),
  'parameterCount', p.pronargs,
  'returnType', pg_get_function_result(p.oid),
  'stable', p.provolatile = 's',
  'securityDefiner', p.prosecdef,
  'owner', r.rolname,
  'fixedSearchPath',
    coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog'],
  'publicExecute', has_function_privilege('public', p.oid, 'EXECUTE'),
  'anonExecute', has_function_privilege('anon', p.oid, 'EXECUTE'),
  'authenticatedExecute',
    has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'serviceRoleExecute',
    has_function_privilege('service_role', p.oid, 'EXECUTE'),
  'commentPresent', obj_description(p.oid, 'pg_proc') is not null,
  'portalRowCount', (
    select
      (select count(*) from public.internal_staff_memberships)
      + (select count(*) from public.client_portal_invitations)
      + (select count(*) from public.client_portal_memberships)
      + (select count(*) from public.client_portal_applications)
      + (select count(*) from public.client_portal_profile_change_requests)
      + (select count(*) from public.client_portal_property_change_requests)
      + (select count(*) from public.client_service_requests)
      + (select count(*) from public.client_portal_audit_events)
      + (select count(*) from public.client_portal_rate_limits)
      + (select count(*) from public.invoice_document_records)
      + (select count(*) from public.client_portal_legal_acceptances)
  ),
  'tableGrantDigest', (
    select md5(coalesce(string_agg(
      c.oid::regclass::text || ':' || coalesce(c.relacl::text, ''),
      '|' order by c.oid::regclass::text
    ), ''))
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
      and c.relkind in ('r', 'p', 'v', 'm')
  ),
  'policyDigest', (
    select md5(coalesce(string_agg(
      schemaname || '.' || tablename || ':' || policyname || ':'
        || permissive || ':' || roles::text || ':' || cmd || ':'
        || coalesce(qual, '') || ':' || coalesce(with_check, ''),
      '|' order by schemaname, tablename, policyname
    ), ''))
    from pg_policies
    where schemaname in ('public', 'storage')
  ),
  'otherPortalFunctionCount', (
    select count(*)::integer
    from pg_proc px
    join pg_namespace nx on nx.oid = px.pronamespace
    where nx.nspname in ('public', 'portal_private')
      and px.proname like 'portal_%'
      and px.proname <> 'portal_resolve_self_access_context'
  ),
  'otherPortalFunctionDigest', (
    select md5(coalesce(string_agg(
      nx.nspname || '.' || px.oid::regprocedure::text || ':'
        || pg_get_functiondef(px.oid),
      '|' order by nx.nspname, px.oid::regprocedure::text
    ), ''))
    from pg_proc px
    join pg_namespace nx on nx.oid = px.pronamespace
    where nx.nspname in ('public', 'portal_private')
      and px.proname like 'portal_%'
      and px.proname <> 'portal_resolve_self_access_context'
  ),
  'migrationHistoryCount', (
    select count(*)::integer
    from supabase_migrations.schema_migrations
  ),
  'migrationHistoryDigest', (
    select md5(coalesce(string_agg(
      version || ':' || coalesce(name, ''),
      '|' order by version
    ), ''))
    from supabase_migrations.schema_migrations
  )
) as cp3b0_qa_postcheck_v2
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname = 'portal_resolve_self_access_context'
  and p.pronargs = 0;

rollback;
