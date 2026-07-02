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
begin
  if tg_op = 'INSERT' and not public.invoice_status_consumes_fiscal_number(new.status) then
    new.invoice_number := null;
    new.display_code := null;
    return new;
  end if;

  if not public.invoice_status_consumes_fiscal_number(new.status) then
    return new;
  end if;

  v_year := extract(year from coalesce(new.issue_date, current_date))::integer;

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
    perform pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text));

    select public.find_first_missing_invoice_sequence(v_year, new.id)
    into v_sequence;
  end if;

  new.invoice_number := public.build_invoice_number(v_year, v_sequence);
  new.display_code := public.build_invoice_display_code(v_sequence);

  return new;
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

grant execute on function public.save_invoice_with_lines_v2(jsonb, jsonb) to authenticated;

commit;
