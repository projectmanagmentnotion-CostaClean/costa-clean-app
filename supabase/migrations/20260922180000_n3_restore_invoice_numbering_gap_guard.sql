begin;

-- Preserve the established rule that an unexplained sequence gap blocks new
-- issuance until an authorized fiscal review resolves it. Cancelled invoices
-- retain their consumed numbers and therefore remain part of the sequence.
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
  if p_year is null then return; end if;

  if exists (
    select 1 from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and i.status not in ('issued', 'paid', 'cancelled')
      and (i.invoice_number is not null or i.display_code is not null)
  ) then
    raise exception 'Existe un borrador con numeracion fiscal.' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.invoices i
    cross join lateral (select extract(year from i.issue_date)::integer as issue_year) y
    where i.id is distinct from p_exclude_invoice_id
      and (i.status in ('issued', 'paid') or (i.status = 'cancelled' and (i.invoice_number is not null or i.display_code is not null)))
      and (i.invoice_number is null or i.display_code is null
        or public.extract_invoice_fiscal_sequence(i.invoice_number, y.issue_year) is null
        or public.extract_invoice_display_sequence(i.display_code) is null
        or public.extract_invoice_display_sequence(i.display_code)
          <> public.extract_invoice_fiscal_sequence(i.invoice_number, y.issue_year)
        or (i.display_code ~ '^INV-[0-9]{4}-[0-9]+$'
          and substring(i.display_code from '^INV-([0-9]{4})-')::integer <> y.issue_year))
  ) then
    raise exception 'Existe una factura fiscal sin numeracion completa o desalineada.' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.id is distinct from p_exclude_invoice_id and i.status = 'cancelled'
      and ((i.invoice_number is null) <> (i.display_code is null))
  ) then
    raise exception 'Existe una factura cancelada con numeracion parcial.' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and (i.status in ('issued', 'paid') or (i.status = 'cancelled' and i.invoice_number is not null))
    group by i.invoice_number having count(*) > 1
  ) then
    raise exception 'Existen numeros fiscales duplicados para el ejercicio %.', p_year using errcode = '55000';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and (i.status in ('issued', 'paid') or (i.status = 'cancelled' and i.display_code is not null))
    group by i.display_code having count(*) > 1
  ) then
    raise exception 'Existen codigos visibles de factura duplicados.' using errcode = '55000';
  end if;

  with sequences as (
    select distinct public.extract_invoice_fiscal_sequence(i.invoice_number, p_year) as seq
    from public.invoices i
    where i.id is distinct from p_exclude_invoice_id
      and (i.status in ('issued', 'paid')
        or (i.status = 'cancelled' and i.invoice_number is not null and i.display_code is not null))
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

commit;
