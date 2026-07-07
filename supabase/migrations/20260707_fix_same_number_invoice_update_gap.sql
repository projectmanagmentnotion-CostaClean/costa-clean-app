begin;

-- Fix false numbering-gap validation when updating an existing issued invoice
-- that keeps the same fiscal numbering. New invoice creation and any path that
-- consumes a new fiscal number must remain strict and still exclude the current
-- draft/new id from the gap check.

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
  v_issue_year integer := extract(year from v_issue_date)::integer;
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
  v_existing_invoice record;
  v_is_same_number_existing_update boolean := false;
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

  select
    id,
    invoice_number,
    display_code,
    issue_date,
    status
  into v_existing_invoice
  from public.invoices
  where id = v_invoice_id;

  if found and public.invoice_status_consumes_fiscal_number(v_status) then
    -- When editing an already-numbered invoice inside the same fiscal year, keep
    -- the current row inside the continuity check. Excluding its own id turns the
    -- existing sequence value into a fake gap (e.g. 2026-045 appears missing while
    -- the persisted row is precisely the invoice being updated).
    v_is_same_number_existing_update :=
      public.invoice_status_consumes_fiscal_number(v_existing_invoice.status)
      and nullif(trim(coalesce(v_existing_invoice.invoice_number, '')), '') is not null
      and nullif(trim(coalesce(v_existing_invoice.display_code, '')), '') is not null
      and extract(year from coalesce(v_existing_invoice.issue_date, v_issue_date))::integer = v_issue_year
      and public.extract_invoice_fiscal_sequence(v_existing_invoice.invoice_number, v_issue_year) is not null
      and public.extract_invoice_display_sequence(v_existing_invoice.display_code) is not null;
  end if;

  if public.invoice_status_consumes_fiscal_number(v_status) then
    perform public.assert_invoice_numbering_regular(
      v_issue_year,
      case
        when v_is_same_number_existing_update then null
        else v_invoice_id
      end
    );

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

grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to authenticated;

commit;
