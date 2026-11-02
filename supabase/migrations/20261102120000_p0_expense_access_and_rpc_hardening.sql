begin;

-- These SECURITY DEFINER helpers are maintenance/trigger internals. Trigger
-- execution does not require API roles to have direct EXECUTE privileges.
-- Some are only present after the V3 migration set, so this remains replayable
-- from main while hardening each function present in the target schema.
do $revoke_public_rpc_execution$
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
      -- N56 intentionally revokes direct execution from service_role too.
      -- Trigger/event-trigger execution is managed by PostgreSQL and does not
      -- require callers to have direct EXECUTE on these internal functions.
    end if;
  end loop;
end;
$revoke_public_rpc_execution$;

-- RLS policies cannot call the app_private predicates directly: authenticated
-- intentionally has neither schema/table access nor EXECUTE on those helpers.
-- This narrow boolean wrapper validates the request identity and delegates the
-- canonical financial-role decision while reading membership as its owner.
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

  select membership.role
    into v_role
    from public.internal_staff_memberships as membership
   where membership.user_id = v_user_id
     and membership.status = 'active'
     and membership.revoked_at is null;

  if v_role is null then
    return false;
  end if;

  if not p_financial_write then
    return true;
  end if;

  return app_private.internal_staff_role_can_write_financially(v_role);
end;
$function$;

alter function public.expense_staff_access(boolean) owner to postgres;
revoke all on function public.expense_staff_access(boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.expense_staff_access(boolean)
  to authenticated;

revoke all on table public.expenses from public, anon;
-- Authenticated expense users may read/create/update through the scoped RLS
-- policies, but must never delete, truncate, create foreign keys, or triggers.
revoke delete, truncate, references, trigger on table public.expenses from authenticated;
-- Keep the trusted server-side role functional after narrowing browser grants.
grant select, insert, update, delete on table public.expenses to service_role;

drop policy if exists "Allow authenticated insert expenses" on public.expenses;
drop policy if exists "Allow authenticated select expenses" on public.expenses;
drop policy if exists "Allow authenticated update expenses" on public.expenses;
drop policy if exists "Internal staff insert" on public.expenses;
drop policy if exists "Internal staff read" on public.expenses;
drop policy if exists "Internal staff update" on public.expenses;

do $expense_policy_prestate$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
  ) then
    raise exception 'Unexpected public.expenses policy remains after known-policy cleanup.'
      using errcode = '55000';
  end if;
end;
$expense_policy_prestate$;

create policy "Internal staff read" on public.expenses
  for select to authenticated
  using ((select public.expense_staff_access(false)));

create policy "Internal staff insert" on public.expenses
  for insert to authenticated
  with check ((select public.expense_staff_access(true)));

create policy "Internal staff update" on public.expenses
  for update to authenticated
  using ((select public.expense_staff_access(true)))
  with check ((select public.expense_staff_access(true)));

commit;
