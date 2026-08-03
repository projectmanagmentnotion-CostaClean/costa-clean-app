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

select jsonb_build_object(
  'gate', 'CP-3B.2A.6R.1E',
  'kind', 'digest',
  'projectRef', :'project_ref',
  'runId', :'run_id',
  'clientsDigest', (
    select md5(coalesce(string_agg(row_to_json(c)::text, '|' order by c.id), ''))
    from public.clients c
  ),
  'propertiesDigest', (
    select md5(coalesce(string_agg(row_to_json(p)::text, '|' order by p.id), ''))
    from public.properties p
  ),
  'migrationHistoryDigest', (
    select md5(coalesce(string_agg(m.version || ':' || coalesce(m.name, ''), '|' order by m.version), ''))
    from supabase_migrations.schema_migrations m
  )
)::text as cp3b2a_qa_digest_v6;

rollback;
