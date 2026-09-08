begin;

-- Internal expense support is private and is read through signed URLs only.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Internal staff read expense receipts" on storage.objects;
create policy "Internal staff read expense receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name like 'expenses/%'
);

drop policy if exists "Internal staff upload expense receipts" on storage.objects;
create policy "Internal staff upload expense receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name ~ '^expenses/[^/]+/[A-Za-z0-9_.-]+$'
  and name !~ '(^|/)\.\.($|/)'
);

drop policy if exists "Internal staff update expense receipts" on storage.objects;
create policy "Internal staff update expense receipts"
on storage.objects for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name like 'expenses/%'
)
with check (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name ~ '^expenses/[^/]+/[A-Za-z0-9_.-]+$'
  and name !~ '(^|/)\.\.($|/)'
);

drop policy if exists "Internal staff delete expense receipts" on storage.objects;
create policy "Internal staff delete expense receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name like 'expenses/%'
);

commit;
