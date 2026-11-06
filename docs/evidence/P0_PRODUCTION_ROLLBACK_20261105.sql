-- EMERGENCY ROLLBACK ONLY. This deliberately restores the pre-P0 insecure
-- expense grants/policies and anonymous EXECUTE on privileged functions.
-- Never run as a routine correction. Use only after owner authorization,
-- exact target verification, and with the reviewed forward fix ready.
--
-- This is a catalog-derived compensating transaction, not a data backup or
-- proof that a provider backup is restorable. P0 has not been applied to
-- Production as of the evidence date in the accompanying package.
-- The project_ref psql variable is only a declared-target guard. The operator
-- must independently verify public ref, private session/database identity,
-- and connection target before opening this script.

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

begin;

select set_config('app.p0.rollback_project_ref', :'project_ref', true);

do $rollback_preflight$
declare
  policy_count integer;
  signature text;
  target_function regprocedure;
  helper_is_definer boolean;
  helper_owner text;
  helper_settings text[];
begin
  if current_setting('app.p0.rollback_project_ref') <> 'wfxnwfcdjainpojhbdri' then
    raise exception 'p0_rollback_wrong_project_ref' using errcode = '42501';
  end if;

  if to_regclass('public.expenses') is null
     or not exists (select 1 from pg_class where oid = 'public.expenses'::regclass and relrowsecurity) then
    raise exception 'p0_rollback_expenses_prestate_missing' using errcode = '55000';
  end if;

  select count(*) into policy_count
    from pg_policies where schemaname = 'public' and tablename = 'expenses';
  if policy_count <> 3
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
       and policyname = 'Internal staff read' and cmd = 'SELECT' and 'authenticated' = any(roles)
       and coalesce(qual, '') like '%expense_staff_access%')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
       and policyname = 'Internal staff insert' and cmd = 'INSERT' and 'authenticated' = any(roles)
       and coalesce(with_check, '') like '%expense_staff_access%')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
       and policyname = 'Internal staff update' and cmd = 'UPDATE' and 'authenticated' = any(roles)
       and coalesce(qual, '') like '%expense_staff_access%'
       and coalesce(with_check, '') like '%expense_staff_access%') then
    raise exception 'p0_rollback_policy_prestate_mismatch' using errcode = '55000';
  end if;

  select p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig
    into helper_is_definer, helper_owner, helper_settings
    from pg_proc p where p.oid = to_regprocedure('public.expense_staff_access(boolean)');
  if not found or not helper_is_definer or helper_owner <> 'postgres'
     or not coalesce(helper_settings @> array['search_path=""']::text[], false) then
    raise exception 'p0_rollback_helper_identity_mismatch' using errcode = '55000';
  end if;

  if has_table_privilege('anon', 'public.expenses', 'SELECT')
     or has_table_privilege('anon', 'public.expenses', 'INSERT')
     or has_table_privilege('anon', 'public.expenses', 'UPDATE')
     or has_table_privilege('anon', 'public.expenses', 'DELETE')
     or has_table_privilege('anon', 'public.expenses', 'TRUNCATE')
     or has_table_privilege('anon', 'public.expenses', 'REFERENCES')
     or has_table_privilege('anon', 'public.expenses', 'TRIGGER')
     or has_table_privilege('anon', 'public.expenses', 'MAINTAIN') then
    raise exception 'p0_rollback_anon_acl_is_not_p0_poststate' using errcode = '55000';
  end if;

  if not has_table_privilege('authenticated', 'public.expenses', 'SELECT')
     or not has_table_privilege('authenticated', 'public.expenses', 'INSERT')
     or not has_table_privilege('authenticated', 'public.expenses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.expenses', 'DELETE')
     or has_table_privilege('authenticated', 'public.expenses', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.expenses', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.expenses', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.expenses', 'MAINTAIN') then
    raise exception 'p0_rollback_authenticated_acl_is_not_p0_poststate' using errcode = '55000';
  end if;

  if not has_table_privilege('service_role', 'public.expenses', 'SELECT')
     or not has_table_privilege('service_role', 'public.expenses', 'INSERT')
     or not has_table_privilege('service_role', 'public.expenses', 'UPDATE')
     or not has_table_privilege('service_role', 'public.expenses', 'DELETE')
     or not has_table_privilege('service_role', 'public.expenses', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.expenses', 'REFERENCES')
     or not has_table_privilege('service_role', 'public.expenses', 'TRIGGER')
     or not has_table_privilege('service_role', 'public.expenses', 'MAINTAIN') then
    raise exception 'p0_rollback_service_role_acl_is_not_p0_poststate' using errcode = '55000';
  end if;

  foreach signature in array array[
    'public.debug_run_authorized_invoice_batch()',
    'public.run_authorized_invoice_batch()',
    'public.n21_assert_existing_job_quote_compatibility()',
    'public.rls_auto_enable()'
  ] loop
    target_function := to_regprocedure(signature);
    if target_function is null
       or has_function_privilege('public', target_function, 'EXECUTE')
       or has_function_privilege('anon', target_function, 'EXECUTE')
       or has_function_privilege('authenticated', target_function, 'EXECUTE')
       or has_function_privilege('service_role', target_function, 'EXECUTE') then
      raise exception 'p0_rollback_rpc_prestate_mismatch:%', signature using errcode = '55000';
    end if;
  end loop;
end;
$rollback_preflight$;

drop policy "Internal staff read" on public.expenses;
drop policy "Internal staff insert" on public.expenses;
drop policy "Internal staff update" on public.expenses;

create policy "Allow authenticated select expenses" on public.expenses
  for select to authenticated using (true);
create policy "Allow authenticated insert expenses" on public.expenses
  for insert to authenticated with check (true);
create policy "Allow authenticated update expenses" on public.expenses
  for update to authenticated using (true) with check (true);

-- Restore the exact pre-P0 table ACL observed in the Production catalog.
-- PUBLIC had no direct table grants; anon lacked SELECT; authenticated and
-- service_role had all eight PostgreSQL 17 table privileges. P0 did not alter
-- service_role's ACL, so this rollback leaves it untouched.
grant insert, update, delete, truncate, references, trigger, maintain
  on table public.expenses to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain
  on table public.expenses to authenticated;

-- Restore the direct function ACLs observed in pg_proc.proacl.
grant execute on function public.debug_run_authorized_invoice_batch()
  to public, anon, authenticated, service_role;
grant execute on function public.rls_auto_enable()
  to public, anon, authenticated, service_role;
grant execute on function public.run_authorized_invoice_batch()
  to anon, authenticated, service_role;
grant execute on function public.n21_assert_existing_job_quote_compatibility()
  to anon, authenticated, service_role;

drop function public.expense_staff_access(boolean);

do $rollback_postcheck$
declare
  policy_count integer;
  signature text;
  target_function regprocedure;
begin
  select count(*) into policy_count
    from pg_policies where schemaname = 'public' and tablename = 'expenses';
  if policy_count <> 3
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
       and policyname = 'Allow authenticated select expenses' and cmd = 'SELECT' and qual = 'true')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
       and policyname = 'Allow authenticated insert expenses' and cmd = 'INSERT' and with_check = 'true')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
       and policyname = 'Allow authenticated update expenses' and cmd = 'UPDATE'
       and qual = 'true' and with_check = 'true') then
    raise exception 'p0_rollback_policy_postcheck_failed' using errcode = '55000';
  end if;

  if has_table_privilege('anon', 'public.expenses', 'SELECT')
     or not has_table_privilege('anon', 'public.expenses', 'INSERT')
     or not has_table_privilege('anon', 'public.expenses', 'UPDATE')
     or not has_table_privilege('anon', 'public.expenses', 'DELETE')
     or not has_table_privilege('anon', 'public.expenses', 'TRUNCATE')
     or not has_table_privilege('anon', 'public.expenses', 'REFERENCES')
     or not has_table_privilege('anon', 'public.expenses', 'TRIGGER')
     or not has_table_privilege('anon', 'public.expenses', 'MAINTAIN')
     or not has_table_privilege('authenticated', 'public.expenses', 'SELECT')
     or not has_table_privilege('authenticated', 'public.expenses', 'INSERT')
     or not has_table_privilege('authenticated', 'public.expenses', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.expenses', 'DELETE')
     or not has_table_privilege('authenticated', 'public.expenses', 'TRUNCATE')
     or not has_table_privilege('authenticated', 'public.expenses', 'REFERENCES')
     or not has_table_privilege('authenticated', 'public.expenses', 'TRIGGER')
     or not has_table_privilege('authenticated', 'public.expenses', 'MAINTAIN') then
    raise exception 'p0_rollback_table_acl_postcheck_failed' using errcode = '55000';
  end if;

  if has_table_privilege('public', 'public.expenses', 'SELECT')
     or has_table_privilege('public', 'public.expenses', 'INSERT')
     or has_table_privilege('public', 'public.expenses', 'UPDATE')
     or has_table_privilege('public', 'public.expenses', 'DELETE')
     or has_table_privilege('public', 'public.expenses', 'TRUNCATE')
     or has_table_privilege('public', 'public.expenses', 'REFERENCES')
     or has_table_privilege('public', 'public.expenses', 'TRIGGER')
     or has_table_privilege('public', 'public.expenses', 'MAINTAIN') then
    raise exception 'p0_rollback_public_table_acl_drift' using errcode = '55000';
  end if;

  if not has_table_privilege('service_role', 'public.expenses', 'SELECT')
     or not has_table_privilege('service_role', 'public.expenses', 'INSERT')
     or not has_table_privilege('service_role', 'public.expenses', 'UPDATE')
     or not has_table_privilege('service_role', 'public.expenses', 'DELETE')
     or not has_table_privilege('service_role', 'public.expenses', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.expenses', 'REFERENCES')
     or not has_table_privilege('service_role', 'public.expenses', 'TRIGGER')
     or not has_table_privilege('service_role', 'public.expenses', 'MAINTAIN') then
    raise exception 'p0_rollback_service_role_acl_postcheck_failed' using errcode = '55000';
  end if;

  if to_regprocedure('public.expense_staff_access(boolean)') is not null then
    raise exception 'p0_rollback_helper_remains' using errcode = '55000';
  end if;

  foreach signature in array array[
    'public.debug_run_authorized_invoice_batch()',
    'public.rls_auto_enable()'
  ] loop
    target_function := to_regprocedure(signature);
    if target_function is null
       or not has_function_privilege('public', target_function, 'EXECUTE')
       or not has_function_privilege('anon', target_function, 'EXECUTE')
       or not has_function_privilege('authenticated', target_function, 'EXECUTE')
       or not has_function_privilege('service_role', target_function, 'EXECUTE') then
      raise exception 'p0_rollback_function_acl_postcheck_failed:%', signature using errcode = '55000';
    end if;
  end loop;

  foreach signature in array array[
    'public.run_authorized_invoice_batch()',
    'public.n21_assert_existing_job_quote_compatibility()'
  ] loop
    target_function := to_regprocedure(signature);
    if target_function is null
       or has_function_privilege('public', target_function, 'EXECUTE')
       or not has_function_privilege('anon', target_function, 'EXECUTE')
       or not has_function_privilege('authenticated', target_function, 'EXECUTE')
       or not has_function_privilege('service_role', target_function, 'EXECUTE') then
      raise exception 'p0_rollback_function_acl_postcheck_failed:%', signature using errcode = '55000';
    end if;
  end loop;
end;
$rollback_postcheck$;

-- No COMMIT occurs until every precondition and postcondition above succeeds.
commit;
