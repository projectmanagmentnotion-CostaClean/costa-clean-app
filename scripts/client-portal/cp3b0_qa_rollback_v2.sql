\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin;

drop function if exists public.portal_resolve_self_access_context();

commit;

select jsonb_build_object(
  'result', case
    when to_regprocedure('public.portal_resolve_self_access_context()') is null
      then 'PASS'
    else 'FAIL'
  end,
  'functionAbsent',
    to_regprocedure('public.portal_resolve_self_access_context()') is null
) as cp3b0_qa_rollback_v2;
