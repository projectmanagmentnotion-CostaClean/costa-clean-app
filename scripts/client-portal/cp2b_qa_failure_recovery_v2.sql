\set ON_ERROR_STOP on

\if :{?project_ref}
\else
  \echo 'project_ref is required'
  \quit 3
\endif

select (
  :'project_ref' = 'kpvvydthlxupjjqqdpxy'
  and :'project_ref' <> 'wfxnwfcdjainpojhbdri'
) as recovery_target_valid
\gset

\if :recovery_target_valid
\else
  \echo 'recovery target rejected'
  \quit 4
\endif

-- Disable only the portal-specific public RPC surface before any cleanup work.
-- Existing operational and financial RPCs are deliberately outside this prefix.
do $disable_portal$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'portal\_%' escape '\'
  loop
    execute format(
      'revoke execute on function %s from authenticated',
      v_function.signature
    );
  end loop;
end;
$disable_portal$;

\ir cp2b_qa_cleanup_v2.sql

set app.cp2a.allow_legacy_restore = 'true';
\ir cp2a_rollback.sql
