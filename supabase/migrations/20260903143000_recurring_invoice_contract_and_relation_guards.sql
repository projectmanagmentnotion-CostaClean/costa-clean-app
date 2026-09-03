begin;

-- Restore the invoice recurrence contract that exists in the repository's
-- historical SQL, without changing the legacy client-specific batch.
create table if not exists public.recurring_invoice_plans (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  property_id text references public.properties(id) on delete set null,
  quote_id text references public.quotes(id) on delete set null,
  title text not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  default_invoice_status text not null default 'draft' check (default_invoice_status in ('draft', 'issued')),
  next_issue_date date not null,
  last_issued_at timestamptz,
  tax_rate numeric(6,4) not null default 0.21,
  notes text,
  internal_notes text,
  pricing_metadata jsonb not null default '{}'::jsonb,
  template_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_invoice_plans_client_idx
  on public.recurring_invoice_plans (client_id, status, next_issue_date);

alter table public.recurring_invoice_plans enable row level security;

drop policy if exists "Authenticated read access" on public.recurring_invoice_plans;
create policy "Authenticated read access"
  on public.recurring_invoice_plans
  for select
  to authenticated
  using (auth.uid() is not null);

-- All invoice writes, including the quote and recurring paths, must preserve
-- the client/property/job identity contract. Existing legacy mismatches remain
-- readable and editable without silently creating a new mismatch.
create or replace function public.validate_invoice_relationships()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_property record;
  v_quote record;
  v_existing_mismatch boolean := false;
begin
  if new.job_id is not null then
    select client_id, property_id, quote_id into v_job
    from public.jobs where id = new.job_id;

    if not found then
      raise exception 'El servicio indicado para la factura no existe.';
    end if;

    v_existing_mismatch := tg_op = 'UPDATE'
      and old.job_id = new.job_id
      and old.client_id is distinct from v_job.client_id;

    if new.client_id is distinct from v_job.client_id and not v_existing_mismatch then
      raise exception 'La factura y el servicio deben pertenecer al mismo cliente.';
    end if;

    if new.property_id is not null and new.property_id is distinct from v_job.property_id
      and not (tg_op = 'UPDATE' and old.job_id = new.job_id and old.property_id = new.property_id) then
      raise exception 'La propiedad de la factura no coincide con la propiedad del servicio.';
    end if;
  end if;

  if new.property_id is not null then
    select client_id into v_property
    from public.properties where id = new.property_id;

    if not found then
      raise exception 'La propiedad indicada para la factura no existe.';
    end if;

    v_existing_mismatch := tg_op = 'UPDATE'
      and old.property_id = new.property_id
      and old.client_id is distinct from v_property.client_id;

    if new.client_id is distinct from v_property.client_id and not v_existing_mismatch then
      raise exception 'La factura y la propiedad deben pertenecer al mismo cliente.';
    end if;
  end if;

  if new.quote_id is not null then
    select client_id, property_id into v_quote
    from public.quotes where id = new.quote_id;

    if not found then
      raise exception 'El presupuesto indicado para la factura no existe.';
    end if;

    if v_quote.client_id is not null and new.client_id is distinct from v_quote.client_id then
      raise exception 'La factura y el presupuesto deben pertenecer al mismo cliente.';
    end if;

    if new.property_id is not null and v_quote.property_id is not null
      and new.property_id is distinct from v_quote.property_id then
      raise exception 'La propiedad de la factura no coincide con la del presupuesto.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_invoice_relationships_trigger on public.invoices;
create trigger validate_invoice_relationships_trigger
before insert or update of job_id, quote_id, client_id, property_id
on public.invoices
for each row execute function public.validate_invoice_relationships();

create or replace function public.save_client_recurring_invoice_plan(
  p_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id text := nullif(p_plan ->> 'id', '');
  v_client_id text := nullif(p_plan ->> 'client_id', '');
  v_property_id text := nullif(p_plan ->> 'property_id', '');
  v_quote_id text := nullif(p_plan ->> 'quote_id', '');
  v_title text := nullif(trim(coalesce(p_plan ->> 'title', '')), '');
  v_frequency text := coalesce(nullif(p_plan ->> 'frequency', ''), 'monthly');
  v_status text := coalesce(nullif(p_plan ->> 'status', ''), 'active');
  v_default_invoice_status text := coalesce(nullif(p_plan ->> 'default_invoice_status', ''), 'draft');
  v_next_issue_date date := (p_plan ->> 'next_issue_date')::date;
  v_tax_rate numeric := coalesce((p_plan ->> 'tax_rate')::numeric, 0.21);
  v_template_lines jsonb := coalesce(p_plan -> 'template_lines', '[]'::jsonb);
  v_saved_plan public.recurring_invoice_plans;
begin
  perform public.require_authenticated_financial_write();

  if v_plan_id is null or v_client_id is null or v_title is null or v_next_issue_date is null then
    raise exception 'La automatizacion recurrente necesita identificador, cliente, titulo y proxima fecha.';
  end if;

  if not exists (select 1 from public.clients where id = v_client_id and deleted_at is null and archived_at is null) then
    raise exception 'El cliente de la automatizacion recurrente no existe o no esta activo.';
  end if;

  if v_property_id is not null and not exists (
    select 1 from public.properties where id = v_property_id and client_id = v_client_id
  ) then
    raise exception 'La propiedad de la automatizacion no pertenece al cliente indicado.';
  end if;

  if v_quote_id is not null and not exists (
    select 1 from public.quotes
    where id = v_quote_id
      and (client_id = v_client_id or client_id is null)
      and (property_id is null or property_id = v_property_id)
  ) then
    raise exception 'El presupuesto de la automatizacion no es compatible con el cliente o la propiedad.';
  end if;

  if v_frequency not in ('weekly', 'biweekly', 'monthly', 'quarterly')
    or v_status not in ('active', 'paused', 'archived')
    or v_default_invoice_status not in ('draft', 'issued') then
    raise exception 'La configuracion de la automatizacion recurrente no es valida.';
  end if;

  if v_tax_rate < 0 or jsonb_typeof(v_template_lines) <> 'array' or jsonb_array_length(v_template_lines) = 0 then
    raise exception 'La automatizacion recurrente necesita un IVA valido y al menos una linea.';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_template_lines) as line(
      concept text, quantity numeric, unit_price numeric, line_subtotal numeric
    ) where nullif(trim(coalesce(line.concept, '')), '') is null
      or length(trim(line.concept)) > 120
      or line.quantity is null or line.quantity <= 0
      or line.unit_price is null or line.unit_price < 0
      or line.line_subtotal is null or line.line_subtotal < 0
  ) then
    raise exception 'Las lineas de la automatizacion contienen importes no validos.';
  end if;

  insert into public.recurring_invoice_plans (
    id, client_id, property_id, quote_id, title, frequency, status,
    default_invoice_status, next_issue_date, last_issued_at, tax_rate,
    notes, internal_notes, pricing_metadata, template_lines, updated_at
  ) values (
    v_plan_id, v_client_id, v_property_id, v_quote_id, v_title, v_frequency, v_status,
    v_default_invoice_status, v_next_issue_date,
    nullif(p_plan ->> 'last_issued_at', '')::timestamptz,
    v_tax_rate, nullif(p_plan ->> 'notes', ''), nullif(p_plan ->> 'internal_notes', ''),
    case when jsonb_typeof(p_plan -> 'pricing_metadata') = 'object' then p_plan -> 'pricing_metadata' else '{}'::jsonb end,
    v_template_lines, now()
  )
  on conflict (id) do update set
    client_id = excluded.client_id, property_id = excluded.property_id, quote_id = excluded.quote_id,
    title = excluded.title, frequency = excluded.frequency, status = excluded.status,
    default_invoice_status = excluded.default_invoice_status, next_issue_date = excluded.next_issue_date,
    last_issued_at = excluded.last_issued_at, tax_rate = excluded.tax_rate, notes = excluded.notes,
    internal_notes = excluded.internal_notes, pricing_metadata = excluded.pricing_metadata,
    template_lines = excluded.template_lines, updated_at = now()
  returning * into v_saved_plan;

  return to_jsonb(v_saved_plan);
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
  v_plan public.recurring_invoice_plans;
  v_invoice_id text := coalesce(nullif(p_invoice_id, ''), 'INVOICE-' || gen_random_uuid()::text);
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_total numeric := 0;
  v_next_issue_date date;
  v_existing public.invoices;
  v_metadata jsonb;
  v_lines jsonb;
begin
  perform public.require_authenticated_financial_write();

  select * into v_plan from public.recurring_invoice_plans where id = nullif(p_plan_id, '') for update;
  if not found then raise exception 'No se encontro la automatizacion recurrente indicada.'; end if;
  if v_plan.status <> 'active' then raise exception 'Solo se pueden emitir facturas desde automatizaciones activas.'; end if;
  if p_issue_date is null then raise exception 'La fecha de emision recurrente no puede ser nula.'; end if;

  v_metadata := coalesce(v_plan.pricing_metadata, '{}'::jsonb)
    || jsonb_build_object('recurring_plan_id', v_plan.id, 'recurring_issue_date', p_issue_date,
      'recurring_plan_title', v_plan.title, 'generated_from_recurring_plan', true);

  select i.* into v_existing
  from public.invoices i
  where i.pricing_metadata ->> 'recurring_plan_id' = v_plan.id
    and i.pricing_metadata ->> 'recurring_issue_date' = p_issue_date::text
    and i.deleted_at is null and i.cancelled_at is null
  order by i.created_at desc limit 1;

  if found then
    return jsonb_build_object('invoice_id', v_existing.id, 'plan_id', v_plan.id,
      'next_issue_date', v_plan.next_issue_date, 'status', 'already_exists');
  end if;

  select coalesce(sum((line ->> 'line_subtotal')::numeric), 0) into v_subtotal
  from jsonb_array_elements(v_plan.template_lines) as line;
  v_tax_amount := round(v_subtotal * coalesce(v_plan.tax_rate, 0.21), 2);
  v_total := round(v_subtotal + v_tax_amount, 2);
  v_lines := (
    select jsonb_agg(jsonb_build_object(
      'id', 'INVOICE-LINE-' || gen_random_uuid()::text,
      'sort_order', ordinality,
      'concept', trim(coalesce(line ->> 'concept', '')),
      'quantity', (line ->> 'quantity')::numeric,
      'unit', coalesce(nullif(trim(line ->> 'unit'), ''), 'servicio'),
      'unit_price', (line ->> 'unit_price')::numeric,
      'line_subtotal', (line ->> 'line_subtotal')::numeric
    ) order by ordinality)
    from jsonb_array_elements(v_plan.template_lines) with ordinality as item(line, ordinality)
  );

  if v_plan.frequency = 'weekly' then v_next_issue_date := p_issue_date + 7;
  elsif v_plan.frequency = 'biweekly' then v_next_issue_date := p_issue_date + 14;
  elsif v_plan.frequency = 'monthly' then v_next_issue_date := (p_issue_date + interval '1 month')::date;
  else v_next_issue_date := (p_issue_date + interval '3 month')::date;
  end if;

  perform public.save_invoice_with_lines_v2(jsonb_build_object(
    'id', v_invoice_id, 'job_id', null, 'quote_id', v_plan.quote_id,
    'client_id', v_plan.client_id, 'property_id', v_plan.property_id,
    'issue_date', p_issue_date, 'status', v_plan.default_invoice_status,
    'subtotal', v_subtotal, 'tax_amount', v_tax_amount, 'total', v_total,
    'notes', v_plan.notes,
    'internal_notes', concat_ws(E'\n\n', 'Factura generada desde automatizacion recurrente.', v_plan.internal_notes),
    'pricing_metadata', public.ensure_invoice_pricing_metadata(v_metadata, v_plan.client_id, 'client_backfill')
  ), v_lines);

  update public.recurring_invoice_plans
  set last_issued_at = now(), next_issue_date = v_next_issue_date, updated_at = now()
  where id = v_plan.id;

  return jsonb_build_object('invoice_id', v_invoice_id, 'plan_id', v_plan.id,
    'next_issue_date', v_next_issue_date, 'status', 'created');
end;
$$;

grant execute on function public.save_client_recurring_invoice_plan(jsonb) to authenticated;
grant execute on function public.generate_invoice_from_recurring_plan(text, text, date) to authenticated;

-- The legacy batch remains available to authenticated operators only. Its
-- previous anonymous grants were incompatible with the financial write gate.
revoke all on function public.copy_latest_invoice_template_by_tax_id(text, date, text, text) from anon;
revoke all on function public.run_monthly_alcapa_gilfit_recurring_invoices() from anon;

commit;
