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

set local statement_timeout = '20s';
set local lock_timeout = '3s';
set local idle_in_transaction_session_timeout = '20s';

select set_config('app.cp3b2a.project_ref', :'project_ref', true);
select set_config('app.cp3b2a.run_id', :'run_id', true);

with requested_tables(table_name) as (
  values
    ('client_portal_profile_change_requests'),
    ('client_portal_property_change_requests')
),
column_presence as (
  select count(*)::integer as count
  from requested_tables t
  join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = t.table_name
   and c.column_name in ('idempotency_key', 'public_reference')
),
column_null_guard as (
  select not exists (
    select 1
    from public.client_portal_profile_change_requests r
    where to_jsonb(r) ? 'idempotency_key'
       or to_jsonb(r) ? 'public_reference'
  ) and not exists (
    select 1
    from public.client_portal_property_change_requests r
    where to_jsonb(r) ? 'idempotency_key'
       or to_jsonb(r) ? 'public_reference'
  ) as ok
),
table_counts as (
  select jsonb_build_object(
    'profileRows', (select count(*) from public.client_portal_profile_change_requests),
    'propertyRows', (select count(*) from public.client_portal_property_change_requests),
    'authUsers', (select count(*) from auth.users),
    'clients', (select count(*) from public.clients),
    'properties', (select count(*) from public.properties),
    'migrationHistory', (select count(*) from supabase_migrations.schema_migrations)
  ) as definition
)
select jsonb_build_object(
  'gate', 'CP-3B.2A.6R.1',
  'kind', 'postcheck',
  'projectRef', :'project_ref',
  'runId', :'run_id',
  'columnPresence', (select count from column_presence),
  'newColumnsNullForHistoricalRows', (select ok from column_null_guard),
  'counts', (select definition from table_counts),
  'contractAbsent', (
    to_regprocedure('public.portal_submit_profile_change_request_v2(text,jsonb,uuid)') is null
    and to_regprocedure('public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)') is null
    and to_regprocedure('public.portal_list_own_profile_change_requests_v2(text,integer)') is null
    and to_regprocedure('public.portal_list_own_property_change_requests_v2(text,text,integer)') is null
  )
)::text as cp3b2a_qa_postcheck_v6;

rollback;
