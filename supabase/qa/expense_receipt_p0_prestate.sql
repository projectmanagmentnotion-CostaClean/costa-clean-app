-- Synthetic PostgreSQL-only contract for the Production Storage P0 migration.
-- Never point this fixture at a linked Supabase project or a real dataset.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema app_private;
create schema storage;
create table public.internal_staff_memberships (
  user_id uuid not null,
  role text not null,
  status text not null,
  revoked_at timestamptz
);
create table public.expenses (
  id uuid primary key,
  receipt_file_path text
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create function app_private.internal_staff_role_can_write_financially(p_role text)
returns boolean language sql immutable set search_path = ''
as $$ select p_role in ('owner', 'admin', 'finance') $$;
alter function app_private.internal_staff_role_can_write_financially(text) owner to postgres;

create function public.expense_staff_access(p_financial_write boolean)
returns boolean language plpgsql stable security definer set search_path = ''
as $function$
declare v_role text;
begin
  if auth.uid() is null or p_financial_write is null then return false; end if;
  select m.role into v_role
  from public.internal_staff_memberships m
  where m.user_id = auth.uid() and m.status = 'active' and m.revoked_at is null;
  if not found then return false; end if;
  return not p_financial_write or app_private.internal_staff_role_can_write_financially(v_role);
end
$function$;
alter function public.expense_staff_access(boolean) owner to postgres;

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null
);
alter table storage.objects enable row level security;
grant usage on schema auth, app_private, storage, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function public.expense_staff_access(boolean) to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

insert into public.internal_staff_memberships (user_id, role, status) values
  ('00000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'finance', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'operator', 'active'),
  ('00000000-0000-0000-0000-000000000004', 'readonly', 'active'),
  ('00000000-0000-0000-0000-000000000005', 'admin', 'active');

insert into public.expenses (id, receipt_file_path) values
  ('10000000-0000-0000-0000-000000000001', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-01T10-00-00-000Z-synthetic.pdf'),
  ('10000000-0000-0000-0000-000000000002', 'legacy/synthetic-linked.pdf'),
  ('10000000-0000-0000-0000-000000000003', null),
  ('10000000-0000-0000-0000-000000000004', 'expenses/10000000-0000-0000-0000-000000000004/2026-11-01T10-01-00-000Z-finance-linked.pdf'),
  ('10000000-0000-0000-0000-000000000005', 'expenses/10000000-0000-0000-0000-000000000005/2026-11-01T10-02-00-000Z-admin-linked.pdf');

insert into storage.objects (bucket_id, name) values
  ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-01T10-00-00-000Z-synthetic.pdf'),
  ('expense-receipts', 'legacy/synthetic-linked.pdf'),
  ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000003/2026-11-01T10-00-00-000Z-stale-financial.pdf'),
  ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000004/2026-11-01T10-01-00-000Z-finance-linked.pdf'),
  ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000005/2026-11-01T10-02-00-000Z-admin-linked.pdf'),
  ('expense-receipts', 'expenses/20000000-0000-0000-0000-000000000001/2026-11-01T10-03-00-000Z-orphan.pdf'),
  ('other-private-bucket', 'synthetic/untouched.pdf');

create policy "Allow authenticated read expense receipts" on storage.objects
  for select to authenticated using (bucket_id = 'expense-receipts');
create policy "Allow authenticated upload expense receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'expense-receipts');
create policy "Allow authenticated update expense receipts" on storage.objects
  for update to authenticated using (bucket_id = 'expense-receipts')
  with check (bucket_id = 'expense-receipts');
create policy "Allow authenticated delete expense receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'expense-receipts');
