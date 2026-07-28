\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

\if :{?project_ref}
\else
\echo 'project_ref is required'
\quit 3
\endif

\if :{?run_id}
\else
\echo 'run_id is required'
\quit 3
\endif

begin transaction read only;

select set_config('app.cp3b0.project_ref', :'project_ref', true);
select set_config('app.cp3b0.run_id', :'run_id', true);

do $target_guard$
begin
  if current_setting('app.cp3b0.project_ref') <> 'kpvvydthlxupjjqqdpxy'
    or current_setting('app.cp3b0.project_ref') = 'wfxnwfcdjainpojhbdri'
  then
    raise exception 'qa_target_rejected' using errcode = '42501';
  end if;
  if current_setting('app.cp3b0.run_id') !~ '^CP3B0-V2-[A-Z0-9]{12}$' then
    raise exception 'synthetic_run_id_rejected' using errcode = '22023';
  end if;
end;
$target_guard$;

select jsonb_build_object(
  'liveRead', 1,
  'cp2bPrerequisite',
    to_regprocedure('public.portal_get_account_context(text)') is not null,
  'selfContextCount', (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'portal_resolve_self_access_context'
  ),
  'portalTables', (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname = any (array[
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
      ])
  ),
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
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'portal_private')
      and p.proname like 'portal_%'
      and p.proname <> 'portal_resolve_self_access_context'
  ),
  'otherPortalFunctionDigest', (
    select md5(coalesce(string_agg(
      n.nspname || '.' || p.oid::regprocedure::text || ':'
        || pg_get_functiondef(p.oid),
      '|' order by n.nspname, p.oid::regprocedure::text
    ), ''))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'portal_private')
      and p.proname like 'portal_%'
      and p.proname <> 'portal_resolve_self_access_context'
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
  ),
  'syntheticCollisions', (
    select
      (select count(*) from auth.users
       where email like lower(current_setting('app.cp3b0.run_id'))
         || '-%@example.invalid')
      + (select count(*) from public.clients
         where id like current_setting('app.cp3b0.run_id') || '-%')
      + (select count(*) from public.client_portal_memberships m
         join auth.users u on u.id = m.user_id
         where u.email like lower(current_setting('app.cp3b0.run_id'))
           || '-%@example.invalid')
      + (select count(*) from public.client_portal_applications a
         join auth.users u on u.id = a.user_id
         where u.email like lower(current_setting('app.cp3b0.run_id'))
           || '-%@example.invalid')
  )
) as cp3b0_qa_precheck_v2;

rollback;
