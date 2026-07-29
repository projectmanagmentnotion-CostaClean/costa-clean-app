\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

-- The DDL recovery contract is unchanged because the migration is unchanged.
-- V3 adds exact pre/post recovery validation in the runner.
\ir cp3b2a_qa_rollback_v2.sql

select 'CP3B2A_V3_JSON:' || jsonb_build_object(
  'version', 3,
  'kind', 'rollback',
  'result', 'PASS'
)::text;
