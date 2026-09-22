begin;

-- N3: the canonical trigger is the sole allocator. Drafts never touch either
-- fiscal numbering or the deprecated serial sequence.
drop trigger if exists trg_set_invoices_codes on public.invoices;

create or replace function public.extract_invoice_display_sequence(p_display_code text)
returns integer
language plpgsql
immutable
as $$
declare
  v_match text[];
begin
  if nullif(trim(coalesce(p_display_code, '')), '') is null then
    return null;
  end if;
  v_match := regexp_match(trim(p_display_code), '^INV-(?:[0-9]{4}-)?([0-9]+)$');
  if v_match is null then
    return null;
  end if;
  return v_match[1]::integer;
exception when numeric_value_out_of_range then
  return null;
end;
$$;

create or replace function public.build_invoice_display_code(p_sequence integer)
returns text
language sql
immutable
as $$
  select 'INV-' || lpad(p_sequence::text, 4, '0');
$$;

create or replace function public.build_invoice_display_code(p_year integer, p_sequence integer)
returns text
language sql
immutable
as $$
  select 'INV-' || p_year::text || '-' || lpad(p_sequence::text, 3, '0');
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
  v_problem text;
  v_gap_from integer;
  v_gap_to integer;
begin
  if p_year is null then
    return;
  end if;

  select case
    when count(*) filter (where public.invoice_status_consumes_fiscal_number(i.status)
      and (i.invoice_number is null or i.display_code is null)) > 0
      then 'Existe una factura fiscal sin numeracion completa.'
    when count(*) filter (where not public.invoice_status_consumes_fiscal_number(i.status)
      and (i.invoice_number is not null or i.display_code is not null)) > 0
      then 'Existe un borrador con numeracion fiscal.'
    when count(*) filter (where public.invoice_status_consumes_fiscal_number(i.status)
      and (public.extract_invoice_fiscal_sequence(i.invoice_number, p_year) is null
        or public.extract_invoice_display_sequence(i.display_code) is null
        or public.extract_invoice_display_sequence(i.display_code)
          <> public.extract_invoice_fiscal_sequence(i.invoice_number, p_year))) > 0
      then 'Existe una numeracion fiscal mal formada o desalineada.'
    else null
  end into v_problem
  from public.invoices i
  where i.id is distinct from p_exclude_invoice_id
    and extract(year from i.issue_date)::integer = p_year;

  if v_problem is not null then
    raise exception '%', v_problem using errcode = '55000';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and public.invoice_status_consumes_fiscal_number(i.status)
      and extract(year from i.issue_date)::integer = p_year
    group by public.extract_invoice_fiscal_sequence(i.invoice_number, p_year)
    having count(*) > 1
  ) then
    raise exception 'Existen numeros fiscales duplicados para el ejercicio %.', p_year using errcode = '55000';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and public.invoice_status_consumes_fiscal_number(i.status)
    group by i.display_code having count(*) > 1
  ) then
    raise exception 'Existen codigos visibles de factura duplicados.' using errcode = '55000';
  end if;

  with sequences as (
    select distinct public.extract_invoice_fiscal_sequence(i.invoice_number, p_year) as seq
    from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and public.invoice_status_consumes_fiscal_number(i.status)
      and extract(year from i.issue_date)::integer = p_year
      and public.extract_invoice_fiscal_sequence(i.invoice_number, p_year) is not null
  ), ordered as (
    select seq, lag(seq) over (order by seq) as prev_seq
    from sequences
  )
  select prev_seq + 1, seq - 1
  into v_gap_from, v_gap_to
  from ordered
  where prev_seq is not null and seq - prev_seq > 1
  order by prev_seq
  limit 1;

  if v_gap_from is not null then
    raise exception 'No se puede emitir factura. Hay huecos en la numeracion fiscal: %.',
      case
        when v_gap_from = v_gap_to then public.build_invoice_number(p_year, v_gap_from)
        else public.build_invoice_number(p_year, v_gap_from) || ' a ' || public.build_invoice_number(p_year, v_gap_to)
      end using errcode = '55000';
  end if;
end;
$$;

create or replace function public.sync_invoice_numbering()
returns trigger
language plpgsql
as $$
declare
  v_year integer := extract(year from coalesce(new.issue_date, current_date))::integer;
  v_sequence integer;
  v_manual_override boolean := coalesce(current_setting('app.invoice_number_override', true), 'false') = 'true';
  v_new_consumes boolean := public.invoice_status_consumes_fiscal_number(new.status);
  v_old_consumes boolean := case
    when tg_op = 'UPDATE' then public.invoice_status_consumes_fiscal_number(old.status)
    else false
  end;
  v_display_sequence integer;
begin
  if new.status = 'cancelled'
    and (tg_op = 'INSERT' or not v_old_consumes) then
    new.invoice_number := null;
    new.display_code := null;
    return new;
  end if;

  if not v_new_consumes then
    if tg_op = 'UPDATE' and v_old_consumes then
      new.invoice_number := old.invoice_number;
      new.display_code := old.display_code;
    else
      new.invoice_number := null;
      new.display_code := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' or not v_old_consumes then
    perform pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text));
    select public.find_first_missing_invoice_sequence(v_year, new.id) into v_sequence;
    new.invoice_number := public.build_invoice_number(v_year, v_sequence);
    new.display_code := public.build_invoice_display_code(v_year, v_sequence);
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
    new.display_code := public.build_invoice_display_code(v_year, v_sequence);
    return new;
  end if;

  if new.invoice_number is distinct from old.invoice_number
    or new.display_code is distinct from old.display_code
    or extract(year from new.issue_date)::integer
      is distinct from extract(year from old.issue_date)::integer then
    raise exception 'No se puede cambiar la numeracion fiscal ni su ejercicio desde flujos normales.' using errcode = '55000';
  end if;

  new.invoice_number := old.invoice_number;
  new.display_code := old.display_code;
  return new;
end;
$$;

drop trigger if exists trg_sync_invoice_numbering on public.invoices;
create trigger trg_sync_invoice_numbering
before insert or update on public.invoices
for each row execute function public.sync_invoice_numbering();

create or replace function public.prevent_fiscal_invoice_hard_delete()
returns trigger
language plpgsql
as $$
begin
  if public.invoice_status_consumes_fiscal_number(old.status)
    or old.invoice_number is not null
    or old.display_code is not null then
    raise exception 'Las facturas con numeracion fiscal no se pueden eliminar; deben conservar su trazabilidad.' using errcode = '55000';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_fiscal_invoice_hard_delete on public.invoices;
create trigger trg_prevent_fiscal_invoice_hard_delete
before delete on public.invoices
for each row execute function public.prevent_fiscal_invoice_hard_delete();

comment on function public.set_invoices_codes() is
  'Deprecated N3: retained for compatibility, but trg_set_invoices_codes is retired. Never allocate fiscal numbers through this function.';
comment on sequence public.invoices_invoice_number_seq is
  'Deprecated N3: retained because historical/manual import tooling may reference it; canonical invoice numbering does not consume it.';

commit;
