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
\if :{?authorized_head}
\else
\echo 'authorized_head is required'
\quit 3
\endif

begin transaction read only;

set local statement_timeout = '20s';
set local lock_timeout = '3s';
set local idle_in_transaction_session_timeout = '20s';

select set_config('app.cp3b2a.project_ref', :'project_ref', true);
select set_config('app.cp3b2a.run_id', :'run_id', true);
select set_config('app.cp3b2a.authorized_head', :'authorized_head', true);

with expected_columns(table_name, column_name) as (
  values
    ('client_portal_profile_change_requests', 'idempotency_key'),
    ('client_portal_profile_change_requests', 'public_reference'),
    ('client_portal_property_change_requests', 'idempotency_key'),
    ('client_portal_property_change_requests', 'public_reference')
),
column_presence as (
  select count(*)::integer as count
  from expected_columns e
  where exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = e.table_name
      and c.column_name = e.column_name
  )
),
column_state as (
  select jsonb_agg(jsonb_build_object(
    'table', e.table_name,
    'column', e.column_name,
    'present', exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = e.table_name
        and c.column_name = e.column_name
    ),
    'nullable', (
      select c.is_nullable = 'YES'
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = e.table_name
        and c.column_name = e.column_name
    ),
    'default', (
      select c.column_default
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = e.table_name
        and c.column_name = e.column_name
    )
  ) order by e.table_name, e.column_name) as definition
  from expected_columns e
),
table_digests as (
  select jsonb_build_object(
    'profileDigest', (
      select md5(coalesce(string_agg((to_jsonb(r) - 'idempotency_key' - 'public_reference')::text, '|' order by r.id), ''))
      from public.client_portal_profile_change_requests r
    ),
    'propertyDigest', (
      select md5(coalesce(string_agg((to_jsonb(r) - 'idempotency_key' - 'public_reference')::text, '|' order by r.id), ''))
      from public.client_portal_property_change_requests r
    ),
    'newColumnsPresent', (
      (
        select count(*)
        from public.client_portal_profile_change_requests r
        where to_jsonb(r) ? 'idempotency_key'
           or to_jsonb(r) ? 'public_reference'
      ) + (
        select count(*)
        from public.client_portal_property_change_requests r
        where to_jsonb(r) ? 'idempotency_key'
           or to_jsonb(r) ? 'public_reference'
      )
    )
  ) as definition
)
select jsonb_build_object(
  'gate', 'CP-3B.2A.6R.1',
  'projectRef', :'project_ref',
  'authorizedHead', :'authorized_head',
  'database', current_database(),
  'user', current_user,
  'serverVersion', current_setting('server_version'),
  'applicationName', current_setting('application_name', true),
  'columnPresence', (select count from column_presence),
  'columnState', (select definition from column_state),
  'digests', (select definition from table_digests),
  'newColumnsPresent', (select count from column_presence)
)::text as cp3b2a_qa_precheck_v6;

rollback;
