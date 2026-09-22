-- QA-only test support. This is never part of a Production migration path.
-- Functions are additionally issuer- and owner/admin-gated at runtime.

create or replace function public.qa_n2_concurrency_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_mapping_hash text;
  v_real_rows_hash text;
  v_sequence_last_value bigint;
  v_sequence_is_called boolean;
  v_settlement_definition text;
  v_n2_clients bigint;
  v_n2_properties bigint;
  v_n2_jobs bigint;
  v_n2_invoices bigint;
  v_n2_payments bigint;
begin
  v_user_id := app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2 concurrency snapshot is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = v_user_id
      and m.role in ('owner', 'admin')
      and m.status = 'active'
      and m.revoked_at is null
  ) then
    raise exception 'N2 concurrency snapshot requires an active internal administrator.' using errcode = '42501';
  end if;

  select pg_catalog.md5(coalesce(pg_catalog.string_agg(
    pg_catalog.jsonb_build_array(i.id, i.invoice_number, i.display_code, i.issue_date::text, i.status)::text,
    pg_catalog.chr(10) order by i.id
  ), ''))
  into v_mapping_hash
  from public.invoices i;

  select last_value, is_called
  into v_sequence_last_value, v_sequence_is_called
  from public.invoices_invoice_number_seq;

  select pg_catalog.lower(pg_catalog.pg_get_functiondef('public.settle_invoice_by_transfer(text)'::regprocedure))
  into v_settlement_definition;
  if v_settlement_definition not like '%for update%' then
    raise exception 'Canonical settlement no longer exposes its invoice row serialization lock.' using errcode = '55000';
  end if;

  select pg_catalog.md5(
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(c)::text, pg_catalog.chr(10) order by c.id)
      from public.clients c
      where pg_catalog.left(c.id, 6) <> 'QA_N2_'
        and not (pg_catalog.left(c.full_name, 13) = 'QA_N2_CLIENT_' and c.email like 'qa_n2+%@qa.invalid')), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(p)::text, pg_catalog.chr(10) order by p.id)
      from public.properties p where pg_catalog.left(p.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(q)::text, pg_catalog.chr(10) order by q.id)
      from public.quotes q where pg_catalog.left(q.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(l)::text, pg_catalog.chr(10) order by l.id)
      from public.quote_lines l where pg_catalog.left(l.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(j)::text, pg_catalog.chr(10) order by j.id)
      from public.jobs j where pg_catalog.left(j.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(l)::text, pg_catalog.chr(10) order by l.id)
      from public.job_lines l where pg_catalog.left(l.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(i)::text, pg_catalog.chr(10) order by i.id)
      from public.invoices i where pg_catalog.left(i.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(l)::text, pg_catalog.chr(10) order by l.id)
      from public.invoice_lines l where pg_catalog.left(l.id, 6) <> 'QA_N2_'), '')
    || pg_catalog.chr(30) ||
    coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(p)::text, pg_catalog.chr(10) order by p.id)
      from public.payments p
      where not exists (
        select 1 from public.invoices i
        where i.id = p.invoice_id and pg_catalog.left(i.id, 6) = 'QA_N2_'
      )), '')
  ) into v_real_rows_hash;

  select count(*) into v_n2_clients
  from public.clients c
  where pg_catalog.left(c.id, 6) = 'QA_N2_'
     or (pg_catalog.left(c.full_name, 13) = 'QA_N2_CLIENT_' and c.email like 'qa_n2+%@qa.invalid');
  select count(*) into v_n2_properties
  from public.properties p
  where pg_catalog.left(p.id, 6) = 'QA_N2_'
     or exists (select 1 from public.clients c where c.id = p.client_id and pg_catalog.left(c.id, 6) = 'QA_N2_');
  select count(*) into v_n2_jobs
  from public.jobs j
  where pg_catalog.left(j.id, 6) = 'QA_N2_'
     or exists (select 1 from public.clients c where c.id = j.client_id and pg_catalog.left(c.id, 6) = 'QA_N2_');
  select count(*) into v_n2_invoices
  from public.invoices i
  where pg_catalog.left(i.id, 6) = 'QA_N2_'
     or exists (select 1 from public.clients c where c.id = i.client_id and pg_catalog.left(c.id, 6) = 'QA_N2_');
  select count(*) into v_n2_payments
  from public.payments p
  where pg_catalog.left(p.id, 6) = 'QA_N2_'
     or exists (select 1 from public.invoices i where i.id = p.invoice_id and pg_catalog.left(i.id, 6) = 'QA_N2_');

  return pg_catalog.jsonb_build_object(
    'fiscal_mapping_hash', v_mapping_hash,
    'real_qa_business_rows_hash', v_real_rows_hash,
    'sequence_last_value', v_sequence_last_value,
    'sequence_is_called', v_sequence_is_called,
    'settlement_serialization_primitive', 'SELECT FOR UPDATE',
    'invoice_count', (select count(*) from public.invoices),
    'payment_count', (select count(*) from public.payments),
    'qa_n2_clients', v_n2_clients,
    'qa_n2_properties', v_n2_properties,
    'qa_n2_jobs', v_n2_jobs,
    'qa_n2_invoices', v_n2_invoices,
    'qa_n2_payments', v_n2_payments
  );
end;
$function$;

create or replace function public.qa_n2_create_concurrency_invoice(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_client_id text;
  v_property_id text;
  v_job_id text;
  v_invoice_id text;
  v_placeholder text;
  v_invoice public.invoices%rowtype;
begin
  v_user_id := app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2 invoice fixture helper is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = v_user_id
      and m.role in ('owner', 'admin')
      and m.status = 'active'
      and m.revoked_at is null
  ) then
    raise exception 'N2 invoice fixture helper requires an active internal administrator.' using errcode = '42501';
  end if;
  if p_run_id is null or p_run_id !~ '^[0-9a-f]{32}$' then
    raise exception 'Invalid N2 concurrency run id.' using errcode = '22023';
  end if;

  v_client_id := 'QA_N2_CLIENT_' || p_run_id || '_CONC';
  v_property_id := 'QA_N2_PROPERTY_' || p_run_id || '_CONC';
  v_job_id := 'QA_N2_JOB_' || p_run_id || '_CONC';
  v_invoice_id := 'QA_N2_INVOICE_' || p_run_id || '_CONC';
  v_placeholder := '__QA_N2_PLACEHOLDER_' || p_run_id || '__';

  if not exists (
    select 1 from public.clients c
    where c.id = v_client_id
      and c.full_name = v_client_id
      and c.email = 'qa_n2+' || p_run_id || '@qa.invalid'
  ) or not exists (
    select 1 from public.properties p
    where p.id = v_property_id and p.client_id = v_client_id
      and p.notes = 'QA_N2_CONC_' || p_run_id || '|source=n2_concurrency_certification'
  ) or not exists (
    select 1 from public.jobs j
    where j.id = v_job_id and j.client_id = v_client_id and j.property_id = v_property_id
      and j.notes = 'QA_N2_CONC_' || p_run_id || '|source=n2_concurrency_certification'
  ) then
    raise exception 'N2 invoice fixture helper requires the exact synthetic client/property/job graph.' using errcode = '42501';
  end if;
  if exists (select 1 from public.invoices i where i.id = v_invoice_id) then
    raise exception 'N2 concurrency invoice fixture already exists.' using errcode = '23505';
  end if;

  insert into public.invoices (
    id, job_id, client_id, property_id, invoice_number, display_code,
    issue_date, status, subtotal, tax_amount, total, notes, pricing_metadata
  ) values (
    v_invoice_id, v_job_id, v_client_id, v_property_id, v_placeholder, v_placeholder,
    current_date, 'draft', 100.00, 0.00, 100.00,
    'QA_N2_CONC_' || p_run_id || '|source=n2_concurrency_certification',
    pg_catalog.jsonb_build_object('source', 'n2_concurrency_certification', 'run_id', p_run_id)
  ) returning * into v_invoice;

  return pg_catalog.jsonb_build_object(
    'invoice_id', v_invoice.id,
    'status', v_invoice.status,
    'invoice_number', v_invoice.invoice_number,
    'display_code', v_invoice.display_code,
    'draft_nonfiscal', v_invoice.status = 'draft'
      and v_invoice.invoice_number is null
      and v_invoice.display_code is null
  );
end;
$function$;

alter function public.qa_n2_concurrency_snapshot() owner to postgres;
alter function public.qa_n2_create_concurrency_invoice(text) owner to postgres;
revoke all on function public.qa_n2_concurrency_snapshot() from public, anon, authenticated;
revoke all on function public.qa_n2_create_concurrency_invoice(text) from public, anon, authenticated;
grant execute on function public.qa_n2_concurrency_snapshot() to authenticated;
grant execute on function public.qa_n2_create_concurrency_invoice(text) to authenticated;
comment on function public.qa_n2_concurrency_snapshot() is
  'Read-only QA-only snapshot for N2 settlement concurrency certification; requires canonical QA Auth and an active internal admin.';
comment on function public.qa_n2_create_concurrency_invoice(text) is
  'Creates only one fixed-value QA_N2 draft invoice for N2 concurrency certification; requires canonical QA Auth and an exact synthetic graph.';
