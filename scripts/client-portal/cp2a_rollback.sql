\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

-- Phase 1 is intentionally committed first. If Phase 2 cannot prove that no
-- portal identity remains, portal reachability stays disabled and the operator
-- must enter incident handling instead of reopening broad authenticated access.
begin;

revoke execute on function public.portal_get_account_context(text) from authenticated;
revoke execute on function public.portal_get_client_profile(text) from authenticated;
revoke execute on function public.portal_list_properties(text, integer) from authenticated;
revoke execute on function public.portal_get_property(text, text) from authenticated;
revoke execute on function public.portal_list_services(text, integer) from authenticated;
revoke execute on function public.portal_get_service(text, text) from authenticated;
revoke execute on function public.portal_list_service_requests(text, integer) from authenticated;
revoke execute on function public.portal_list_invoices(text, integer) from authenticated;
revoke execute on function public.portal_get_invoice(text, text) from authenticated;
revoke execute on function public.portal_get_application_status() from authenticated;

revoke execute on function public.portal_submit_application_trusted(uuid, text, text, text, text, text, text, uuid)
  from service_role;
revoke execute on function public.portal_create_invitation_trusted(uuid, text, text, text, text, timestamptz, text, uuid)
  from service_role;
revoke execute on function public.portal_accept_invitation_trusted(uuid, text, text, uuid)
  from service_role;
revoke execute on function public.portal_submit_profile_change_trusted(uuid, text, jsonb, text, uuid)
  from service_role;
revoke execute on function public.portal_submit_property_change_trusted(uuid, text, text, jsonb, text, uuid)
  from service_role;
revoke execute on function public.portal_submit_service_request_trusted(uuid, text, text, text, date, text, text, uuid, text, uuid)
  from service_role;
revoke execute on function public.portal_cancel_service_request_trusted(uuid, text, uuid, integer, text, uuid)
  from service_role;
revoke execute on function public.portal_revoke_member_trusted(uuid, text, uuid, text, uuid)
  from service_role;
revoke execute on function public.portal_get_invoice_download_authorization_trusted(uuid, text, text, uuid, text, uuid)
  from service_role;
revoke execute on function public.portal_manage_internal_staff_trusted(uuid, uuid, text, text)
  from service_role;

update public.client_portal_memberships
set status = 'revoked',
    revoked_at = coalesce(revoked_at, clock_timestamp()),
    revocation_reason_code = coalesce(revocation_reason_code, 'cp2_rollback_disabled')
where status <> 'revoked';

update public.client_portal_invitations
set status = 'revoked',
    revoked_at = coalesce(revoked_at, clock_timestamp())
where status = 'pending';

commit;

begin;

do $rollback_guard$
begin
  if current_setting('app.cp2a.allow_legacy_restore', true) <> 'true' then
    raise exception 'legacy authenticated restore requires explicit proof flag'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.client_portal_memberships)
    or exists (select 1 from public.client_portal_applications)
    or exists (select 1 from public.client_portal_invitations)
    or exists (select 1 from public.client_service_requests)
    or exists (select 1 from public.client_portal_profile_change_requests)
    or exists (select 1 from public.client_portal_property_change_requests)
    or exists (select 1 from public.invoice_document_records)
  then
    raise exception 'portal identities or records remain; legacy access stays disabled'
      using errcode = '42501';
  end if;
end;
$rollback_guard$;

drop function public.portal_get_account_context(text);
drop function public.portal_get_client_profile(text);
drop function public.portal_list_properties(text, integer);
drop function public.portal_get_property(text, text);
drop function public.portal_list_services(text, integer);
drop function public.portal_get_service(text, text);
drop function public.portal_list_service_requests(text, integer);
drop function public.portal_list_invoices(text, integer);
drop function public.portal_get_invoice(text, text);
drop function public.portal_get_application_status();
drop function public.portal_submit_application_trusted(uuid, text, text, text, text, text, text, uuid);
drop function public.portal_create_invitation_trusted(uuid, text, text, text, text, timestamptz, text, uuid);
drop function public.portal_accept_invitation_trusted(uuid, text, text, uuid);
drop function public.portal_submit_profile_change_trusted(uuid, text, jsonb, text, uuid);
drop function public.portal_submit_property_change_trusted(uuid, text, text, jsonb, text, uuid);
drop function public.portal_submit_service_request_trusted(uuid, text, text, text, date, text, text, uuid, text, uuid);
drop function public.portal_cancel_service_request_trusted(uuid, text, uuid, integer, text, uuid);
drop function public.portal_revoke_member_trusted(uuid, text, uuid, text, uuid);
drop function public.portal_get_invoice_download_authorization_trusted(uuid, text, text, uuid, text, uuid);
drop function public.portal_manage_internal_staff_trusted(uuid, uuid, text, text);

drop policy if exists "Internal staff read" on public.clients;
drop policy if exists "Internal staff read" on public.properties;
drop policy if exists "Internal staff read" on public.leads;
drop policy if exists "Internal staff read" on public.jobs;
drop policy if exists "Internal staff read" on public.invoices;
drop policy if exists "Internal staff read" on public.invoice_lines;
drop policy if exists "Internal staff read" on public.payments;
drop policy if exists "Internal staff read" on public.quotes;
drop policy if exists "Internal staff read" on public.quote_lines;
drop policy if exists "Internal staff read" on public.public_gym_manual_quiz_attempts;

create policy "Authenticated read access" on public.clients
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.properties
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.leads
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.jobs
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.invoices
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.invoice_lines
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.payments
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.quotes
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.quote_lines
for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated read access" on public.public_gym_manual_quiz_attempts
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists "Internal staff insert" on public.annual_closings;
drop policy if exists "Internal staff read" on public.annual_closings;
drop policy if exists "Internal staff update" on public.annual_closings;
create policy "Allow authenticated insert annual closings" on public.annual_closings
for insert to authenticated with check (true);
create policy "Allow authenticated select annual closings" on public.annual_closings
for select to authenticated using (true);
create policy "Allow authenticated update annual closings" on public.annual_closings
for update to authenticated using (true) with check (true);

drop policy if exists "Internal staff insert" on public.expenses;
drop policy if exists "Internal staff read" on public.expenses;
drop policy if exists "Internal staff update" on public.expenses;
create policy "Allow authenticated insert expenses" on public.expenses
for insert to authenticated with check (true);
create policy "Allow authenticated select expenses" on public.expenses
for select to authenticated using (true);
create policy "Allow authenticated update expenses" on public.expenses
for update to authenticated using (true) with check (true);

drop policy if exists "Internal staff insert" on public.quarterly_closings;
drop policy if exists "Internal staff read" on public.quarterly_closings;
drop policy if exists "Internal staff update" on public.quarterly_closings;
create policy "Allow authenticated insert quarterly closings" on public.quarterly_closings
for insert to authenticated with check (true);
create policy "Allow authenticated select quarterly closings" on public.quarterly_closings
for select to authenticated using (true);
create policy "Allow authenticated update quarterly closings" on public.quarterly_closings
for update to authenticated using (true) with check (true);

drop policy if exists "Internal staff manage" on public.intake_submissions;
create policy "Authenticated users can manage intake submissions" on public.intake_submissions
to authenticated using ((auth.uid() is not null)) with check ((auth.uid() is not null));
drop policy if exists "Internal staff manage" on public.lead_drafts;
create policy "Authenticated users can manage lead drafts" on public.lead_drafts
to authenticated using ((auth.uid() is not null)) with check ((auth.uid() is not null));
drop policy if exists "Internal staff read" on public.audit_events;
create policy "Authenticated users can read audit events" on public.audit_events
for select to authenticated using ((auth.uid() is not null));
drop policy if exists "Internal staff read" on public.job_lines;
create policy "authenticated can read job lines" on public.job_lines
for select to authenticated using (true);

drop policy if exists "Internal staff read expense receipts" on storage.objects;
drop policy if exists "Internal staff upload expense receipts" on storage.objects;
drop policy if exists "Internal staff update expense receipts" on storage.objects;
drop policy if exists "Internal staff delete expense receipts" on storage.objects;
create policy "Allow authenticated read expense receipts" on storage.objects
for select to authenticated using (bucket_id = 'expense-receipts');
create policy "Allow authenticated upload expense receipts" on storage.objects
for insert to authenticated with check (bucket_id = 'expense-receipts');
create policy "Allow authenticated update expense receipts" on storage.objects
for update to authenticated
using (bucket_id = 'expense-receipts')
with check (bucket_id = 'expense-receipts');
create policy "Allow authenticated delete expense receipts" on storage.objects
for delete to authenticated using (bucket_id = 'expense-receipts');

create or replace function public.require_authenticated_write()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for protected write.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.require_authenticated_financial_write()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for financial writes.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.record_audit_event(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_changed_fields text[] default '{}'::text[],
  p_new_values jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.audit_events (
    entity_type, entity_id, action, changed_fields, new_values, metadata, changed_by
  ) values (
    p_entity_type, p_entity_id, p_action, p_changed_fields,
    p_new_values, p_metadata, auth.uid()
  );
end;
$$;

revoke execute on function public.require_authenticated_write() from public, anon, authenticated;
revoke execute on function public.require_authenticated_financial_write() from public, anon, authenticated;

grant execute on function public.accept_quote_workflow(text, boolean, text, date) to authenticated;
grant execute on function public.assert_invoice_numbering_regular(integer, text) to authenticated;
grant execute on function public.backfill_invoice_fiscal_snapshots() to authenticated;
grant execute on function public.build_client_fiscal_snapshot(text, text) to authenticated;
grant execute on function public.convert_lead_to_client(text, text) to authenticated;
grant execute on function public.create_client(jsonb) to authenticated;
grant execute on function public.create_lead(jsonb) to authenticated;
grant execute on function public.create_property(jsonb) to authenticated;
grant execute on function public.ensure_invoice_pricing_metadata(jsonb, text, text) to authenticated;
grant execute on function public.find_first_missing_invoice_sequence(integer, text) to authenticated;
grant execute on function public.record_audit_event(text, text, text, text[], jsonb, jsonb) to authenticated;
grant execute on function public.reassign_property_client_authenticated(text, text) to authenticated;
grant execute on function public.refresh_invoice_payment_status(text) to authenticated;
grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.save_invoice_with_lines_v2(jsonb, jsonb) to authenticated;
grant execute on function public.save_job_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.save_lead_quote_with_lines(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_payment_and_refresh_invoice(jsonb) to authenticated;
grant execute on function public.save_quote_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.settle_invoice_by_transfer(text) to authenticated;
grant execute on function public.update_client(jsonb) to authenticated;
grant execute on function public.update_invoice_status(text, text) to authenticated;
grant execute on function public.update_job_status(text, text) to authenticated;
grant execute on function public.update_lead(jsonb) to authenticated;
grant execute on function public.update_property(jsonb) to authenticated;
grant execute on function public.update_quote_status(text, text) to authenticated;
revoke execute on function public.submit_public_gym_manual_quiz_attempt(jsonb)
  from public, anon, authenticated;
revoke execute on function public.submit_public_gym_manual_quiz_attempt_private(jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_gym_manual_quiz_attempt_private(jsonb, text, text)
  to service_role;

delete from storage.objects where bucket_id = 'invoice-documents';
delete from storage.buckets where id = 'invoice-documents';

drop table public.client_portal_legal_acceptances;
drop table public.invoice_document_records;
drop table public.client_portal_rate_limits;
drop table public.client_portal_audit_events;
drop table public.client_service_requests;
drop table public.client_portal_property_change_requests;
drop table public.client_portal_profile_change_requests;
drop table public.client_portal_applications;
drop table public.client_portal_memberships;
drop table public.client_portal_invitations;
drop table public.internal_staff_memberships;
drop schema portal_private cascade;

commit;
