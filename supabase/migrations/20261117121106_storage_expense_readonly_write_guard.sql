begin;

-- The guard below runs as postgres, while the existing role contract is owned
-- by supabase_admin and is not executable by postgres after its public revoke.
-- Grant only this internal dependency to the guard's definer role.
grant execute on function app_private.require_internal_staff_write() to postgres;

-- The existing role contract defines write-capable internal staff. Keep that
-- single source of truth and expose only the current actor's boolean decision
-- to RLS; callers cannot probe another user's membership.
create or replace function app_private.is_current_internal_staff_writer()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  return app_private.require_internal_staff_write() = v_user_id;
exception
  when insufficient_privilege then
    return false;
end;
$function$;

alter function app_private.is_current_internal_staff_writer() owner to postgres;
revoke all on function app_private.is_current_internal_staff_writer()
  from public, anon, authenticated, service_role;
grant execute on function app_private.is_current_internal_staff_writer()
  to authenticated;

-- Client profile media has the same active-staff-only write gap. Preserve the
-- existing bucket and filename constraints while applying the same role gate.
drop policy if exists "Internal staff upload client profile media" on storage.objects;
create policy "Internal staff upload client profile media" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'client-profile-media'
  and app_private.is_current_internal_staff_writer()
  and name ~ '^clients/[^/]+/[0-9A-Fa-f-]+\.(jpg|png|webp)$'
  and name !~ '(^|/)\.\.($|/)'
);

drop policy if exists "Internal staff update client profile media" on storage.objects;
create policy "Internal staff update client profile media" on storage.objects
for update to authenticated
using (
  bucket_id = 'client-profile-media'
  and app_private.is_current_internal_staff_writer()
  and name like 'clients/%'
)
with check (
  bucket_id = 'client-profile-media'
  and app_private.is_current_internal_staff_writer()
  and name ~ '^clients/[^/]+/[0-9A-Fa-f-]+\.(jpg|png|webp)$'
  and name !~ '(^|/)\.\.($|/)'
);

drop policy if exists "Internal staff delete client profile media" on storage.objects;
create policy "Internal staff delete client profile media" on storage.objects
for delete to authenticated
using (
  bucket_id = 'client-profile-media'
  and app_private.is_current_internal_staff_writer()
  and name like 'clients/%'
);

-- Expense receipt policies are permissive and therefore OR together. Replace
-- every write policy on expense-receipts, including N51 capture paths, while
-- keeping each existing path, owner and session condition intact.
-- Production currently also has these legacy bucket-wide authenticated write
-- policies. They must be removed because PostgreSQL ORs permissive policies;
-- leaving them would bypass the staff-writer checks below. Keep the matching
-- read policy untouched (shared internal read remains accepted technical debt).
drop policy if exists "Allow authenticated upload expense receipts" on storage.objects;
drop policy if exists "Allow authenticated update expense receipts" on storage.objects;
drop policy if exists "Allow authenticated delete expense receipts" on storage.objects;

drop policy if exists "Internal staff upload expense receipts" on storage.objects;
create policy "Internal staff upload expense receipts" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and app_private.is_current_internal_staff_writer()
  and name ~ '^expenses/[^/]+/[A-Za-z0-9][A-Za-z0-9_.-]*$'
  and name !~ '(^|/)[.][.]($|/)'
);

drop policy if exists "Internal staff update expense receipts" on storage.objects;
create policy "Internal staff update expense receipts" on storage.objects
for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.is_current_internal_staff_writer()
  and name like 'expenses/%'
  and name !~ '(^|/)[.][.]($|/)'
)
with check (
  bucket_id = 'expense-receipts'
  and app_private.is_current_internal_staff_writer()
  and name ~ '^expenses/[^/]+/[A-Za-z0-9][A-Za-z0-9_.-]*$'
  and name !~ '(^|/)[.][.]($|/)'
);

drop policy if exists "Internal staff delete expense receipts" on storage.objects;
create policy "Internal staff delete expense receipts" on storage.objects
for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.is_current_internal_staff_writer()
  and name like 'expenses/%'
  and name !~ '(^|/)[.][.]($|/)'
);

drop policy if exists n51_capture_insert on storage.objects;
create policy n51_capture_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = 'captures'
  and app_private.is_current_internal_staff_writer()
  and exists (
    select 1 from public.expense_capture_sessions as session
    where session.id::text = (storage.foldername(name))[2]
      and session.created_by = (select auth.uid())
      and session.status <> 'CANCELLED'
  )
);

drop policy if exists n51_capture_update on storage.objects;
create policy n51_capture_update on storage.objects
for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = 'captures'
  and app_private.is_current_internal_staff_writer()
  and exists (
    select 1 from public.expense_capture_sessions as session
    where session.id::text = (storage.foldername(name))[2]
      and session.created_by = (select auth.uid())
      and session.status <> 'CANCELLED'
  )
)
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = 'captures'
  and app_private.is_current_internal_staff_writer()
  and exists (
    select 1 from public.expense_capture_sessions as session
    where session.id::text = (storage.foldername(name))[2]
      and session.created_by = (select auth.uid())
      and session.status <> 'CANCELLED'
  )
);

drop policy if exists n51_capture_delete on storage.objects;
create policy n51_capture_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = 'captures'
  and app_private.is_current_internal_staff_writer()
  and exists (
    select 1 from public.expense_capture_sessions as session
    where session.id::text = (storage.foldername(name))[2]
      and session.created_by = (select auth.uid())
      and app_private.is_active_internal_staff((select auth.uid()))
  )
);

commit;
