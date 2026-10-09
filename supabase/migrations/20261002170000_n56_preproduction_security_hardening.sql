begin;

-- Keep direct Product access internal-staff-only while preserving the existing
-- authenticated client workflow and the server-side service-role boundary.
drop policy if exists "Allow authenticated insert expenses" on public.expenses;
drop policy if exists "Allow authenticated select expenses" on public.expenses;
drop policy if exists "Allow authenticated update expenses" on public.expenses;
drop policy if exists "Internal staff insert" on public.expenses;
drop policy if exists "Internal staff read" on public.expenses;
drop policy if exists "Internal staff update" on public.expenses;

create policy "Internal staff insert" on public.expenses
  for insert to authenticated
  with check (app_private.is_active_internal_staff((select auth.uid())));

create policy "Internal staff read" on public.expenses
  for select to authenticated
  using (app_private.is_active_internal_staff((select auth.uid())));

create policy "Internal staff update" on public.expenses
  for update to authenticated
  using (app_private.is_active_internal_staff((select auth.uid())))
  with check (app_private.is_active_internal_staff((select auth.uid())));

-- Anonymous access is not part of either Product or private Storage. Keep the
-- authenticated/service-role grants required by the existing workflows.
revoke all on table public.expenses from public, anon;
revoke all on table public.expense_capture_sessions from public, anon;
revoke all on table public.expense_capture_documents from public, anon;
revoke all on table public.expense_capture_extractions from public, anon;
revoke all on table public.expense_capture_normalizations from public, anon;
revoke all on table public.expense_capture_confirmations from public, anon;
-- Supabase owns storage.objects (supabase_storage_admin). Do not change the
-- platform-managed table ACL: the Storage API and other buckets require it.
-- Remove the old, broad authenticated expense-receipts policies instead.
-- RLS PERMISSIVE policies compose with OR, so the legacy policies must go.
drop policy if exists "Allow authenticated read expense receipts" on storage.objects;
drop policy if exists "Allow authenticated upload expense receipts" on storage.objects;
drop policy if exists "Allow authenticated update expense receipts" on storage.objects;
drop policy if exists "Allow authenticated delete expense receipts" on storage.objects;

-- Historical receipts include legacy names, so staff can still view/remove
-- existing paths; new uploads/replacements require a validated single-file path.
drop policy if exists "Internal staff read expense receipts" on storage.objects;
create policy "Internal staff read expense receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.is_active_internal_staff((select auth.uid()))
  and name like 'expenses/%'
);

drop policy if exists "Internal staff upload expense receipts" on storage.objects;
create policy "Internal staff upload expense receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and app_private.is_active_internal_staff((select auth.uid()))
  and name ~ '^expenses/[^/]+/[A-Za-z0-9_.-]+

-- Browser-facing capture operations are authenticated and owner-checked.
revoke all on function public.create_expense_capture_session(text, text) from public, anon;
revoke all on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) from public, anon;
revoke all on function public.cancel_expense_capture_session(uuid) from public, anon;
revoke all on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_expense_capture_session(text, text) to authenticated, service_role;
grant execute on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) to authenticated, service_role;
grant execute on function public.cancel_expense_capture_session(uuid) to authenticated, service_role;
grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- Extraction/normalization runtime helpers are server-side only.
revoke all on function public.n52_claim_extraction(uuid) from public, anon, authenticated;
revoke all on function public.n52_prepare_extraction(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.n52_claim_extraction(uuid) to service_role;
grant execute on function public.n52_prepare_extraction(uuid, uuid, text, integer, text, text) to service_role;
grant execute on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) to service_role;

commit;

  and name !~ '(^|/)\\.\\.($|/)'
);

drop policy if exists "Internal staff update expense receipts" on storage.objects;
create policy "Internal staff update expense receipts"
on storage.objects for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.is_active_internal_staff((select auth.uid()))
  and name like 'expenses/%'
)
with check (
  bucket_id = 'expense-receipts'
  and app_private.is_active_internal_staff((select auth.uid()))
  and name ~ '^expenses/[^/]+/[A-Za-z0-9_.-]+

-- Browser-facing capture operations are authenticated and owner-checked.
revoke all on function public.create_expense_capture_session(text, text) from public, anon;
revoke all on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) from public, anon;
revoke all on function public.cancel_expense_capture_session(uuid) from public, anon;
revoke all on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_expense_capture_session(text, text) to authenticated, service_role;
grant execute on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) to authenticated, service_role;
grant execute on function public.cancel_expense_capture_session(uuid) to authenticated, service_role;
grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- Extraction/normalization runtime helpers are server-side only.
revoke all on function public.n52_claim_extraction(uuid) from public, anon, authenticated;
revoke all on function public.n52_prepare_extraction(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.n52_claim_extraction(uuid) to service_role;
grant execute on function public.n52_prepare_extraction(uuid, uuid, text, integer, text, text) to service_role;
grant execute on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) to service_role;

commit;

  and name !~ '(^|/)\\.\\.($|/)'
);

drop policy if exists "Internal staff delete expense receipts" on storage.objects;
create policy "Internal staff delete expense receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and app_private.is_active_internal_staff((select auth.uid()))
  and name like 'expenses/%'
);

-- Browser-facing capture operations are authenticated and owner-checked.
revoke all on function public.create_expense_capture_session(text, text) from public, anon;
revoke all on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) from public, anon;
revoke all on function public.cancel_expense_capture_session(uuid) from public, anon;
revoke all on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_expense_capture_session(text, text) to authenticated, service_role;
grant execute on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) to authenticated, service_role;
grant execute on function public.cancel_expense_capture_session(uuid) to authenticated, service_role;
grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- Extraction/normalization runtime helpers are server-side only.
revoke all on function public.n52_claim_extraction(uuid) from public, anon, authenticated;
revoke all on function public.n52_prepare_extraction(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.n52_claim_extraction(uuid) to service_role;
grant execute on function public.n52_prepare_extraction(uuid, uuid, text, integer, text, text) to service_role;
grant execute on function public.n53_claim_normalization(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_failure(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.n53_finalize_normalization_success(uuid, uuid, integer, text, text, jsonb, text, text) to service_role;

commit;
