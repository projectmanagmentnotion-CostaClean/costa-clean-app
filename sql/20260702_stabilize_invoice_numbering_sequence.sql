-- Stabilize fiscal invoice numbering so drafts do not consume numbers
-- and every issuance path uses the same database-side rule.

create or replace function public.invoice_status_consumes_fiscal_number(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_status, '') in ('issued', 'paid', 'cancelled');
$$;

create or replace function public.extract_invoice_fiscal_sequence(
  p_invoice_number text,
  p_year integer default null
)
returns integer
language plpgsql
immutable
as $$
declare
  v_match text[];
  v_year integer;
  v_sequence integer;
begin
  if nullif(trim(coalesce(p_invoice_number, '')), '') is null then
    return null;
  end if;

  v_match := regexp_match(trim(p_invoice_number), '^(\d{4})-(\d+)$');
  if v_match is null then
    return null;
  end if;

  v_year := v_match[1]::integer;
  v_sequence := v_match[2]::integer;

  if p_year is not null and v_year <> p_year then
    return null;
  end if;

  return v_sequence;
end;
$$;

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

  v_match := regexp_match(trim(p_display_code), '^INV-(\d+)$');
  if v_match is null then
    return null;
  end if;

  return v_match[1]::integer;
end;
$$;

create or replace function public.build_invoice_number(p_year integer, p_sequence integer)
returns text
language sql
immutable
as $$
  select p_year::text || '-' || lpad(p_sequence::text, 3, '0');
$$;

create or replace function public.build_invoice_display_code(p_sequence integer)
returns text
language sql
immutable
as $$
  select 'INV-' || lpad(p_sequence::text, 4, '0');
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

    select coalesce(max(public.extract_invoice_fiscal_sequence(invoice_number, v_year)), 0) + 1
    into v_sequence
    from public.invoices
    where id <> new.id
      and public.extract_invoice_fiscal_sequence(invoice_number, v_year) is not null;
  end if;

  new.invoice_number := public.build_invoice_number(v_year, v_sequence);
  new.display_code := public.build_invoice_display_code(v_sequence);

  return new;
end;
$$;

drop trigger if exists trg_sync_invoice_numbering on public.invoices;
create trigger trg_sync_invoice_numbering
before insert or update of status, issue_date, invoice_number, display_code
on public.invoices
for each row
execute function public.sync_invoice_numbering();

create unique index if not exists invoices_invoice_number_unique_idx
  on public.invoices (invoice_number)
  where invoice_number is not null;

create unique index if not exists invoices_display_code_unique_idx
  on public.invoices (display_code)
  where display_code is not null;
