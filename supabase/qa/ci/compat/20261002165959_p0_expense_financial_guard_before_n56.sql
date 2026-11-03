begin;

-- Restrictive guards survive N56's replacement of permissive expense policies.
-- Every unmet precondition aborts this transaction rather than allowing broad writes.
do $preflight$
declare
  financial_role_contract text;
begin
  if to_regclass('public.expenses') is null
     or to_regclass('public.internal_staff_memberships') is null
     or to_regprocedure('auth.uid()') is null
     or to_regprocedure('app_private.internal_staff_role_can_write_financially(text)') is null then
    raise exception 'P0/N56 financial guard prerequisites are missing.' using errcode = '55000';
  end if;

  if not exists (select 1 from pg_class where oid = 'public.expenses'::regclass and relrowsecurity) then
    raise exception 'RLS must already be enabled on public.expenses.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.internal_staff_memberships'::regclass
       and attname = 'user_id' and atttypid = 'uuid'::regtype
       and attnum > 0 and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
     where attrelid = 'public.internal_staff_memberships'::regclass
       and attname = 'role' and atttypid = 'text'::regtype
       and attnum > 0 and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
     where attrelid = 'public.internal_staff_memberships'::regclass
       and attname = 'status' and attnum > 0 and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
     where attrelid = 'public.internal_staff_memberships'::regclass
       and attname = 'revoked_at' and attnum > 0 and not attisdropped
  ) then
    raise exception 'Membership schema differs from the certified P0 contract.' using errcode = '55000';
  end if;

  if to_regrole('anon') is null or to_regrole('authenticated') is null
     or to_regrole('service_role') is null or to_regrole('postgres') is null then
    raise exception 'Expected Supabase roles are missing.' using errcode = '55000';
  end if;

  select prosrc into financial_role_contract
    from pg_proc
   where oid = to_regprocedure('app_private.internal_staff_role_can_write_financially(text)');
  if financial_role_contract is null
     or regexp_replace(lower(financial_role_contract), '\s+', '', 'g')
     <> $expected$selectcoalesce(p_role=any(array['owner','admin','finance']::text[]),false)$expected$ then
    raise exception 'Financial role predicate differs from the certified owner/admin/finance contract.'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
      and policyname in ('P0 financial guard insert', 'P0 financial guard update')
  ) then
    raise exception 'P0 financial guard policy name collision.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
      and cmd in ('INSERT', 'ALL') and permissive = 'PERMISSIVE'
      and 'authenticated' = any(roles)
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses'
      and cmd in ('UPDATE', 'ALL') and permissive = 'PERMISSIVE'
      and 'authenticated' = any(roles)
  ) then
    raise exception 'Authenticated expense write policies are absent.' using errcode = '55000';
  end if;
end;
$preflight$;

-- Same authorization contract as the certified P0 migration: uid is taken
-- from the Auth context; active membership and financial role are checked by
-- the trusted function owner; the API caller sees only a boolean.
create or replace function public.expense_staff_access(p_financial_write boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    return false;
  end if;
  if p_financial_write is null then
    return false;
  end if;

  select membership.role into v_role
    from public.internal_staff_memberships as membership
   where membership.user_id = v_user_id
     and membership.status = 'active'
     and membership.revoked_at is null;

  if v_role is null then return false; end if;
  if not p_financial_write then return true; end if;
  return app_private.internal_staff_role_can_write_financially(v_role);
end;
$function$;

alter function public.expense_staff_access(boolean) owner to postgres;
revoke all on function public.expense_staff_access(boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.expense_staff_access(boolean) to authenticated;

-- Close the known privileged SECURITY DEFINER entry points before N56 too.
do $revoke_privileged_rpc_execution$
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
    if target_function is not null then
      execute format(
        'revoke all on function %s from public, anon, authenticated, service_role',
        target_function
      );
    end if;
  end loop;
end;
$revoke_privileged_rpc_execution$;

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

-- Keep the authenticated read/create/update contract, deny destructive browser
-- privileges and anonymous access, and explicitly preserve the trusted server.
revoke all on table public.expenses from public, anon;
revoke delete, truncate, references, trigger on table public.expenses from authenticated;
grant select, insert, update, delete on table public.expenses to service_role;

create policy "P0 financial guard insert" on public.expenses
  as restrictive for insert to authenticated
  with check ((select public.expense_staff_access(true)));
create policy "P0 financial guard update" on public.expenses
  as restrictive for update to authenticated
  using ((select public.expense_staff_access(true)))
  with check ((select public.expense_staff_access(true)));

do $postcondition$
begin
  if not has_table_privilege('authenticated', 'public.expenses', 'SELECT')
     or not has_table_privilege('authenticated', 'public.expenses', 'INSERT')
     or not has_table_privilege('authenticated', 'public.expenses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.expenses', 'DELETE')
     or has_table_privilege('authenticated', 'public.expenses', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.expenses', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.expenses', 'TRIGGER') then
    raise exception 'Authenticated expense grants do not match the P0 contract.' using errcode = '55000';
  end if;

  if has_table_privilege('anon', 'public.expenses', 'SELECT')
     or has_table_privilege('anon', 'public.expenses', 'INSERT')
     or has_table_privilege('anon', 'public.expenses', 'UPDATE')
     or has_table_privilege('anon', 'public.expenses', 'DELETE')
     or has_table_privilege('anon', 'public.expenses', 'TRUNCATE')
     or has_table_privilege('anon', 'public.expenses', 'REFERENCES')
     or has_table_privilege('anon', 'public.expenses', 'TRIGGER') then
    raise exception 'Anonymous effective expense privileges remain.' using errcode = '55000';
  end if;

  if not has_table_privilege('service_role', 'public.expenses', 'SELECT')
     or not has_table_privilege('service_role', 'public.expenses', 'INSERT')
     or not has_table_privilege('service_role', 'public.expenses', 'UPDATE')
     or not has_table_privilege('service_role', 'public.expenses', 'DELETE') then
    raise exception 'Service-role expense workflow grants were not preserved.' using errcode = '55000';
  end if;
end;
$postcondition$;

commit;
