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
  'gate', 'CP-3B.2A.6R.1',
  'kind', 'fixture_setup',
  'projectRef', :'project_ref',
  'runId', :'run_id',
  'result', 'PLAN_ONLY'
)::text as cp3b2a_qa_fixture_setup_v6;

rollback;
