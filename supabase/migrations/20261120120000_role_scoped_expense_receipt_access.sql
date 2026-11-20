begin;

-- This V1 contract assumes the current single-workspace model: internal staff
-- memberships are global and expenses have no tenant/company key. If tenancy is
-- introduced, this helper and its assignment table must be scoped in the same
-- migration before the application is deployed.
do $preflight$
begin
  if to_regclass('public.expenses') is null
     or to_regclass('public.internal_staff_memberships') is null
     or to_regclass('public.expense_capture_confirmations') is null
     or to_regclass('public.expense_capture_sessions') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('auth.uid()') is null
     or to_regprocedure('storage.foldername(text)') is null
     or to_regprocedure('app_private.is_current_internal_staff_writer()') is null then
    raise exception 'Expense receipt access prerequisites are missing.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.expenses'::regclass
       and attname = 'id' and atttypid = 'uuid'::regtype
       and attnum > 0 and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
     where attrelid = 'public.expenses'::regclass
       and attname = 'receipt_file_path' and atttypid = 'text'::regtype
       and attnum > 0 and not attisdropped
  ) then
    raise exception 'Expense receipt path contract differs from the reviewed schema.' using errcode = '55000';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname not in (
         'Allow authenticated read expense receipts',
         'Allow authenticated upload expense receipts',
         'Allow authenticated update expense receipts',
         'Allow authenticated delete expense receipts',
         'Internal staff read expense receipts',
         'Internal staff upload expense receipts',
         'Internal staff update expense receipts',
         'Internal staff delete expense receipts',
         'Role-scoped read expense receipts',
         'Role-scoped upload expense receipts',
         'Role-scoped update expense receipts',
         'Role-scoped delete expense receipts',
         'n51_capture_insert',
         'n51_capture_update',
         'n51_capture_delete',
         'n51_capture_select'
       )
       and (
         coalesce(qual, '') ilike '%expense-receipts%'
         or coalesce(with_check, '') ilike '%expense-receipts%'
       )
  ) then
    raise exception 'Unexpected expense-receipts Storage policy requires review.' using errcode = '55000';
  end if;
end;
$preflight$;

create table public.expense_receipt_assignments (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default clock_timestamp(),
  primary key (expense_id, user_id)
);

alter table public.expense_receipt_assignments enable row level security;
alter table public.expense_receipt_assignments force row level security;
revoke all on public.expense_receipt_assignments from public, anon, authenticated, service_role;

-- Storage policies use this definer to resolve the path to a real expense and
-- then check an explicit business relationship. A folder segment is only a
-- lookup key; it never establishes ownership or authorization on its own.
create or replace function app_private.can_access_expense_receipt_object(
  p_object_name text,
  p_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_folders text[];
  v_expense_id uuid;
  v_expense_exists boolean;
  v_role_authorized boolean;
begin
  if v_user_id is null or p_object_name is null or p_write is null then
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

  v_folders := storage.foldername(p_object_name);
  if coalesce(array_length(v_folders, 1), 0) < 2 then
    return false;
  end if;

  if v_folders[1] = 'captures' and not p_write then
    begin
      if v_role in ('owner', 'admin', 'finance') then
        return exists (
          select 1 from public.expenses as expense
           where expense.receipt_file_path = p_object_name
        );
      end if;

      if v_role = 'operator' and exists (
        select 1
          from public.expense_capture_sessions as capture_session
         where capture_session.id = v_folders[2]::uuid
           and capture_session.created_by = v_user_id
           and capture_session.status <> 'CANCELLED'
      ) then
        return true;
      end if;

      return v_role = 'operator' and exists (
        select 1
          from public.expenses as expense
         where expense.receipt_file_path = p_object_name
           and (
             exists (
               select 1 from public.expense_receipt_assignments as assignment
                where assignment.expense_id = expense.id
                  and assignment.user_id = v_user_id
             )
             or exists (
               select 1 from public.expense_capture_confirmations as confirmation
                where confirmation.expense_id = expense.id
                  and confirmation.created_by = v_user_id
                  and confirmation.duplicate_decision = 'CREATE_NEW'
             )
           )
      );
    exception when invalid_text_representation then
      return false;
    end;
  end if;

  if v_folders[1] <> 'expenses' then
    return false;
  end if;

  begin
    v_expense_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select exists (select 1 from public.expenses as expense where expense.id = v_expense_id)
    into v_expense_exists;
  if not v_expense_exists then
    return false;
  end if;

  v_role_authorized := v_role in ('owner', 'admin', 'finance');
  if v_role_authorized then
    return p_write or exists (
      select 1 from public.expenses as expense
       where expense.id = v_expense_id
         and expense.receipt_file_path = p_object_name
    );
  end if;

  if v_role <> 'operator' then
    return false;
  end if;

  -- Operators can review their own/assigned receipts. The expense row is a
  -- finance-controlled record, so Storage mutation remains Owner/Admin/Finance.
  if p_write then
    return false;
  end if;

  if not p_write and not exists (
    select 1 from public.expenses as expense
     where expense.id = v_expense_id
       and expense.receipt_file_path = p_object_name
  ) then
    return false;
  end if;

  return exists (
    select 1
      from public.expense_receipt_assignments as assignment
     where assignment.expense_id = v_expense_id
       and assignment.user_id = v_user_id
  ) or exists (
    select 1
      from public.expense_capture_confirmations as confirmation
     where confirmation.expense_id = v_expense_id
       and confirmation.created_by = v_user_id
       and confirmation.duplicate_decision = 'CREATE_NEW'
  );
end;
$function$;

alter function app_private.can_access_expense_receipt_object(text, boolean) owner to postgres;
revoke all on function app_private.can_access_expense_receipt_object(text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function app_private.can_access_expense_receipt_object(text, boolean)
  to authenticated;

create or replace function public.assign_operator_expense_receipt_access(
  p_expense_id uuid,
  p_operator_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or p_expense_id is null or p_operator_user_id is null then
    raise exception 'Expense receipt assignment is not permitted.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.internal_staff_memberships as membership
     where membership.user_id = v_actor_id
       and membership.role in ('owner', 'admin')
       and membership.status = 'active'
       and membership.revoked_at is null
  ) then
    raise exception 'Expense receipt assignment is not permitted.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.expenses where id = p_expense_id)
     or not exists (
       select 1 from public.internal_staff_memberships as membership
        where membership.user_id = p_operator_user_id
          and membership.role = 'operator'
          and membership.status = 'active'
          and membership.revoked_at is null
     ) then
    raise exception 'Expense receipt assignment is not permitted.' using errcode = '42501';
  end if;

  insert into public.expense_receipt_assignments (expense_id, user_id, granted_by)
  values (p_expense_id, p_operator_user_id, v_actor_id)
  on conflict (expense_id, user_id) do update
    set granted_by = excluded.granted_by,
        granted_at = clock_timestamp();
end;
$function$;

create or replace function public.revoke_operator_expense_receipt_access(
  p_expense_id uuid,
  p_operator_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or p_expense_id is null or p_operator_user_id is null
     or not exists (
       select 1 from public.internal_staff_memberships as membership
        where membership.user_id = v_actor_id
          and membership.role in ('owner', 'admin')
          and membership.status = 'active'
          and membership.revoked_at is null
     ) then
    raise exception 'Expense receipt assignment is not permitted.' using errcode = '42501';
  end if;

  delete from public.expense_receipt_assignments
   where expense_id = p_expense_id and user_id = p_operator_user_id;
end;
$function$;

create or replace function public.list_operator_expense_receipt_access(
  p_expense_id uuid
)
returns table (operator_user_id uuid, granted_by uuid, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or p_expense_id is null
     or not exists (
       select 1 from public.internal_staff_memberships as membership
        where membership.user_id = v_actor_id
          and membership.role in ('owner', 'admin')
          and membership.status = 'active'
          and membership.revoked_at is null
     ) then
    raise exception 'Expense receipt assignment is not permitted.' using errcode = '42501';
  end if;

  return query
    select assignment.user_id, assignment.granted_by, assignment.granted_at
      from public.expense_receipt_assignments as assignment
      join public.internal_staff_memberships as membership
        on membership.user_id = assignment.user_id
       and membership.role = 'operator'
       and membership.status = 'active'
       and membership.revoked_at is null
     where assignment.expense_id = p_expense_id
     order by assignment.granted_at, assignment.user_id;
end;
$function$;

alter function public.assign_operator_expense_receipt_access(uuid, uuid) owner to postgres;
alter function public.revoke_operator_expense_receipt_access(uuid, uuid) owner to postgres;
alter function public.list_operator_expense_receipt_access(uuid) owner to postgres;
revoke all on function public.assign_operator_expense_receipt_access(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.revoke_operator_expense_receipt_access(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_operator_expense_receipt_access(uuid) from public, anon, authenticated, service_role;
grant execute on function public.assign_operator_expense_receipt_access(uuid, uuid) to authenticated;
grant execute on function public.revoke_operator_expense_receipt_access(uuid, uuid) to authenticated;
grant execute on function public.list_operator_expense_receipt_access(uuid) to authenticated;

drop policy if exists "Allow authenticated read expense receipts" on storage.objects;
drop policy if exists "Internal staff read expense receipts" on storage.objects;
create policy "Role-scoped read expense receipts" on storage.objects
for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.can_access_expense_receipt_object(name, false)
);

-- The historical N51 capture read policy accepted every active staff role,
-- including readonly. Keep only the session-owner relationship and writer roles.
drop policy if exists n51_capture_select on storage.objects;
create policy n51_capture_select on storage.objects
for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = 'captures'
  and app_private.is_current_internal_staff_writer()
  and exists (
    select 1 from public.expense_capture_sessions as capture_session
     where capture_session.id::text = (storage.foldername(name))[2]
       and capture_session.created_by = (select auth.uid())
       and capture_session.status <> 'CANCELLED'
  )
);

drop policy if exists "Allow authenticated upload expense receipts" on storage.objects;
drop policy if exists "Allow authenticated update expense receipts" on storage.objects;
drop policy if exists "Allow authenticated delete expense receipts" on storage.objects;

drop policy if exists "Internal staff upload expense receipts" on storage.objects;
create policy "Role-scoped upload expense receipts" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and app_private.can_access_expense_receipt_object(name, true)
  and name ~ '^expenses/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9_.-]*$'
  and name !~ '(^|/)[.][.]($|/)'
);

drop policy if exists "Internal staff update expense receipts" on storage.objects;
create policy "Role-scoped update expense receipts" on storage.objects
for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.can_access_expense_receipt_object(name, true)
  and name ~ '^expenses/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9_.-]*$'
  and name !~ '(^|/)[.][.]($|/)'
)
with check (
  bucket_id = 'expense-receipts'
  and app_private.can_access_expense_receipt_object(name, true)
  and name ~ '^expenses/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9_.-]*$'
  and name !~ '(^|/)[.][.]($|/)'
);

drop policy if exists "Internal staff delete expense receipts" on storage.objects;
create policy "Role-scoped delete expense receipts" on storage.objects
for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.can_access_expense_receipt_object(name, true)
  and name ~ '^expenses/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9_.-]*$'
  and name !~ '(^|/)[.][.]($|/)'
);

commit;
