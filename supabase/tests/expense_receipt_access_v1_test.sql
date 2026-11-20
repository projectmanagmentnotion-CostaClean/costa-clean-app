begin;
select plan(31);

-- Synthetic-only contract proof for a disposable Supabase database. No object
-- bytes are created. Direct SQL cannot prove Storage API delete because
-- storage.protect_delete() runs before RLS; that path remains NOT_TESTED here.
set local session_replication_role = replica;
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111101', 'receipt-owner@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111102', 'receipt-admin@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111103', 'receipt-finance@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111104', 'receipt-operator-own@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111105', 'receipt-operator-assigned@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111106', 'receipt-operator-unassigned@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111107', 'receipt-readonly@example.invalid', now(), now(), now()),
  ('11111111-1111-4111-8111-111111111108', 'receipt-nonmember@example.invalid', now(), now(), now());
set local session_replication_role = origin;

insert into public.internal_staff_memberships (user_id, role, status, revoked_at)
values
  ('11111111-1111-4111-8111-111111111101', 'owner', 'active', null),
  ('11111111-1111-4111-8111-111111111102', 'admin', 'active', null),
  ('11111111-1111-4111-8111-111111111103', 'finance', 'active', null),
  ('11111111-1111-4111-8111-111111111104', 'operator', 'active', null),
  ('11111111-1111-4111-8111-111111111105', 'operator', 'active', null),
  ('11111111-1111-4111-8111-111111111106', 'operator', 'active', null),
  ('11111111-1111-4111-8111-111111111107', 'readonly', 'active', null);

insert into public.expenses (id, supplier_name, category, description, receipt_file_path)
values
  ('22222222-2222-4222-8222-222222222201', 'Synthetic receipt fixture', 'otros', 'synthetic owner receipt', 'expenses/22222222-2222-4222-8222-222222222201/owner.png'),
  ('22222222-2222-4222-8222-222222222202', 'Synthetic receipt fixture', 'otros', 'synthetic assigned receipt', 'expenses/22222222-2222-4222-8222-222222222202/assigned.png'),
  ('22222222-2222-4222-8222-222222222203', 'Synthetic receipt fixture', 'otros', 'synthetic unassigned receipt', 'expenses/22222222-2222-4222-8222-222222222203/unassigned.png');

insert into public.expense_receipt_assignments (expense_id, user_id, granted_by)
values ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111105', '11111111-1111-4111-8111-111111111101');

-- Represent an operator-owned N51 staging capture. N55 CREATE_NEW is reserved
-- for financial roles by P0, so it cannot prove operator ownership.
insert into public.expense_capture_sessions (id, created_by, source, idempotency_key)
values ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111104', 'upload', 'receipt-test-own-session');

insert into storage.objects (bucket_id, name, metadata)
values
  ('expense-receipts', 'expenses/22222222-2222-4222-8222-222222222201/owner.png', '{"mimetype":"image/png","size":1}'::jsonb),
  ('expense-receipts', 'expenses/22222222-2222-4222-8222-222222222202/assigned.png', '{"mimetype":"image/png","size":1}'::jsonb),
  ('expense-receipts', 'expenses/22222222-2222-4222-8222-222222222203/unassigned.png', '{"mimetype":"image/png","size":1}'::jsonb),
  ('expense-receipts', 'captures/33333333-3333-4333-8333-333333333301/staged.png', '{"mimetype":"image/png","size":1}'::jsonb);

select ok((select relrowsecurity from pg_class where oid = 'public.expense_receipt_assignments'::regclass), 'assignment table has RLS enabled');
select ok((select relforcerowsecurity from pg_class where oid = 'public.expense_receipt_assignments'::regclass), 'assignment table forces RLS');
select ok(not has_table_privilege('authenticated', 'public.expense_receipt_assignments', 'SELECT'), 'authenticated cannot read assignment table directly');
select ok(not has_table_privilege('anon', 'public.expense_receipt_assignments', 'SELECT'), 'anon cannot read assignment table');
select ok(not has_table_privilege('service_role', 'public.expense_receipt_assignments', 'SELECT'), 'service_role cannot use the assignment table as an API table');
select ok(has_function_privilege('authenticated', 'public.assign_operator_expense_receipt_access(uuid,uuid)', 'EXECUTE'), 'authenticated can invoke the guarded assignment RPC');
select ok(not has_function_privilege('anon', 'public.assign_operator_expense_receipt_access(uuid,uuid)', 'EXECUTE'), 'anon cannot invoke assignment RPC');
select ok(not has_function_privilege('service_role', 'public.assign_operator_expense_receipt_access(uuid,uuid)', 'EXECUTE'), 'service_role cannot invoke assignment RPC');
select ok(has_function_privilege('authenticated', 'public.revoke_operator_expense_receipt_access(uuid,uuid)', 'EXECUTE'), 'authenticated can invoke guarded revocation RPC');
select ok(has_function_privilege('authenticated', 'public.list_operator_expense_receipt_access(uuid)', 'EXECUTE'), 'authenticated can invoke guarded assignment list RPC');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111101","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 3, 'owner reads workspace receipts');
select ok(app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222201/owner.png', true), 'owner may delete workspace receipt through the Storage API policy');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111102', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111102","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 3, 'admin reads workspace receipts');
select ok(app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222201/owner.png', true), 'admin may delete workspace receipt through the Storage API policy');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111103', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111103","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 3, 'finance reads workspace receipts');
select ok(app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222201/owner.png', true), 'finance may delete workspace receipt through the Storage API policy');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111104', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111104","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 1, 'operator reads only own active N51 staging capture');
select ok(not app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222201/owner.png', false), 'operator cannot treat an unrelated expense receipt as owned');
select ok(not app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222202/new.png', true), 'operator cannot infer access from an unassigned expense path');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('expense-receipts', 'expenses/22222222-2222-4222-8222-222222222201/operator-new.png', '{"mimetype":"image/png","size":1}'::jsonb)$$, '42501', null, 'operator cannot upload or overwrite financial expense receipts');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111105', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111105","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 1, 'assigned operator reads only explicitly assigned receipt');
select ok(not app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222202/assigned.png', true), 'explicit assignment does not permit operator delete');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('expense-receipts', 'expenses/22222222-2222-4222-8222-222222222202/operator-new.png', '{"mimetype":"image/png","size":1}'::jsonb)$$, '42501', null, 'assigned operator cannot upload or overwrite financial expense receipts');
select is((with updated as (
  update storage.objects set metadata = '{"mimetype":"image/png","size":2}'::jsonb
   where bucket_id = 'expense-receipts' and name = 'expenses/22222222-2222-4222-8222-222222222202/assigned.png'
  returning 1
) select count(*)::integer from updated), 0, 'assigned operator cannot update assigned receipt metadata');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111106', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111106","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 0, 'unassigned operator sees no workspace receipts');
select ok(not app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222203/guess.png', true), 'unassigned operator is denied writes by guessed expense path');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111107', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111107","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 0, 'readonly has no receipt access by default');
select ok(not app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222201/owner.png', true), 'readonly is denied write/delete authorization');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111108', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111108","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id = 'expense-receipts'), 0, 'nonmember is denied all receipt reads');
select ok(not app_private.can_access_expense_receipt_object('expenses/22222222-2222-4222-8222-222222222201/owner.png', true), 'nonmember is denied write/delete authorization');
reset role;

select ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'role-scoped delete expense receipts' and cmd = 'DELETE'
    and qual like '%can_access_expense_receipt_object%'
), 'Storage DELETE policy delegates to the role-scoped authorization helper');
select * from finish();
rollback;
