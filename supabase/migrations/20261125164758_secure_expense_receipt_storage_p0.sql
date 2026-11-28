begin;

-- Fail closed if this migration is applied to a schema other than the
-- Production contract it was designed for. It deliberately has no V3 deps.
do $preflight$
begin
  if to_regclass('storage.objects') is null
     or to_regclass('public.expenses') is null
     or to_regprocedure('public.expense_staff_access(boolean)') is null
     or to_regprocedure('app_private.internal_staff_role_can_write_financially(text)') is null then
    raise exception 'expense receipt P0 preflight failed: required Production contracts are missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'id'
      and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'receipt_file_path'
      and data_type = 'text'
  ) then
    raise exception 'expense receipt P0 preflight failed: expenses contract differs';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'storage.objects'::regclass and c.relrowsecurity
  ) then
    raise exception 'expense receipt P0 preflight failed: storage.objects RLS is not enabled';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'expense receipt P0 preflight failed: Supabase API roles are missing';
  end if;
end;
$preflight$;

-- The function is intentionally narrow: it returns only an authorization
-- boolean, reads the existing Production expense contract, and never exposes
-- rows or storage metadata. The auth.uid() check is delegated to the already
-- deployed staff/financial authorization function.
create or replace function public.expense_receipt_storage_access(
  p_object_name text,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_object_name is null
     or p_operation is null
     or p_operation not in ('select', 'insert', 'update', 'delete') then
    return false;
  end if;

  if p_operation = 'select' then
    if not public.expense_staff_access(false) then
      return false;
    end if;

    if exists (
      select 1
      from public.expenses e
      where e.receipt_file_path = p_object_name
    ) then
      return true;
    end if;

    -- Storage upsert and delete also require SELECT visibility. Financial
    -- staff may therefore see canonical historical objects in an existing
    -- expense folder even after receipt_file_path moved to a replacement.
    if not public.expense_staff_access(true)
       or p_object_name !~* '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z-[a-z0-9_-]+\.(pdf|jpg|jpeg|png|webp)$' then
      return false;
    end if;

    return exists (
      select 1 from public.expenses e
      where e.id::text = split_part(p_object_name, '/', 2)
    );
  end if;

  if not public.expense_staff_access(true) then
    return false;
  end if;

  -- V1 deletes the previous attachment before replacing it. Preserve this
  -- for every historical path that is still the expense's active pointer.
  if p_operation = 'delete' and exists (
    select 1 from public.expenses e where e.receipt_file_path = p_object_name
  ) then
    return true;
  end if;

  -- V1 uploads to expenses/<uuid>/<timestamp>-<sanitized-name> with upsert.
  -- Restrict new writes to that path contract and an existing expense row.
  if p_object_name !~* '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z-[a-z0-9_-]+\.(pdf|jpg|jpeg|png|webp)$' then
    return false;
  end if;

  return exists (
    select 1
    from public.expenses e
    where e.id::text = split_part(p_object_name, '/', 2)
  );
end;
$function$;

alter function public.expense_receipt_storage_access(text, text) owner to postgres;
revoke all on function public.expense_receipt_storage_access(text, text) from public;
revoke all on function public.expense_receipt_storage_access(text, text) from anon;
revoke all on function public.expense_receipt_storage_access(text, text) from authenticated;
grant execute on function public.expense_receipt_storage_access(text, text) to anon, authenticated;

-- Remove both generations of bucket-only policies. Adding narrow PERMISSIVE
-- policies without this cleanup would still leave access open through OR.
drop policy if exists "Allow authenticated read expense receipts" on storage.objects;
drop policy if exists "Allow authenticated upload expense receipts" on storage.objects;
drop policy if exists "Allow authenticated update expense receipts" on storage.objects;
drop policy if exists "Allow authenticated delete expense receipts" on storage.objects;
drop policy if exists "Internal staff read expense receipts" on storage.objects;
drop policy if exists "Internal staff upload expense receipts" on storage.objects;
drop policy if exists "Internal staff update expense receipts" on storage.objects;
drop policy if exists "Internal staff delete expense receipts" on storage.objects;

-- PERMISSIVE policies provide access to authorized staff. Restrictive guards
-- make these bucket rules intersect with every applicable policy, preventing
-- a later or forgotten broad PERMISSIVE policy from reopening the bucket.
create policy "P0 expense receipts staff read"
on storage.objects as permissive for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and public.expense_receipt_storage_access(name, 'select')
);
create policy "P0 expense receipts financial insert"
on storage.objects as permissive for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and public.expense_receipt_storage_access(name, 'insert')
);
create policy "P0 expense receipts financial update"
on storage.objects as permissive for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and public.expense_receipt_storage_access(name, 'update')
)
with check (
  bucket_id = 'expense-receipts'
  and public.expense_receipt_storage_access(name, 'update')
);
create policy "P0 expense receipts financial delete"
on storage.objects as permissive for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and public.expense_receipt_storage_access(name, 'delete')
);

create policy "P0 expense receipts SELECT guard"
on storage.objects as restrictive for select to public
using (
  bucket_id <> 'expense-receipts'
  or public.expense_receipt_storage_access(name, 'select')
);
create policy "P0 expense receipts INSERT guard"
on storage.objects as restrictive for insert to public
with check (
  bucket_id <> 'expense-receipts'
  or public.expense_receipt_storage_access(name, 'insert')
);
create policy "P0 expense receipts UPDATE guard"
on storage.objects as restrictive for update to public
using (
  bucket_id <> 'expense-receipts'
  or public.expense_receipt_storage_access(name, 'update')
)
with check (
  bucket_id <> 'expense-receipts'
  or public.expense_receipt_storage_access(name, 'update')
);
create policy "P0 expense receipts DELETE guard"
on storage.objects as restrictive for delete to public
using (
  bucket_id <> 'expense-receipts'
  or public.expense_receipt_storage_access(name, 'delete')
);

do $postcheck$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'Allow authenticated read expense receipts',
        'Allow authenticated upload expense receipts',
        'Allow authenticated update expense receipts',
        'Allow authenticated delete expense receipts',
        'Internal staff read expense receipts',
        'Internal staff upload expense receipts',
        'Internal staff update expense receipts',
        'Internal staff delete expense receipts'
      )
  ) then
    raise exception 'expense receipt P0 postcheck failed: legacy permissive policy remains';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname in (
          'P0 expense receipts SELECT guard',
          'P0 expense receipts INSERT guard',
          'P0 expense receipts UPDATE guard',
          'P0 expense receipts DELETE guard'
        ) and permissive = 'RESTRICTIVE') <> 4 then
    raise exception 'expense receipt P0 postcheck failed: restrictive guards are incomplete';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_roles owner_role on owner_role.oid = p.proowner
    where p.oid = 'public.expense_receipt_storage_access(text,text)'::regprocedure
      and p.prosecdef and owner_role.rolname = 'postgres'
      and p.proconfig is not null
      and exists (
        select 1 from pg_options_to_table(p.proconfig) setting
        where setting.option_name = 'search_path'
      )
  ) then
    raise exception 'expense receipt P0 postcheck failed: authorization function owner or search_path is unsafe';
  end if;

  if not has_function_privilege('anon', 'public.expense_receipt_storage_access(text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.expense_receipt_storage_access(text,text)', 'EXECUTE') then
    raise exception 'expense receipt P0 postcheck failed: API role execute grants are missing';
  end if;

  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.expense_receipt_storage_access(text,text)'::regprocedure
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'expense receipt P0 postcheck failed: helper is executable by PUBLIC';
  end if;
end;
$postcheck$;

commit;
