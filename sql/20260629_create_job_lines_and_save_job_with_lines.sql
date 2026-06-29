create table if not exists public.job_lines (
  id text primary key,
  job_id text not null references public.jobs(id) on delete cascade,
  sort_order integer not null default 1,
  concept text not null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'servicio',
  unit_price numeric(12,2) not null default 0,
  line_subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint job_lines_quantity_positive_check check (quantity > 0),
  constraint job_lines_unit_price_non_negative_check check (unit_price >= 0),
  constraint job_lines_line_subtotal_non_negative_check check (line_subtotal >= 0),
  constraint job_lines_sort_order_positive_check check (sort_order > 0)
);

create index if not exists job_lines_job_id_sort_order_idx
  on public.job_lines (job_id, sort_order);

create or replace function public.save_job_with_lines(
  p_job jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id text := nullif(p_job ->> 'id', '');
begin
  perform public.require_authenticated_financial_write();

  if v_job_id is null then
    raise exception 'El servicio necesita identificador.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El servicio necesita al menos una linea.';
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
    raise exception 'Las lineas del servicio contienen importes no validos.';
  end if;

  insert into public.jobs (
    id,
    client_id,
    property_id,
    quote_id,
    scheduled_date,
    status,
    service_type,
    billing_concept,
    billing_quantity,
    billing_unit,
    billing_unit_price,
    notes
  )
  values (
    v_job_id,
    nullif(p_job ->> 'client_id', ''),
    nullif(p_job ->> 'property_id', ''),
    nullif(p_job ->> 'quote_id', ''),
    (p_job ->> 'scheduled_date')::date,
    coalesce(nullif(p_job ->> 'status', ''), 'scheduled'),
    coalesce(nullif(p_job ->> 'service_type', ''), 'standard_cleaning'),
    nullif(p_job ->> 'billing_concept', ''),
    coalesce((p_job ->> 'billing_quantity')::numeric, 1),
    coalesce(nullif(trim(p_job ->> 'billing_unit'), ''), 'servicio'),
    (p_job ->> 'billing_unit_price')::numeric,
    nullif(p_job ->> 'notes', '')
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    property_id = excluded.property_id,
    quote_id = excluded.quote_id,
    scheduled_date = excluded.scheduled_date,
    status = excluded.status,
    service_type = excluded.service_type,
    billing_concept = excluded.billing_concept,
    billing_quantity = excluded.billing_quantity,
    billing_unit = excluded.billing_unit,
    billing_unit_price = excluded.billing_unit_price,
    notes = excluded.notes;

  delete from public.job_lines
  where job_id = v_job_id;

  insert into public.job_lines (
    id,
    job_id,
    sort_order,
    concept,
    quantity,
    unit,
    unit_price,
    line_subtotal
  )
  select
    nullif(line.id, ''),
    v_job_id,
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
