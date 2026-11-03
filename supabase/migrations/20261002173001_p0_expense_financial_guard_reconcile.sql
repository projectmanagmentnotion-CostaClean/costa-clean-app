begin;

-- N56 creates broad authenticated-staff INSERT/UPDATE policies. Tighten those
-- policies before removing the restrictive bridge, in the same transaction.
-- P0 can then run unchanged: its known-policy cleanup sees only its three
-- expected policies. Storage is intentionally untouched.
do $preflight$
declare
  policy_count integer;
begin
  if to_regclass('public.expenses') is null
     or to_regprocedure('public.expense_staff_access(boolean)') is null then
    raise exception 'P0/N56 reconciliation prerequisites are missing.' using errcode = '55000';
  end if;

  if not exists (select 1 from pg_class where oid = 'public.expenses'::regclass and relrowsecurity) then
    raise exception 'RLS is not enabled on public.expenses.' using errcode = '55000';
  end if;

  select count(*) into policy_count
    from pg_policies where schemaname = 'public' and tablename = 'expenses';

  if policy_count <> 5
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'P0 financial guard insert' and permissive = 'RESTRICTIVE'
         and cmd = 'INSERT' and 'authenticated' = any(roles)
     )
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'P0 financial guard update' and permissive = 'RESTRICTIVE'
         and cmd = 'UPDATE' and 'authenticated' = any(roles)
     )
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'Internal staff insert' and permissive = 'PERMISSIVE'
         and cmd = 'INSERT' and 'authenticated' = any(roles)
     )
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'Internal staff read' and permissive = 'PERMISSIVE'
         and cmd = 'SELECT' and 'authenticated' = any(roles)
     )
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'Internal staff update' and permissive = 'PERMISSIVE'
         and cmd = 'UPDATE' and 'authenticated' = any(roles)
     ) then
    raise exception 'Expense policies differ from the guarded N56/P0 prestate.' using errcode = '55000';
  end if;
end;
$preflight$;

alter policy "Internal staff insert" on public.expenses
  to authenticated with check ((select public.expense_staff_access(true)));
alter policy "Internal staff update" on public.expenses
  to authenticated
  using ((select public.expense_staff_access(true)))
  with check ((select public.expense_staff_access(true)));

drop policy "P0 financial guard insert" on public.expenses;
drop policy "P0 financial guard update" on public.expenses;

do $postcondition$
declare
  policy_count integer;
begin
  select count(*) into policy_count
    from pg_policies where schemaname = 'public' and tablename = 'expenses';

  if policy_count <> 3
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'Internal staff insert' and cmd = 'INSERT'
         and 'authenticated' = any(roles) and with_check like '%expense_staff_access%'
     )
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'Internal staff read' and cmd = 'SELECT'
         and 'authenticated' = any(roles)
     )
     or not exists (
       select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
         and policyname = 'Internal staff update' and cmd = 'UPDATE'
         and 'authenticated' = any(roles) and qual like '%expense_staff_access%'
         and with_check like '%expense_staff_access%'
     ) then
    raise exception 'Financial-only expense policy reconciliation did not hold.' using errcode = '55000';
  end if;

  if has_table_privilege('authenticated', 'public.expenses', 'DELETE')
     or has_table_privilege('authenticated', 'public.expenses', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.expenses', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.expenses', 'TRIGGER')
     or has_table_privilege('anon', 'public.expenses', 'SELECT')
     or has_table_privilege('anon', 'public.expenses', 'INSERT')
     or has_table_privilege('anon', 'public.expenses', 'UPDATE')
     or has_table_privilege('anon', 'public.expenses', 'DELETE')
     or has_table_privilege('anon', 'public.expenses', 'TRUNCATE') then
    raise exception 'Expense grants drifted from the P0 contract.' using errcode = '55000';
  end if;

  if not has_table_privilege('service_role', 'public.expenses', 'SELECT')
     or not has_table_privilege('service_role', 'public.expenses', 'INSERT')
     or not has_table_privilege('service_role', 'public.expenses', 'UPDATE')
     or not has_table_privilege('service_role', 'public.expenses', 'DELETE') then
    raise exception 'Service-role expense workflow grants were not preserved.' using errcode = '55000';
  end if;
end;
$postcondition$;

do $verify_privileged_rpc_execution$
declare
  signature text;
  target_function regprocedure;
begin
  foreach signature in array array[
    'public.debug_run_authorized_invoice_batch()',
    'public.run_authorized_invoice_batch()',
    'public.n21_assert_existing_job_quote_compatibility()',
    'public.rls_auto_enable()'
  ] loop
    target_function := to_regprocedure(signature);
    if target_function is not null and (
      has_function_privilege('anon', target_function::oid, 'EXECUTE')
      or has_function_privilege('authenticated', target_function::oid, 'EXECUTE')
      or has_function_privilege('service_role', target_function::oid, 'EXECUTE')
    ) then
      raise exception 'A privileged SECURITY DEFINER RPC remains executable by an API role.'
        using errcode = '55000';
    end if;
  end loop;
end;
$verify_privileged_rpc_execution$;

commit;
