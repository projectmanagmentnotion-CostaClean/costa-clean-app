\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

\if :{?v2_run_id}
\else
\echo 'v2_run_id is required'
\quit 3
\endif

-- V3 deliberately reuses the frozen V2 prestate contract byte-for-byte. The
-- runner separately rejects collisions against the real V3 run id before any
-- effect; this V2-shaped marker exists only to evaluate the frozen contract.
\set run_id :v2_run_id
\ir cp3b2a_qa_precheck_v2.sql
