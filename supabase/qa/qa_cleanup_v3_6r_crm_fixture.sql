begin;

-- QA ONLY. Do not move this file under supabase/migrations/.
-- Target assertion is performed by the deployment procedure, not by the
-- database function because the database cannot identify its project ref.

create or replace function public.qa_cleanup_v3_6r_crm_fixture(
  p_client_ids text[] default '{}',
  p_lead_ids text[] default '{}',
  p_property_ids text[] default '{}',
  p_job_ids text[] default '{}',
  p_quote_ids text[] default '{}',
  p_invoice_ids text[] default '{}',
  p_payment_ids text[] default '{}',
  p_audit_event_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marker constant text := 'QA V3-6R CRM FINAL';
  v_clients text[] := coalesce(p_client_ids, '{}');
  v_leads text[] := coalesce(p_lead_ids, '{}');
  v_properties text[] := coalesce(p_property_ids, '{}');
  v_jobs text[] := coalesce(p_job_ids, '{}');
  v_quotes text[] := coalesce(p_quote_ids, '{}');
  v_invoices text[] := coalesce(p_invoice_ids, '{}');
  v_payments text[] := coalesce(p_payment_ids, '{}');
  v_audits uuid[] := coalesce(p_audit_event_ids, '{}');
  v_entity_ids text[] := v_clients || v_leads || v_properties || v_jobs || v_quotes || v_invoices || v_payments;
  v_deleted jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.internal_staff_memberships
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'CRM QA cleanup requires an active admin membership.' using errcode = '42501';
  end if;

  if cardinality(v_clients) <> (select count(distinct value) from unnest(v_clients) as values(value))
    or cardinality(v_leads) <> (select count(distinct value) from unnest(v_leads) as values(value))
    or cardinality(v_properties) <> (select count(distinct value) from unnest(v_properties) as values(value))
    or cardinality(v_jobs) <> (select count(distinct value) from unnest(v_jobs) as values(value))
    or cardinality(v_quotes) <> (select count(distinct value) from unnest(v_quotes) as values(value))
    or cardinality(v_invoices) <> (select count(distinct value) from unnest(v_invoices) as values(value))
    or cardinality(v_payments) <> (select count(distinct value) from unnest(v_payments) as values(value))
    or cardinality(v_audits) <> (select count(distinct value) from unnest(v_audits) as values(value)) then
    raise exception 'CRM QA cleanup rejects duplicate IDs.' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_clients || v_leads || v_properties || v_jobs || v_quotes || v_invoices || v_payments) as values(value) where nullif(trim(value), '') is null)
    or exists (select 1 from unnest(v_audits) as values(value) where value is null) then
    raise exception 'CRM QA cleanup rejects empty IDs.' using errcode = '22023';
  end if;

  -- Every requested root must exist and carry the exact certification marker.
  if (select count(*) from public.clients where id = any(v_clients) and position(v_marker in full_name) > 0) <> cardinality(v_clients)
    or (select count(*) from public.leads where id = any(v_leads) and (position(v_marker in coalesce(notes, '')) > 0 or position(v_marker in full_name) > 0)) <> cardinality(v_leads)
    or (select count(*) from public.properties where id = any(v_properties) and (position(v_marker in coalesce(notes, '')) > 0 or position(v_marker in name) > 0)) <> cardinality(v_properties)
    or (select count(*) from public.jobs where id = any(v_jobs) and (position(v_marker in coalesce(notes, '')) > 0 or position(v_marker in coalesce(billing_concept, '')) > 0)) <> cardinality(v_jobs)
    or (select count(*) from public.quotes where id = any(v_quotes) and (position(v_marker in coalesce(notes, '')) > 0 or position(v_marker in coalesce(internal_notes, '')) > 0)) <> cardinality(v_quotes)
    or (select count(*) from public.invoices where id = any(v_invoices) and (position(v_marker in coalesce(notes, '')) > 0 or position(v_marker in coalesce(internal_notes, '')) > 0)) <> cardinality(v_invoices) then
    raise exception 'CRM QA cleanup marker or root ID validation failed.' using errcode = '42501';
  end if;

  -- Refuse to delete a fixture root that owns an untracked business relation.
  if exists (select 1 from public.properties where client_id = any(v_clients) and id <> all(v_properties))
    or exists (select 1 from public.jobs where client_id = any(v_clients) and id <> all(v_jobs))
    or exists (select 1 from public.quotes where client_id = any(v_clients) and id <> all(v_quotes))
    or exists (select 1 from public.invoices where client_id = any(v_clients) and id <> all(v_invoices))
    or exists (select 1 from public.jobs where property_id = any(v_properties) and id <> all(v_jobs))
    or exists (select 1 from public.quotes where property_id = any(v_properties) and id <> all(v_quotes))
    or exists (select 1 from public.invoices where property_id = any(v_properties) and id <> all(v_invoices))
    or exists (select 1 from public.invoices where job_id = any(v_jobs) and id <> all(v_invoices))
    or exists (select 1 from public.jobs where quote_id = any(v_quotes) and id <> all(v_jobs))
    or exists (select 1 from public.invoices where quote_id = any(v_quotes) and id <> all(v_invoices)) then
    raise exception 'CRM QA cleanup found an untracked business relation.' using errcode = '23503';
  end if;

  if exists (select 1 from public.payments where invoice_id = any(v_invoices) and id <> all(v_payments)) then
    raise exception 'CRM QA cleanup found an untracked payment relation.' using errcode = '23503';
  end if;

  if (select count(*) from public.payments
      where id = any(v_payments)
        and (
          position(v_marker in coalesce(notes, '')) > 0
          or invoice_id = any(v_invoices)
        )) <> cardinality(v_payments) then
    raise exception 'CRM QA cleanup found an unsafe or missing payment fixture.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.leads
    where id = any(v_leads) and converted_client_id is not null and converted_client_id <> all(v_clients)
  ) then
    raise exception 'CRM QA cleanup found an untracked converted client.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.leads
    where converted_client_id = any(v_clients) and id <> all(v_leads)
  ) then
    raise exception 'CRM QA cleanup found an untracked lead converted to a fixture client.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.quotes
    where lead_id = any(v_leads) and id <> all(v_quotes)
  ) then
    raise exception 'CRM QA cleanup found an untracked quote linked to a fixture lead.' using errcode = '23503';
  end if;

  if exists (select 1 from public.recurring_invoice_plans where client_id = any(v_clients))
    or exists (select 1 from public.recurring_invoice_plans where property_id = any(v_properties))
    or exists (select 1 from public.recurring_invoice_plans where quote_id = any(v_quotes))
    or exists (select 1 from public.client_portal_applications where approved_client_id = any(v_clients))
    or exists (select 1 from public.client_portal_invitations where client_id = any(v_clients))
    or exists (select 1 from public.client_portal_memberships where client_id = any(v_clients))
    or exists (select 1 from public.client_portal_profile_change_requests where client_id = any(v_clients))
    or exists (select 1 from public.client_portal_property_change_requests where client_id = any(v_clients) or property_id = any(v_properties))
    or exists (select 1 from public.client_portal_legal_acceptances where client_id = any(v_clients))
    or exists (select 1 from public.client_service_requests where client_id = any(v_clients) or property_id = any(v_properties) or approved_job_id = any(v_jobs) or quote_id = any(v_quotes))
    or exists (
      select 1
      from public.client_portal_audit_events as portal_audit
      left join public.client_portal_memberships as portal_membership
        on portal_membership.id = portal_audit.membership_id
      where portal_audit.client_id = any(v_clients)
        or portal_membership.client_id = any(v_clients)
    ) then
    raise exception 'CRM QA cleanup found an untracked protected CRM or portal relation.' using errcode = '23503';
  end if;

  if (select count(*) from public.audit_events
      where id = any(v_audits)
        and (
          entity_id = any(v_entity_ids)
          or position(v_marker in coalesce(metadata::text, '')) > 0
        )) <> cardinality(v_audits) then
    raise exception 'CRM QA cleanup found an unsafe or missing audit event.' using errcode = '42501';
  end if;

  -- Audit rows are children of the exact roots, never an independent sweep.
  if exists (
    select 1 from public.audit_events
    where entity_id = any(v_entity_ids)
      and id <> all(v_audits)
  ) then
    raise exception 'CRM QA cleanup found an untracked audit event.' using errcode = '23503';
  end if;

  select jsonb_build_object(
    'deleted_audit_events', (select count(*) from public.audit_events where id = any(v_audits)),
    'deleted_invoice_document_records', (select count(*) from public.invoice_document_records where invoice_id = any(v_invoices)),
    'deleted_payments', (select count(*) from public.payments where id = any(v_payments)),
    'deleted_invoice_lines', (select count(*) from public.invoice_lines where invoice_id = any(v_invoices)),
    'deleted_invoices', (select count(*) from public.invoices where id = any(v_invoices)),
    'deleted_job_lines', (select count(*) from public.job_lines where job_id = any(v_jobs)),
    'deleted_jobs', (select count(*) from public.jobs where id = any(v_jobs)),
    'deleted_quote_lines', (select count(*) from public.quote_lines where quote_id = any(v_quotes)),
    'deleted_quotes', (select count(*) from public.quotes where id = any(v_quotes)),
    'deleted_properties', (select count(*) from public.properties where id = any(v_properties)),
    'deleted_leads', (select count(*) from public.leads where id = any(v_leads)),
    'deleted_clients', (select count(*) from public.clients where id = any(v_clients))
  ) into v_deleted;

  delete from public.audit_events where id = any(v_audits);
  delete from public.invoice_document_records where invoice_id = any(v_invoices);
  delete from public.payments where id = any(v_payments);
  delete from public.invoice_lines where invoice_id = any(v_invoices);
  delete from public.invoices where id = any(v_invoices);
  delete from public.job_lines where job_id = any(v_jobs);
  delete from public.jobs where id = any(v_jobs);
  delete from public.quote_lines where quote_id = any(v_quotes);
  delete from public.quotes where id = any(v_quotes);
  delete from public.properties where id = any(v_properties);
  delete from public.leads where id = any(v_leads);
  delete from public.clients where id = any(v_clients);

  return v_deleted || jsonb_build_object('marker', v_marker, 'status', 'cleaned');
end;
$$;

revoke all on function public.qa_cleanup_v3_6r_crm_fixture(text[], text[], text[], text[], text[], text[], text[], uuid[]) from public, anon;
grant execute on function public.qa_cleanup_v3_6r_crm_fixture(text[], text[], text[], text[], text[], text[], text[], uuid[]) to authenticated;

commit;
