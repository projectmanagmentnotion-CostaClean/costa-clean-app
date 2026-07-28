\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

do $reproduce_cp3b0_block$
declare
  v_definition text;
begin
  if to_regprocedure('public.portal_get_account_context(text)') is null then
    raise exception 'original_account_context_missing';
  end if;

  if to_regprocedure('public.portal_get_account_context()') is not null
    or to_regprocedure('public.portal_resolve_self_access_context()') is not null
  then
    raise exception 'self_context_unexpectedly_available';
  end if;

  select pg_get_functiondef('public.portal_get_account_context(text)'::regprocedure)
  into v_definition;

  if v_definition not like '%p_client_id text%'
    or v_definition not like '%m.status = ''active''%'
    or v_definition like '%m.status = ''suspended''%'
    or v_definition like '%m.status = ''revoked''%'
  then
    raise exception 'original_block_not_reproduced';
  end if;

  if (
    select count(*)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'portal_%access%context%'
      and p.pronargs = 0
  ) <> 0 then
    raise exception 'public_self_context_contract_already_exists';
  end if;
end;
$reproduce_cp3b0_block$;

select jsonb_build_object(
  'result', 'PASS',
  'rootCause', 'CLIENT_CONTEXT_NOT_SELF_DISCOVERABLE',
  'accountContextParameters', 1,
  'publicSelfContextFunctions', 0,
  'inactiveStatesDistinguishable', false
) as cp3b0_original_block;
