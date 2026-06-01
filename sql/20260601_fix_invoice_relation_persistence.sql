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
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.unit_price < 0
      or line.line_subtotal is null
      or line.line_subtotal < 0
  ) then
    raise exception 'Las lineas de la factura contienen importes no validos.';
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
    notes
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
    nullif(p_invoice ->> 'notes', '')
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

grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to authenticated;
