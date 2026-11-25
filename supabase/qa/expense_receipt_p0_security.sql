\set ON_ERROR_STOP on

\echo STORAGE_P0_MIGRATION_APPLY
\i supabase/migrations/20261125164758_secure_expense_receipt_storage_p0.sql

-- Owner: reads linked receipts and can insert/upsert/update/delete a receipt
-- for an existing expense. All data here is synthetic.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects
    where bucket_id = 'expense-receipts'
      and name = 'expenses/10000000-0000-0000-0000-000000000001/2026-11-01T10-00-00-000Z-synthetic.pdf';
  if v_count <> 1 then raise exception 'owner linked SELECT denied'; end if;
  insert into storage.objects (bucket_id, name) values
    ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-25T12-00-00-000Z-owner.pdf');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'owner INSERT denied'; end if;
  update storage.objects set name = name
    where bucket_id = 'expense-receipts'
      and name = 'expenses/10000000-0000-0000-0000-000000000001/2026-11-01T10-00-00-000Z-synthetic.pdf';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'owner UPDATE denied'; end if;
  delete from storage.objects where bucket_id = 'expense-receipts'
    and name = 'expenses/10000000-0000-0000-0000-000000000001/2026-11-01T10-00-00-000Z-synthetic.pdf';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'owner DELETE denied'; end if;
  if (select count(*) from storage.objects where bucket_id = 'expense-receipts'
      and name like '%stale-financial.pdf') <> 1 then
    raise exception 'financial staff cannot read canonical historical receipt';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'expense-receipts'
      and name like '%orphan.pdf') then raise exception 'owner saw object without expense'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_OWNER=PASS

-- Finance retains the same financial storage operations.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where name like '%stale-financial.pdf';
  if v_count <> 1 then raise exception 'finance cannot SELECT canonical historical object'; end if;
  delete from storage.objects where name like '%stale-financial.pdf';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'finance cannot DELETE canonical historical object'; end if;
  insert into storage.objects (bucket_id, name) values
    ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000003/2026-11-25T12-01-00-000Z-finance.png');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'finance INSERT denied'; end if;
  update storage.objects set name = name where name =
    'expenses/10000000-0000-0000-0000-000000000004/2026-11-01T10-01-00-000Z-finance-linked.pdf';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'finance UPDATE denied'; end if;
  delete from storage.objects where name =
    'expenses/10000000-0000-0000-0000-000000000004/2026-11-01T10-01-00-000Z-finance-linked.pdf';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'finance DELETE denied'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_FINANCE=PASS

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
do $test$
declare v_count integer;
begin
  insert into storage.objects (bucket_id, name) values
    ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000003/2026-11-25T12-01-30-000Z-admin.pdf');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'admin INSERT denied'; end if;
  delete from storage.objects where name =
    'expenses/10000000-0000-0000-0000-000000000005/2026-11-01T10-02-00-000Z-admin-linked.pdf';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'admin DELETE denied'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_ADMIN=PASS

-- Active operator and readonly staff retain read-only access to current links.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'expense-receipts';
  if v_count <> 1 then raise exception 'operator linked SELECT contract failed'; end if;
  begin
    insert into storage.objects (bucket_id, name) values
      ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-25T12-02-00-000Z-denied.pdf');
    get diagnostics v_count = row_count;
  exception when insufficient_privilege then
    v_count := 0;
  end;
  if v_count <> 0 then raise exception 'operator INSERT unexpectedly allowed'; end if;
  update storage.objects set name = name where name like 'expenses/%';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'operator UPDATE unexpectedly allowed'; end if;
  delete from storage.objects where bucket_id = 'expense-receipts';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'operator DELETE unexpectedly allowed'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_OPERATOR=PASS

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'expense-receipts';
  if v_count <> 1 then raise exception 'readonly linked SELECT contract failed'; end if;
  begin
    insert into storage.objects (bucket_id, name) values
      ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-25T12-03-00-000Z-denied.pdf');
    get diagnostics v_count = row_count;
  exception when insufficient_privilege then
    v_count := 0;
  end;
  if v_count <> 0 then raise exception 'readonly INSERT unexpectedly allowed'; end if;
  delete from storage.objects where bucket_id = 'expense-receipts';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'readonly DELETE unexpectedly allowed'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_READONLY=PASS

-- An authenticated user outside staff cannot see or mutate receipt objects.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'expense-receipts';
  if v_count <> 0 then raise exception 'nonmember SELECT unexpectedly allowed'; end if;
  begin
    insert into storage.objects (bucket_id, name) values
      ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-25T12-04-00-000Z-denied.pdf');
    get diagnostics v_count = row_count;
  exception when insufficient_privilege then
    v_count := 0;
  end;
  if v_count <> 0 then raise exception 'nonmember INSERT unexpectedly allowed'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_NONMEMBER=PASS

-- Anon is explicitly granted table privileges in this fixture so RLS is the
-- tested boundary; the restrictive guard must deny every bucket operation.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'expense-receipts';
  if v_count <> 0 then raise exception 'anon SELECT unexpectedly allowed'; end if;
  begin
    insert into storage.objects (bucket_id, name) values
      ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-25T12-05-00-000Z-denied.pdf');
    get diagnostics v_count = row_count;
  exception when insufficient_privilege then
    v_count := 0;
  end;
  if v_count <> 0 then raise exception 'anon INSERT unexpectedly allowed'; end if;
end
$test$;
reset role;
\echo STORAGE_P0_ANON=PASS

-- A future broad permissive policy cannot defeat the restrictive guard.
create policy "synthetic future broad grant" on storage.objects
  for all to authenticated using (true) with check (true);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'expense-receipts'
    and name like '%orphan.pdf';
  if v_count <> 0 then raise exception 'restrictive SELECT guard failed'; end if;
  begin
    insert into storage.objects (bucket_id, name) values
      ('expense-receipts', 'expenses/10000000-0000-0000-0000-000000000001/2026-11-25T12-06-00-000Z-guard.pdf');
    get diagnostics v_count = row_count;
  exception when insufficient_privilege then
    v_count := 0;
  end;
  if v_count <> 0 then raise exception 'restrictive INSERT guard failed'; end if;
end
$test$;
reset role;
drop policy "synthetic future broad grant" on storage.objects;
\echo STORAGE_P0_RESTRICTIVE_GUARDS=PASS

-- The unrelated bucket remains governed by its own independent policy.
create policy "synthetic other bucket access" on storage.objects
  for select to authenticated using (bucket_id = 'other-private-bucket');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
do $test$
declare v_count integer;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'other-private-bucket';
  if v_count <> 1 then raise exception 'unrelated bucket policy changed'; end if;
end
$test$;
reset role;
drop policy "synthetic other bucket access" on storage.objects;
\echo STORAGE_P0_OTHER_BUCKET_UNCHANGED=PASS
\echo STORAGE_P0_SECURITY_TESTS=PASS
