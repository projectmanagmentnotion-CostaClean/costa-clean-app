begin;

create or replace function public.find_first_missing_invoice_sequence(
  p_year integer,
  p_exclude_invoice_id text default null
)
returns integer
language sql
stable
as $$
  with sequences as (
    select distinct public.extract_invoice_fiscal_sequence(invoice_number, p_year) as seq
    from public.invoices
    where id is distinct from p_exclude_invoice_id
      and public.extract_invoice_fiscal_sequence(invoice_number, p_year) is not null
  ),
  max_sequence as (
    select coalesce(max(seq), 0) + 1 as upper_bound
    from sequences
  ),
  candidates as (
    select generate_series(1, (select upper_bound from max_sequence)) as seq
  )
  select coalesce(
    (
      select min(candidates.seq)
      from candidates
      left join sequences on sequences.seq = candidates.seq
      where sequences.seq is null
    ),
    1
  );
$$;

create or replace function public.sync_invoice_numbering()
returns trigger
language plpgsql
as $$
declare
  v_year integer;
  v_sequence integer;
  v_manual_override boolean := coalesce(current_setting('app.invoice_number_override', true), 'false') = 'true';
  v_new_consumes boolean := public.invoice_status_consumes_fiscal_number(new.status);
  v_old_consumes boolean := case
    when tg_op = 'UPDATE' then public.invoice_status_consumes_fiscal_number(old.status)
    else false
  end;
  v_display_sequence integer;
begin
  v_year := extract(year from coalesce(new.issue_date, current_date))::integer;

  if tg_op = 'INSERT' then
    if not v_new_consumes then
      new.invoice_number := null;
      new.display_code := null;
      return new;
    end if;

    perform pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text));

    select public.find_first_missing_invoice_sequence(v_year, new.id)
    into v_sequence;

    new.invoice_number := public.build_invoice_number(v_year, v_sequence);
    new.display_code := public.build_invoice_display_code(v_sequence);
    return new;
  end if;

  if not v_new_consumes then
    if v_old_consumes then
      new.invoice_number := old.invoice_number;
      new.display_code := old.display_code;
    else
      new.invoice_number := null;
      new.display_code := null;
    end if;
    return new;
  end if;

  if not v_old_consumes then
    perform pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text));

    select public.find_first_missing_invoice_sequence(v_year, new.id)
    into v_sequence;

    new.invoice_number := public.build_invoice_number(v_year, v_sequence);
    new.display_code := public.build_invoice_display_code(v_sequence);
    return new;
  end if;

  if v_manual_override then
    if nullif(new.invoice_number, '') is not null then
      v_sequence := public.extract_invoice_fiscal_sequence(new.invoice_number, v_year);

      if v_sequence is null then
        raise exception 'El numero fiscal no coincide con el ejercicio %.', v_year;
      end if;
    elsif nullif(new.display_code, '') is not null then
      v_sequence := public.extract_invoice_display_sequence(new.display_code);

      if v_sequence is null then
        raise exception 'El codigo interno de factura no tiene formato valido.';
      end if;
    else
      new.invoice_number := old.invoice_number;
      new.display_code := old.display_code;
      return new;
    end if;

    if nullif(new.display_code, '') is not null then
      v_display_sequence := public.extract_invoice_display_sequence(new.display_code);
      if v_display_sequence is null or v_display_sequence <> v_sequence then
        raise exception 'El codigo interno no coincide con el numero fiscal indicado.';
      end if;
    end if;

    new.invoice_number := public.build_invoice_number(v_year, v_sequence);
    new.display_code := public.build_invoice_display_code(v_sequence);
    return new;
  end if;

  if new.invoice_number is distinct from old.invoice_number
    or new.display_code is distinct from old.display_code then
    raise exception 'No se puede cambiar la numeracion fiscal de una factura ya emitida desde flujos normales.';
  end if;

  new.invoice_number := old.invoice_number;
  new.display_code := old.display_code;
  return new;
end;
$$;

drop trigger if exists trg_sync_invoice_numbering on public.invoices;
create trigger trg_sync_invoice_numbering
before insert or update on public.invoices
for each row
execute function public.sync_invoice_numbering();

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

create or replace function public.save_invoice_with_lines_v2(
  p_invoice jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_id text := nullif(p_invoice ->> 'id', '');
  v_status text := coalesce(nullif(p_invoice ->> 'status', ''), 'draft');
  v_pricing_metadata jsonb := case
    when jsonb_typeof(coalesce(p_invoice -> 'pricing_metadata', '{}'::jsonb)) = 'object'
      then coalesce(p_invoice -> 'pricing_metadata', '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_snapshot jsonb := case
    when jsonb_typeof(v_pricing_metadata -> 'client_fiscal_snapshot') = 'object'
      then v_pricing_metadata -> 'client_fiscal_snapshot'
    else '{}'::jsonb
  end;
  v_saved_invoice jsonb;
begin
  perform public.require_authenticated_financial_write();

  if public.invoice_status_consumes_fiscal_number(v_status) then
    if nullif(trim(coalesce(v_snapshot ->> 'tax_id', '')), '') is null
      or nullif(trim(coalesce(v_snapshot ->> 'billing_address', '')), '') is null
      or nullif(trim(coalesce(v_snapshot ->> 'fiscal_name', v_snapshot ->> 'name', '')), '') is null then
      raise exception 'No se puede emitir factura sin snapshot fiscal completo del cliente.';
    end if;
  end if;

  perform public.save_invoice_with_lines(p_invoice, p_lines);

  select jsonb_build_object(
    'id', invoices.id,
    'display_code', invoices.display_code,
    'invoice_number', invoices.invoice_number,
    'status', invoices.status,
    'issue_date', invoices.issue_date
  )
  into v_saved_invoice
  from public.invoices
  where id = v_invoice_id;

  if v_saved_invoice is null then
    raise exception 'La factura se guardo, pero no se pudo confirmar su lectura en el RPC.';
  end if;

  return v_saved_invoice;
end;
$$;

grant execute on function public.save_invoice_with_lines(jsonb, jsonb) to authenticated;
grant execute on function public.save_invoice_with_lines_v2(jsonb, jsonb) to authenticated;

commit;
