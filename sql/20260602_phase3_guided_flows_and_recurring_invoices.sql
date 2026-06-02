alter table public.invoices
  add column if not exists property_id text references public.properties(id) on delete set null;

create table if not exists public.recurring_invoice_plans (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  property_id text references public.properties(id) on delete set null,
  quote_id text references public.quotes(id) on delete set null,
  title text not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  default_invoice_status text not null default 'draft' check (default_invoice_status in ('draft', 'issued')),
  next_issue_date date not null,
  last_issued_at timestamptz,
  tax_rate numeric(6,4) not null default 0.21,
  notes text,
  internal_notes text,
  pricing_metadata jsonb not null default '{}'::jsonb,
  template_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(
      concept text,
      quantity numeric,
      unit_price numeric,
      line_subtotal numeric
    )
    where nullif(trim(coalesce(line.concept, '')), '') is null
      or length(trim(line.concept)) > 120
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.line_subtotal is null
  ) then
    raise exception 'Las lineas de la factura contienen conceptos o importes no validos.';
  end if;

  insert into public.invoices (
    id,
    job_id,
    quote_id,
    client_id,
    property_id,
    issue_date,
    status,
    subtotal,
    tax_amount,
    total,
    notes,
    internal_notes,
    pricing_metadata
  )
  values (
    v_invoice_id,
    nullif(p_invoice ->> 'job_id', ''),
    nullif(p_invoice ->> 'quote_id', ''),
    nullif(p_invoice ->> 'client_id', ''),
    nullif(p_invoice ->> 'property_id', ''),
    (p_invoice ->> 'issue_date')::date,
    coalesce(nullif(p_invoice ->> 'status', ''), 'draft'),
    coalesce((p_invoice ->> 'subtotal')::numeric, 0),
    coalesce((p_invoice ->> 'tax_amount')::numeric, 0),
    coalesce((p_invoice ->> 'total')::numeric, 0),
    nullif(p_invoice ->> 'notes', ''),
    nullif(p_invoice ->> 'internal_notes', ''),
    coalesce(p_invoice -> 'pricing_metadata', '{}'::jsonb)
  )
  on conflict (id) do update set
    job_id = excluded.job_id,
    quote_id = excluded.quote_id,
    client_id = excluded.client_id,
    property_id = excluded.property_id,
    issue_date = excluded.issue_date,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes,
    internal_notes = excluded.internal_notes,
    pricing_metadata = excluded.pricing_metadata;

  delete from public.invoice_lines
  where invoice_id = v_invoice_id;

  insert into public.invoice_lines (
    id,
    invoice_id,
    sort_order,
    concept,
    quantity,
    unit,
    unit_price,
    line_subtotal
  )
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

create or replace function public.save_client_recurring_invoice_plan(
  p_plan jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id text := nullif(p_plan ->> 'id', '');
  v_client_id text := nullif(p_plan ->> 'client_id', '');
  v_title text := nullif(trim(coalesce(p_plan ->> 'title', '')), '');
  v_frequency text := coalesce(nullif(p_plan ->> 'frequency', ''), 'monthly');
  v_status text := coalesce(nullif(p_plan ->> 'status', ''), 'active');
  v_default_invoice_status text := coalesce(nullif(p_plan ->> 'default_invoice_status', ''), 'draft');
  v_next_issue_date date := (p_plan ->> 'next_issue_date')::date;
  v_tax_rate numeric := coalesce((p_plan ->> 'tax_rate')::numeric, 0.21);
  v_template_lines jsonb := coalesce(p_plan -> 'template_lines', '[]'::jsonb);
begin
  perform public.require_authenticated_financial_write();

  if v_plan_id is null then
    raise exception 'La automatizacion recurrente necesita identificador.';
  end if;

  if v_client_id is null then
    raise exception 'La automatizacion recurrente necesita cliente.';
  end if;

  if v_title is null then
    raise exception 'La automatizacion recurrente necesita un titulo.';
  end if;

  if v_frequency not in ('weekly', 'biweekly', 'monthly', 'quarterly') then
    raise exception 'La frecuencia indicada no es valida.';
  end if;

  if v_status not in ('active', 'paused', 'archived') then
    raise exception 'El estado de la automatizacion no es valido.';
  end if;

  if v_default_invoice_status not in ('draft', 'issued') then
    raise exception 'El estado por defecto de factura no es valido.';
  end if;

  if v_next_issue_date is null then
    raise exception 'Debes indicar la proxima fecha de emision.';
  end if;

  if v_tax_rate < 0 then
    raise exception 'El tipo de IVA no puede ser negativo.';
  end if;

  if jsonb_typeof(v_template_lines) <> 'array' or jsonb_array_length(v_template_lines) = 0 then
    raise exception 'La automatizacion recurrente necesita al menos una linea.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_template_lines) as line(
      concept text,
      quantity numeric,
      unit text,
      unit_price numeric,
      line_subtotal numeric
    )
    where nullif(trim(coalesce(line.concept, '')), '') is null
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.unit_price < 0
      or line.line_subtotal is null
      or line.line_subtotal < 0
  ) then
    raise exception 'Las lineas de la automatizacion contienen importes no validos.';
  end if;

  insert into public.recurring_invoice_plans (
    id,
    client_id,
    property_id,
    quote_id,
    title,
    frequency,
    status,
    default_invoice_status,
    next_issue_date,
    last_issued_at,
    tax_rate,
    notes,
    internal_notes,
    pricing_metadata,
    template_lines,
    updated_at
  )
  values (
    v_plan_id,
    v_client_id,
    nullif(p_plan ->> 'property_id', ''),
    nullif(p_plan ->> 'quote_id', ''),
    v_title,
    v_frequency,
    v_status,
    v_default_invoice_status,
    v_next_issue_date,
    case
      when nullif(p_plan ->> 'last_issued_at', '') is null then null
      else (p_plan ->> 'last_issued_at')::timestamptz
    end,
    v_tax_rate,
    nullif(p_plan ->> 'notes', ''),
    nullif(p_plan ->> 'internal_notes', ''),
    coalesce(p_plan -> 'pricing_metadata', '{}'::jsonb),
    v_template_lines,
    now()
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    property_id = excluded.property_id,
    quote_id = excluded.quote_id,
    title = excluded.title,
    frequency = excluded.frequency,
    status = excluded.status,
    default_invoice_status = excluded.default_invoice_status,
    next_issue_date = excluded.next_issue_date,
    last_issued_at = excluded.last_issued_at,
    tax_rate = excluded.tax_rate,
    notes = excluded.notes,
    internal_notes = excluded.internal_notes,
    pricing_metadata = excluded.pricing_metadata,
    template_lines = excluded.template_lines,
    updated_at = now();
end;
$$;

create or replace function public.generate_invoice_from_recurring_plan(
  p_plan_id text,
  p_invoice_id text default null,
  p_issue_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.recurring_invoice_plans%rowtype;
  v_invoice_id text := coalesce(nullif(p_invoice_id, ''), 'INVOICE-' || gen_random_uuid()::text);
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_total numeric := 0;
  v_next_issue_date date := p_issue_date;
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_plan_id, '') is null then
    raise exception 'La automatizacion recurrente necesita identificador.';
  end if;

  select *
  into v_plan
  from public.recurring_invoice_plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception 'No se encontro la automatizacion recurrente indicada.';
  end if;

  if v_plan.status <> 'active' then
    raise exception 'Solo se pueden emitir facturas desde automatizaciones activas.';
  end if;

  select coalesce(sum((line ->> 'line_subtotal')::numeric), 0)
  into v_subtotal
  from jsonb_array_elements(v_plan.template_lines) as line;

  v_tax_amount := round(v_subtotal * coalesce(v_plan.tax_rate, 0.21), 2);
  v_total := round(v_subtotal + v_tax_amount, 2);

  insert into public.invoices (
    id,
    job_id,
    quote_id,
    client_id,
    property_id,
    issue_date,
    status,
    subtotal,
    tax_amount,
    total,
    notes,
    internal_notes,
    pricing_metadata
  )
  values (
    v_invoice_id,
    null,
    v_plan.quote_id,
    v_plan.client_id,
    v_plan.property_id,
    p_issue_date,
    v_plan.default_invoice_status,
    v_subtotal,
    v_tax_amount,
    v_total,
    nullif(v_plan.notes, ''),
    concat_ws(E'\n\n',
      'Factura generada desde automatizacion recurrente.',
      nullif(v_plan.internal_notes, '')
    ),
    coalesce(v_plan.pricing_metadata, '{}'::jsonb) || jsonb_build_object(
      'recurring_plan_id', v_plan.id,
      'recurring_plan_title', v_plan.title,
      'generated_from_recurring_plan', true
    )
  );

  insert into public.invoice_lines (
    id,
    invoice_id,
    sort_order,
    concept,
    quantity,
    unit,
    unit_price,
    line_subtotal
  )
  select
    'INVOICE-LINE-' || gen_random_uuid()::text,
    v_invoice_id,
    row_number() over (),
    trim(coalesce(line ->> 'concept', '')),
    (line ->> 'quantity')::numeric,
    coalesce(nullif(trim(coalesce(line ->> 'unit', '')), ''), 'servicio'),
    (line ->> 'unit_price')::numeric,
    (line ->> 'line_subtotal')::numeric
  from jsonb_array_elements(v_plan.template_lines) as line;

  if v_plan.frequency = 'weekly' then
    v_next_issue_date := p_issue_date + 7;
  elsif v_plan.frequency = 'biweekly' then
    v_next_issue_date := p_issue_date + 14;
  elsif v_plan.frequency = 'monthly' then
    v_next_issue_date := (p_issue_date + interval '1 month')::date;
  else
    v_next_issue_date := (p_issue_date + interval '3 month')::date;
  end if;

  update public.recurring_invoice_plans
  set
    last_issued_at = now(),
    next_issue_date = v_next_issue_date,
    updated_at = now()
  where id = v_plan.id;

  perform public.refresh_invoice_payment_status(v_invoice_id);

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'plan_id', v_plan.id,
    'next_issue_date', v_next_issue_date
  );
end;
$$;

grant execute on function public.save_client_recurring_invoice_plan(jsonb) to authenticated;
grant execute on function public.generate_invoice_from_recurring_plan(text, text, date) to authenticated;
