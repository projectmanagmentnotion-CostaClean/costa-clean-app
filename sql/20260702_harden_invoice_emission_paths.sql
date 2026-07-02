begin;

create or replace function public.build_client_fiscal_snapshot(
  p_client_id text,
  p_source text default 'client_backfill'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_client record;
begin
  if nullif(trim(coalesce(p_client_id, '')), '') is null then
    return null;
  end if;

  select
    id,
    full_name,
    tax_id,
    billing_address,
    email
  into v_client
  from public.clients
  where id = p_client_id;

  if not found then
    return null;
  end if;

  if nullif(trim(coalesce(v_client.full_name, '')), '') is null
    or nullif(trim(coalesce(v_client.tax_id, '')), '') is null
    or nullif(trim(coalesce(v_client.billing_address, '')), '') is null then
    return null;
  end if;

  return jsonb_build_object(
    'client_id', v_client.id,
    'name', v_client.full_name,
    'fiscal_name', v_client.full_name,
    'tax_id', v_client.tax_id,
    'billing_address', v_client.billing_address,
    'email', v_client.email,
    'captured_at', now(),
    'source', p_source
  );
end;
$$;

create or replace function public.ensure_invoice_pricing_metadata(
  p_metadata jsonb,
  p_client_id text,
  p_source text default 'client_backfill'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_metadata jsonb := case
    when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
      then coalesce(p_metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_snapshot jsonb;
begin
  if jsonb_typeof(v_metadata -> 'client_fiscal_snapshot') = 'object' then
    return v_metadata;
  end if;

  v_snapshot := public.build_client_fiscal_snapshot(p_client_id, p_source);

  if v_snapshot is null then
    return v_metadata;
  end if;

  return v_metadata
    || jsonb_build_object(
      'client_fiscal_snapshot', v_snapshot,
      'fiscal_backfilled_at', now(),
      'fiscal_backfill_source', 'client'
    );
end;
$$;

create or replace function public.assert_invoice_numbering_regular(
  p_year integer,
  p_exclude_invoice_id text default null
)
returns void
language plpgsql
stable
as $$
declare
  v_gap_from integer;
  v_gap_to integer;
begin
  if p_year is null then
    return;
  end if;

  with sequences as (
    select distinct public.extract_invoice_fiscal_sequence(invoice_number, p_year) as seq
    from public.invoices
    where id is distinct from p_exclude_invoice_id
      and public.extract_invoice_fiscal_sequence(invoice_number, p_year) is not null
  ),
  ordered as (
    select
      seq,
      lag(seq) over (order by seq) as prev_seq
    from sequences
  )
  select
    prev_seq + 1,
    seq - 1
  into v_gap_from, v_gap_to
  from ordered
  where prev_seq is not null
    and seq - prev_seq > 1
  order by prev_seq
  limit 1;

  if v_gap_from is null then
    return;
  end if;

  raise exception 'No se puede emitir factura. Hay huecos en la numeracion fiscal: %.',
    case
      when v_gap_from = v_gap_to then public.build_invoice_number(p_year, v_gap_from)
      else public.build_invoice_number(p_year, v_gap_from) || ' a ' || public.build_invoice_number(p_year, v_gap_to)
    end;
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
  v_status text := coalesce(nullif(p_invoice ->> 'status', ''), 'draft');
  v_issue_date date := coalesce((p_invoice ->> 'issue_date')::date, current_date);
  v_client_id text := nullif(p_invoice ->> 'client_id', '');
  v_pricing_metadata jsonb := public.ensure_invoice_pricing_metadata(
    p_invoice -> 'pricing_metadata',
    nullif(p_invoice ->> 'client_id', ''),
    'client_backfill'
  );
  v_snapshot jsonb := case
    when jsonb_typeof(v_pricing_metadata -> 'client_fiscal_snapshot') = 'object'
      then v_pricing_metadata -> 'client_fiscal_snapshot'
    else '{}'::jsonb
  end;
begin
  perform public.require_authenticated_financial_write();

  if v_invoice_id is null then
    raise exception 'La factura necesita identificador.';
  end if;

  if v_client_id is null then
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

  if public.invoice_status_consumes_fiscal_number(v_status) then
    perform public.assert_invoice_numbering_regular(extract(year from v_issue_date)::integer, v_invoice_id);

    if nullif(trim(coalesce(v_snapshot ->> 'tax_id', '')), '') is null
      or nullif(trim(coalesce(v_snapshot ->> 'billing_address', '')), '') is null
      or nullif(trim(coalesce(v_snapshot ->> 'fiscal_name', v_snapshot ->> 'name', '')), '') is null then
      raise exception 'No se puede emitir factura sin snapshot fiscal completo del cliente.';
    end if;
  end if;

  insert into public.invoices (
    id, job_id, quote_id, client_id, property_id, issue_date, status, archived_at, deleted_at, cancelled_at, cancel_reason,
    subtotal, tax_amount, total, notes, internal_notes, pricing_metadata, updated_at
  )
  values (
    v_invoice_id,
    nullif(p_invoice ->> 'job_id', ''),
    nullif(p_invoice ->> 'quote_id', ''),
    v_client_id,
    nullif(p_invoice ->> 'property_id', ''),
    v_issue_date,
    v_status,
    (p_invoice ->> 'archived_at')::timestamptz,
    (p_invoice ->> 'deleted_at')::timestamptz,
    (p_invoice ->> 'cancelled_at')::timestamptz,
    nullif(p_invoice ->> 'cancel_reason', ''),
    coalesce((p_invoice ->> 'subtotal')::numeric, 0),
    coalesce((p_invoice ->> 'tax_amount')::numeric, 0),
    coalesce((p_invoice ->> 'total')::numeric, 0),
    nullif(p_invoice ->> 'notes', ''),
    nullif(p_invoice ->> 'internal_notes', ''),
    v_pricing_metadata,
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

    perform public.assert_invoice_numbering_regular(extract(year from p_issue_date)::integer, v_invoice_id);

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
      public.ensure_invoice_pricing_metadata(
        coalesce(v_quote.pricing_metadata, '{}'::jsonb) || jsonb_build_object(
          'source_quote_id', v_quote.id,
          'accepted_invoice_created_at', now()
        ),
        v_client_id,
        'client_backfill'
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

    perform public.refresh_invoice_payment_status(v_invoice_id);
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

  if public.invoice_status_consumes_fiscal_number(v_plan.default_invoice_status) then
    perform public.assert_invoice_numbering_regular(extract(year from p_issue_date)::integer, v_invoice_id);
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
    public.ensure_invoice_pricing_metadata(
      coalesce(v_plan.pricing_metadata, '{}'::jsonb) || jsonb_build_object(
        'recurring_plan_id', v_plan.id,
        'recurring_plan_title', v_plan.title,
        'generated_from_recurring_plan', true
      ),
      v_plan.client_id,
      'client_backfill'
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

grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.accept_quote_workflow(text, boolean, text, date) to authenticated;
grant execute on function public.generate_invoice_from_recurring_plan(text, text, date) to authenticated;

commit;
