alter table public.jobs
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.invoices
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.quotes
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.expenses
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

alter table public.clients
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.properties
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.leads
  add column if not exists deleted_at timestamptz;

update public.properties
set status = 'active'
where status is null;

create or replace function public.save_quote_with_lines(
  p_quote jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id text := nullif(p_quote ->> 'id', '');
  v_client_id text := nullif(p_quote ->> 'client_id', '');
  v_lead_id text := nullif(p_quote ->> 'lead_id', '');
  v_status text := coalesce(nullif(p_quote ->> 'status', ''), 'draft');
begin
  perform public.require_authenticated_financial_write();

  if v_quote_id is null then
    raise exception 'El presupuesto necesita identificador.';
  end if;

  if v_client_id is null and v_lead_id is null then
    raise exception 'El presupuesto necesita cliente o lead.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El presupuesto necesita al menos una linea.';
  end if;

  insert into public.quotes (
    id, client_id, lead_id, property_id, status, archived_at, deleted_at, cancelled_at, cancel_reason,
    subtotal, tax_amount, total, notes, internal_notes, pricing_metadata, updated_at
  )
  values (
    v_quote_id,
    v_client_id,
    v_lead_id,
    nullif(p_quote ->> 'property_id', ''),
    v_status,
    (p_quote ->> 'archived_at')::timestamptz,
    (p_quote ->> 'deleted_at')::timestamptz,
    (p_quote ->> 'cancelled_at')::timestamptz,
    nullif(p_quote ->> 'cancel_reason', ''),
    coalesce((p_quote ->> 'subtotal')::numeric, 0),
    (p_quote ->> 'tax_amount')::numeric,
    coalesce((p_quote ->> 'total')::numeric, 0),
    nullif(p_quote ->> 'notes', ''),
    nullif(p_quote ->> 'internal_notes', ''),
    coalesce(p_quote -> 'pricing_metadata', '{}'::jsonb),
    now()
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    lead_id = excluded.lead_id,
    property_id = excluded.property_id,
    status = excluded.status,
    archived_at = excluded.archived_at,
    deleted_at = excluded.deleted_at,
    cancelled_at = excluded.cancelled_at,
    cancel_reason = excluded.cancel_reason,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes,
    internal_notes = excluded.internal_notes,
    pricing_metadata = excluded.pricing_metadata,
    updated_at = now();

  delete from public.quote_lines where quote_id = v_quote_id;

  insert into public.quote_lines (id, quote_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
  select
    nullif(line.id, ''),
    v_quote_id,
    line.sort_order,
    trim(line.concept),
    line.quantity,
    coalesce(nullif(trim(line.unit), ''), 'servicio'),
    line.unit_price,
    line.line_subtotal
  from jsonb_to_recordset(p_lines) as line(
    id text,
    sort_order integer,
    concept text,
    quantity numeric,
    unit text,
    unit_price numeric,
    line_subtotal numeric
  );
end;
$$;

create or replace function public.save_invoice_with_lines(
  p_invoice jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_id text := nullif(p_invoice ->> 'id', '');
begin
  perform public.require_authenticated_financial_write();

  if v_invoice_id is null then
    raise exception 'La factura necesita identificador.';
  end if;

  if nullif(p_invoice ->> 'client_id', '') is null then
    raise exception 'La factura necesita cliente.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La factura necesita al menos una linea.';
  end if;

  insert into public.invoices (
    id, job_id, quote_id, client_id, property_id, issue_date, status, archived_at, deleted_at, cancelled_at, cancel_reason,
    subtotal, tax_amount, total, notes, internal_notes, pricing_metadata, updated_at
  )
  values (
    v_invoice_id,
    nullif(p_invoice ->> 'job_id', ''),
    nullif(p_invoice ->> 'quote_id', ''),
    nullif(p_invoice ->> 'client_id', ''),
    nullif(p_invoice ->> 'property_id', ''),
    (p_invoice ->> 'issue_date')::date,
    coalesce(nullif(p_invoice ->> 'status', ''), 'draft'),
    (p_invoice ->> 'archived_at')::timestamptz,
    (p_invoice ->> 'deleted_at')::timestamptz,
    (p_invoice ->> 'cancelled_at')::timestamptz,
    nullif(p_invoice ->> 'cancel_reason', ''),
    coalesce((p_invoice ->> 'subtotal')::numeric, 0),
    coalesce((p_invoice ->> 'tax_amount')::numeric, 0),
    coalesce((p_invoice ->> 'total')::numeric, 0),
    nullif(p_invoice ->> 'notes', ''),
    nullif(p_invoice ->> 'internal_notes', ''),
    coalesce(p_invoice -> 'pricing_metadata', '{}'::jsonb),
    now()
  )
  on conflict (id) do update set
    job_id = excluded.job_id,
    quote_id = excluded.quote_id,
    client_id = excluded.client_id,
    property_id = excluded.property_id,
    issue_date = excluded.issue_date,
    status = excluded.status,
    archived_at = excluded.archived_at,
    deleted_at = excluded.deleted_at,
    cancelled_at = excluded.cancelled_at,
    cancel_reason = excluded.cancel_reason,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes,
    internal_notes = excluded.internal_notes,
    pricing_metadata = excluded.pricing_metadata,
    updated_at = now();

  delete from public.invoice_lines where invoice_id = v_invoice_id;

  insert into public.invoice_lines (id, invoice_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
  select
    nullif(line.id, ''),
    v_invoice_id,
    line.sort_order,
    trim(line.concept),
    line.quantity,
    coalesce(nullif(trim(line.unit), ''), 'servicio'),
    line.unit_price,
    line.line_subtotal
  from jsonb_to_recordset(p_lines) as line(
    id text,
    sort_order integer,
    concept text,
    quantity numeric,
    unit text,
    unit_price numeric,
    line_subtotal numeric
  );

  perform public.refresh_invoice_payment_status(v_invoice_id);
end;
$$;

create or replace function public.save_job_with_lines(
  p_job jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id text := nullif(p_job ->> 'id', '');
begin
  perform public.require_authenticated_financial_write();

  if v_job_id is null then
    raise exception 'El servicio necesita identificador.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El servicio necesita al menos una linea.';
  end if;

  insert into public.jobs (
    id, client_id, property_id, quote_id, scheduled_date, status, archived_at, deleted_at, cancelled_at, cancel_reason,
    service_type, billing_concept, billing_quantity, billing_unit, billing_unit_price, notes, updated_at
  )
  values (
    v_job_id,
    nullif(p_job ->> 'client_id', ''),
    nullif(p_job ->> 'property_id', ''),
    nullif(p_job ->> 'quote_id', ''),
    (p_job ->> 'scheduled_date')::date,
    coalesce(nullif(p_job ->> 'status', ''), 'scheduled'),
    (p_job ->> 'archived_at')::timestamptz,
    (p_job ->> 'deleted_at')::timestamptz,
    (p_job ->> 'cancelled_at')::timestamptz,
    nullif(p_job ->> 'cancel_reason', ''),
    coalesce(nullif(p_job ->> 'service_type', ''), 'standard_cleaning'),
    nullif(p_job ->> 'billing_concept', ''),
    coalesce((p_job ->> 'billing_quantity')::numeric, 1),
    coalesce(nullif(trim(p_job ->> 'billing_unit'), ''), 'servicio'),
    (p_job ->> 'billing_unit_price')::numeric,
    nullif(p_job ->> 'notes', ''),
    now()
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    property_id = excluded.property_id,
    quote_id = excluded.quote_id,
    scheduled_date = excluded.scheduled_date,
    status = excluded.status,
    archived_at = excluded.archived_at,
    deleted_at = excluded.deleted_at,
    cancelled_at = excluded.cancelled_at,
    cancel_reason = excluded.cancel_reason,
    service_type = excluded.service_type,
    billing_concept = excluded.billing_concept,
    billing_quantity = excluded.billing_quantity,
    billing_unit = excluded.billing_unit,
    billing_unit_price = excluded.billing_unit_price,
    notes = excluded.notes,
    updated_at = now();

  delete from public.job_lines where job_id = v_job_id;

  insert into public.job_lines (id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
  select
    nullif(line.id, ''),
    v_job_id,
    line.sort_order,
    trim(line.concept),
    line.quantity,
    coalesce(nullif(trim(line.unit), ''), 'servicio'),
    line.unit_price,
    line.line_subtotal
  from jsonb_to_recordset(p_lines) as line(
    id text,
    sort_order integer,
    concept text,
    quantity numeric,
    unit text,
    unit_price numeric,
    line_subtotal numeric
  );
end;
$$;
