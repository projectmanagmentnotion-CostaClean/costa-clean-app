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

select set_config('app.cp3b2a.project_ref', :'project_ref', true);
select set_config('app.cp3b2a.run_id', :'run_id', true);

do $guard$
begin
  if current_setting('app.cp3b2a.project_ref') <> 'kpvvydthlxupjjqqdpxy'
    or current_setting('app.cp3b2a.project_ref') = 'wfxnwfcdjainpojhbdri'
  then
    raise exception 'qa_target_rejected' using errcode = '42501';
  end if;
  if current_setting('app.cp3b2a.run_id') !~ '^CP3B2A-V2-[A-Z0-9]{12}$' then
    raise exception 'synthetic_run_id_rejected' using errcode = '22023';
  end if;
end;
$guard$;

with target_functions(schema_name, function_name) as (
  values
    ('public', 'portal_submit_profile_change_request_v2'),
    ('public', 'portal_submit_property_change_request_v2'),
    ('public', 'portal_list_own_profile_change_requests_v2'),
    ('public', 'portal_list_own_property_change_requests_v2'),
    ('portal_private', 'normalize_profile_change_v2'),
    ('portal_private', 'normalize_property_change_v2'),
    ('portal_private', 'reviewed_change_receipt_v2')
),
target_policies(table_name, policy_name) as (
  values
    ('client_portal_profile_change_requests', 'Portal reads same-client profile requests'),
    ('client_portal_property_change_requests', 'Portal reads same-client property requests')
)
select jsonb_build_object(
  'liveRead', 1,
  'cp2bPrerequisite',
    to_regprocedure('public.portal_get_account_context(text)') is not null,
  'cp3b0Prerequisite',
    to_regprocedure('public.portal_resolve_self_access_context()') is not null,
  'portalTables', (
    select count(*)::integer from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname = any (array[
        'internal_staff_memberships', 'client_portal_invitations',
        'client_portal_memberships', 'client_portal_applications',
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests', 'client_service_requests',
        'client_portal_audit_events', 'client_portal_rate_limits',
        'invoice_document_records', 'client_portal_legal_acceptances'
      ])
  ),
  'targetFunctionCount', (
    select count(*)::integer from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join target_functions t
      on t.schema_name = n.nspname and t.function_name = p.proname
  ),
  'targetColumnCount', (
    select count(*)::integer from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      )
      and column_name in ('idempotency_key', 'public_reference')
  ),
  'targetConstraintCount', (
    select count(*)::integer from pg_constraint
    where conname in (
      'client_portal_profile_change_public_reference_format',
      'client_portal_property_change_public_reference_format'
    )
  ),
  'targetIndexCount', (
    select count(*)::integer from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname in (
        'client_portal_profile_change_v2_idempotency_uidx',
        'client_portal_property_change_v2_idempotency_uidx',
        'client_portal_profile_change_v2_public_reference_uidx',
        'client_portal_property_change_v2_public_reference_uidx'
      )
  ),
  'broadCustomerPolicyCount', (
    select count(*)::integer from pg_policies p
    join target_policies t
      on t.table_name = p.tablename and t.policy_name = p.policyname
    where p.schemaname = 'public'
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
  'profileRows', (
    select count(*)::integer from public.client_portal_profile_change_requests
  ),
  'propertyRows', (
    select count(*)::integer from public.client_portal_property_change_requests
  ),
  'profileDigest', (
    select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_profile_change_requests r
  ),
  'propertyDigest', (
    select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
    from public.client_portal_property_change_requests r
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
    ), ''))
    from pg_sequences
    where schemaname = 'public'
      and sequencename ~ '(invoice|quote|payment|closing)'
  ),
  'authUserCount', (select count(*)::integer from auth.users),
  'authDigest', (
    select md5(coalesce(string_agg(
      id::text || ':' || coalesce(email, '') || ':'
        || coalesce(email_confirmed_at::text, ''),
      '|' order by id
    ), ''))
    from auth.users
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
  ),
  'syntheticCollisions', (
    select
      (select count(*) from auth.users
       where email like lower(current_setting('app.cp3b2a.run_id')) || '-%@example.invalid')
      + (select count(*) from public.clients
         where id like current_setting('app.cp3b2a.run_id') || '-%')
      + (select count(*) from public.properties
         where id like current_setting('app.cp3b2a.run_id') || '-%')
      + (select count(*) from public.client_portal_memberships m
         join auth.users u on u.id = m.user_id
         where u.email like lower(current_setting('app.cp3b2a.run_id')) || '-%@example.invalid')
  )
) as cp3b2a_qa_precheck_v2;

rollback;
