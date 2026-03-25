insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
where not exists (
  select 1 from storage.buckets where id = 'expense-receipts'
);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated read expense receipts'
  ) then
    create policy "Allow authenticated read expense receipts"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'expense-receipts');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated upload expense receipts'
  ) then
    create policy "Allow authenticated upload expense receipts"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'expense-receipts');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated update expense receipts'
  ) then
    create policy "Allow authenticated update expense receipts"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'expense-receipts')
      with check (bucket_id = 'expense-receipts');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated delete expense receipts'
  ) then
    create policy "Allow authenticated delete expense receipts"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'expense-receipts');
  end if;
end $$;
