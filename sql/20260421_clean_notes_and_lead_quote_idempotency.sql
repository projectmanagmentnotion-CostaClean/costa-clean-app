-- Clean note layers and enforce safe replacement of lead-owned draft quotes.

alter table public.quotes
  add column if not exists internal_notes text,
  add column if not exists pricing_metadata jsonb not null default '{}'::jsonb;

alter table public.invoices
  add column if not exists internal_notes text,
  add column if not exists pricing_metadata jsonb not null default '{}'::jsonb;

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

  if v_lead_id is not null and v_status in ('draft', 'sent') and exists (
    select 1
    from public.quotes
    where lead_id = v_lead_id
      and id <> v_quote_id
      and status in ('draft', 'sent')
  ) then
    raise exception 'Este lead ya tiene un presupuesto borrador o pendiente. Actualiza ese presupuesto en lugar de crear un duplicado.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El presupuesto necesita al menos una linea.';
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
    raise exception 'Las lineas del presupuesto contienen conceptos o importes no validos.';
  end if;

  insert into public.quotes (
    id,
    client_id,
    lead_id,
    property_id,
    status,
    subtotal,
    tax_amount,
    total,
    notes,
    internal_notes,
    pricing_metadata
  )
  values (
    v_quote_id,
    v_client_id,
    v_lead_id,
    nullif(p_quote ->> 'property_id', ''),
    v_status,
    coalesce((p_quote ->> 'subtotal')::numeric, 0),
    (p_quote ->> 'tax_amount')::numeric,
    coalesce((p_quote ->> 'total')::numeric, 0),
    nullif(p_quote ->> 'notes', ''),
    nullif(p_quote ->> 'internal_notes', ''),
    coalesce(p_quote -> 'pricing_metadata', '{}'::jsonb)
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    lead_id = excluded.lead_id,
    property_id = excluded.property_id,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes,
    internal_notes = excluded.internal_notes,
    pricing_metadata = excluded.pricing_metadata;

  delete from public.quote_lines
  where quote_id = v_quote_id;

  insert into public.quote_lines (
    id,
    quote_id,
    sort_order,
    concept,
    quantity,
    unit,
    unit_price,
    line_subtotal
  )
  select
    nullif(line.id, ''),
    v_quote_id,
    line.sort_order,
    public.simplify_billing_concept(line.concept),
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
    public.simplify_billing_concept(line.concept),
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

create or replace function public.accept_quote_workflow(
  p_quote_id text,
  p_create_invoice boolean default false,
  p_invoice_id text default null,
  p_issue_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote record;
  v_conversion jsonb;
  v_client_id text;
  v_invoice_id text := null;
begin
  perform public.require_authenticated_financial_write();

  select id, display_code, client_id, lead_id, subtotal, tax_amount, total, internal_notes, pricing_metadata, status
  into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'No se encontro el presupuesto indicado.';
  end if;

  if v_quote.client_id is null then
    if v_quote.lead_id is null then
      raise exception 'El presupuesto no tiene cliente ni lead para aceptar.';
    end if;

    v_conversion := public.convert_lead_to_client(v_quote.lead_id, null);
    v_client_id := v_conversion ->> 'client_id';
  else
    v_client_id := v_quote.client_id;

    if v_quote.lead_id is not null then
      v_conversion := public.convert_lead_to_client(v_quote.lead_id, v_client_id);
    else
      v_conversion := jsonb_build_object(
        'client_id', v_client_id,
        'lead_id', null,
        'client_action', 'already_client_quote'
      );
    end if;
  end if;

  update public.quotes
  set status = 'accepted',
      client_id = v_client_id
  where id = v_quote.id;

  if p_create_invoice then
    v_invoice_id := coalesce(nullif(p_invoice_id, ''), 'INVOICE-' || gen_random_uuid()::text);

    if exists (
      select 1 from public.invoices where quote_id = v_quote.id and status <> 'cancelled'
    ) then
      raise exception 'Este presupuesto ya tiene una factura activa vinculada.';
    end if;

    insert into public.invoices (
      id,
      job_id,
      quote_id,
      client_id,
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
      (
        select id
        from public.jobs
        where quote_id = v_quote.id
        order by created_at desc
        limit 1
      ),
      v_quote.id,
      v_client_id,
      p_issue_date,
      'issued',
      v_quote.subtotal,
      coalesce(v_quote.tax_amount, 0),
      v_quote.total,
      'Servicio realizado segun presupuesto aprobado.' || E'\n' ||
      'Condiciones economicas aplicadas segun presupuesto aceptado.' || E'\n' ||
      'Precios sin IVA.',
      concat_ws(E'\n\n',
        'Factura creada automaticamente desde presupuesto aceptado.',
        nullif(v_quote.internal_notes, '')
      ),
      coalesce(v_quote.pricing_metadata, '{}'::jsonb) || jsonb_build_object(
        'source_quote_id', v_quote.id,
        'accepted_invoice_created_at', now()
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
      sort_order,
      public.simplify_billing_concept(concept),
      quantity,
      unit,
      unit_price,
      line_subtotal
    from public.quote_lines
    where quote_id = v_quote.id
    order by sort_order;

    if not found then
      raise exception 'El presupuesto necesita lineas para crear factura.';
    end if;
  end if;

  return jsonb_build_object(
    'quote_id', v_quote.id,
    'lead_id', v_quote.lead_id,
    'client_id', v_client_id,
    'invoice_id', v_invoice_id,
    'created_invoice', p_create_invoice,
    'client_action', v_conversion ->> 'client_action'
  );
end;
$$;
