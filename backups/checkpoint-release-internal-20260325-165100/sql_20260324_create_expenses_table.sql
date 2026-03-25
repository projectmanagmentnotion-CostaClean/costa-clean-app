create extension if not exists pgcrypto;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),

  display_code text unique,
  expense_number bigint generated always as identity,

  expense_date date not null default current_date,
  accounting_date date,
  due_date date,

  supplier_name text not null,
  supplier_tax_id text,
  category text not null,
  subcategory text,
  description text not null,

  document_type text not null default 'ticket',
  reference_number text,

  payment_method text,
  payment_status text not null default 'paid',

  currency text not null default 'EUR',

  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(6,2) not null default 21,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  is_deductible boolean not null default true,
  deductible_percentage numeric(5,2) not null default 100,

  affects_quarterly_closure boolean not null default true,
  affects_annual_closure boolean not null default true,

  receipt_file_url text,
  receipt_file_path text,
  attachment_count integer not null default 0,

  notes text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  fiscal_year integer generated always as (extract(year from expense_date)::integer) stored,
  fiscal_quarter integer generated always as (((extract(month from expense_date)::integer - 1) / 3) + 1) stored,

  constraint expenses_category_check check (
    category in (
      'materiales',
      'transporte',
      'combustible',
      'herramientas',
      'productos_limpieza',
      'lavanderia',
      'alquiler',
      'seguros',
      'software',
      'telefonia',
      'publicidad_marketing',
      'gestoria',
      'suministros',
      'mantenimiento',
      'dietas_viajes',
      'impuestos_tasas',
      'servicios_profesionales',
      'otros'
    )
  ),

  constraint expenses_document_type_check check (
    document_type in ('ticket', 'factura', 'recibo', 'otro')
  ),

  constraint expenses_payment_method_check check (
    payment_method is null or payment_method in ('cash', 'card', 'transfer', 'bizum', 'direct_debit', 'other')
  ),

  constraint expenses_payment_status_check check (
    payment_status in ('paid', 'pending', 'partially_paid', 'cancelled')
  ),

  constraint expenses_amounts_non_negative_check check (
    subtotal >= 0 and tax_amount >= 0 and total >= 0
  ),

  constraint expenses_deductible_percentage_check check (
    deductible_percentage >= 0 and deductible_percentage <= 100
  )
);

create index if not exists idx_expenses_expense_date on public.expenses(expense_date desc);
create index if not exists idx_expenses_fiscal_year_quarter on public.expenses(fiscal_year, fiscal_quarter);
create index if not exists idx_expenses_category on public.expenses(category);
create index if not exists idx_expenses_supplier_name on public.expenses(supplier_name);
create index if not exists idx_expenses_is_deductible on public.expenses(is_deductible);

create or replace function public.set_expenses_display_code()
returns trigger
language plpgsql
as $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'EXP-' || to_char(coalesce(new.expense_date, current_date), 'YYYY') || '-' || lpad(new.expense_number::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_expenses_display_code on public.expenses;

create trigger trg_set_expenses_display_code
before insert on public.expenses
for each row
execute function public.set_expenses_display_code();

create or replace function public.set_updated_at_expenses()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_expenses on public.expenses;

create trigger trg_set_updated_at_expenses
before update on public.expenses
for each row
execute function public.set_updated_at_expenses();

create or replace function public.expenses_autocalc_amounts()
returns trigger
language plpgsql
as $$
declare
  base_amount numeric(12,2);
  vat_rate numeric(6,2);
begin
  base_amount := coalesce(new.subtotal, 0);
  vat_rate := coalesce(new.tax_rate, 0);

  if (coalesce(new.tax_amount, 0) = 0 and base_amount > 0 and vat_rate > 0) then
    new.tax_amount := round(base_amount * vat_rate / 100.0, 2);
  end if;

  if (coalesce(new.total, 0) = 0) then
    new.total := round(coalesce(new.subtotal, 0) + coalesce(new.tax_amount, 0), 2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_expenses_autocalc_amounts on public.expenses;

create trigger trg_expenses_autocalc_amounts
before insert or update on public.expenses
for each row
execute function public.expenses_autocalc_amounts();

alter table public.expenses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Allow authenticated select expenses'
  ) then
    create policy "Allow authenticated select expenses"
      on public.expenses
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Allow authenticated insert expenses'
  ) then
    create policy "Allow authenticated insert expenses"
      on public.expenses
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Allow authenticated update expenses'
  ) then
    create policy "Allow authenticated update expenses"
      on public.expenses
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

comment on table public.expenses is 'Gastos empresariales de CostaClean con soporte para deducción, cierre trimestral y anual, y adjuntos de tickets o facturas.';