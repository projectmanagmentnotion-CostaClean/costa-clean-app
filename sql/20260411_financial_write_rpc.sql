-- Safer financial writes for quotes, invoices, and payments.
-- These RPCs keep header/line/payment/status updates atomic on the database side.

create or replace function public.save_quote_with_lines(
  p_quote jsonb,
  p_lines jsonb
)
returns void
language plpgsql
as $$
declare
  v_quote_id text := nullif(p_quote ->> 'id', '');
begin
  if v_quote_id is null then
    raise exception 'El presupuesto necesita identificador.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El presupuesto necesita al menos una línea.';
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
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.unit_price < 0
      or line.line_subtotal is null
      or line.line_subtotal < 0
  ) then
    raise exception 'Las líneas del presupuesto contienen importes no válidos.';
  end if;

  insert into public.quotes (
    id,
    client_id,
    property_id,
    status,
    subtotal,
    tax_amount,
    total,
    notes
  )
  values (
    v_quote_id,
    nullif(p_quote ->> 'client_id', ''),
    nullif(p_quote ->> 'property_id', ''),
    coalesce(nullif(p_quote ->> 'status', ''), 'draft'),
    coalesce((p_quote ->> 'subtotal')::numeric, 0),
    (p_quote ->> 'tax_amount')::numeric,
    coalesce((p_quote ->> 'total')::numeric, 0),
    nullif(p_quote ->> 'notes', '')
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    property_id = excluded.property_id,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes;

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

create or replace function public.refresh_invoice_payment_status(
  p_invoice_id text
)
returns void
language plpgsql
as $$
declare
  v_total numeric;
  v_status text;
  v_paid numeric;
begin
  select total, status
  into v_total, v_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found or v_status = 'cancelled' then
    return;
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  if coalesce(v_total, 0) > 0 and v_paid >= v_total then
    update public.invoices
    set status = 'paid'
    where id = p_invoice_id
      and status <> 'paid';
  elsif v_status = 'paid' and v_paid < coalesce(v_total, 0) then
    update public.invoices
    set status = 'issued'
    where id = p_invoice_id;
  end if;
end;
$$;

create or replace function public.save_invoice_with_lines(
  p_invoice jsonb,
  p_lines jsonb
)
returns void
language plpgsql
as $$
declare
  v_invoice_id text := nullif(p_invoice ->> 'id', '');
begin
  if v_invoice_id is null then
    raise exception 'La factura necesita identificador.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La factura necesita al menos una línea.';
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
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.unit_price < 0
      or line.line_subtotal is null
      or line.line_subtotal < 0
  ) then
    raise exception 'Las líneas de la factura contienen importes no válidos.';
  end if;

  insert into public.invoices (
    id,
    job_id,
    client_id,
    issue_date,
    status,
    subtotal,
    tax_amount,
    total,
    notes
  )
  values (
    v_invoice_id,
    nullif(p_invoice ->> 'job_id', ''),
    nullif(p_invoice ->> 'client_id', ''),
    (p_invoice ->> 'issue_date')::date,
    coalesce(nullif(p_invoice ->> 'status', ''), 'draft'),
    coalesce((p_invoice ->> 'subtotal')::numeric, 0),
    coalesce((p_invoice ->> 'tax_amount')::numeric, 0),
    coalesce((p_invoice ->> 'total')::numeric, 0),
    nullif(p_invoice ->> 'notes', '')
  )
  on conflict (id) do update set
    job_id = excluded.job_id,
    client_id = excluded.client_id,
    issue_date = excluded.issue_date,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes;

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

end;
$$;

create or replace function public.save_payment_and_refresh_invoice(
  p_payment jsonb
)
returns void
language plpgsql
as $$
declare
  v_payment_id text := nullif(p_payment ->> 'id', '');
  v_invoice_id text := nullif(p_payment ->> 'invoice_id', '');
  v_previous_invoice_id text;
  v_amount numeric := (p_payment ->> 'amount')::numeric;
begin
  if v_payment_id is null then
    raise exception 'El pago necesita identificador.';
  end if;

  if v_invoice_id is null then
    raise exception 'El pago necesita una factura vinculada.';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'El importe del pago debe ser mayor que cero.';
  end if;

  select invoice_id
  into v_previous_invoice_id
  from public.payments
  where id = v_payment_id
  for update;

  insert into public.payments (
    id,
    invoice_id,
    payment_date,
    amount,
    payment_method,
    notes
  )
  values (
    v_payment_id,
    v_invoice_id,
    (p_payment ->> 'payment_date')::date,
    v_amount,
    nullif(p_payment ->> 'payment_method', ''),
    nullif(p_payment ->> 'notes', '')
  )
  on conflict (id) do update set
    invoice_id = excluded.invoice_id,
    payment_date = excluded.payment_date,
    amount = excluded.amount,
    payment_method = excluded.payment_method,
    notes = excluded.notes;

  if v_previous_invoice_id is not null and v_previous_invoice_id <> v_invoice_id then
    perform public.refresh_invoice_payment_status(v_previous_invoice_id);
  end if;

  perform public.refresh_invoice_payment_status(v_invoice_id);
end;
$$;

grant execute on function public.save_quote_with_lines(jsonb, jsonb) to anon, authenticated;
grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to anon, authenticated;
grant execute on function public.refresh_invoice_payment_status(text) to anon, authenticated;
grant execute on function public.save_payment_and_refresh_invoice(jsonb) to anon, authenticated;
