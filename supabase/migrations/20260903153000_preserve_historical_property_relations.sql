begin;

create or replace function public.assert_property_relation_for_write(
  p_client_id text,
  p_property_id text,
  p_existing_client_id text default null,
  p_existing_property_id text default null,
  p_existing_created_at timestamptz default null,
  p_entity_label text default 'document'
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_current_property_client_id text;
begin
  if p_client_id is null or p_property_id is null then
    return;
  end if;

  select client_id into v_current_property_client_id
  from public.properties
  where id = p_property_id;

  if not found then
    raise exception 'La propiedad indicada no existe.';
  end if;

  if v_current_property_client_id = p_client_id then
    return;
  end if;

  if p_existing_client_id = p_client_id
    and p_existing_property_id = p_property_id
    and p_existing_created_at is not null
    and exists (
      select 1
      from public.audit_events ae
      where ae.entity_type = 'property'
        and ae.entity_id = p_property_id
        and ae.action = 'correction'
        and ae.changed_at > p_existing_created_at
        and ae.previous_values ->> 'client_id' = p_client_id
        and ae.new_values ->> 'client_id' = v_current_property_client_id
    ) then
    return;
  end if;

  raise exception 'La propiedad no pertenece al cliente del %.', p_entity_label;
end;
$$;

create or replace function public.save_job_with_lines(p_job jsonb, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job_id text := nullif(p_job ->> 'id', '');
  v_client_id text := nullif(p_job ->> 'client_id', '');
  v_property_id text := nullif(p_job ->> 'property_id', '');
  v_quote_id text := nullif(p_job ->> 'quote_id', '');
  v_existing public.jobs%rowtype;
begin
  perform public.require_authenticated_financial_write();
  if v_job_id is null then raise exception 'El servicio necesita identificador.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'El servicio necesita al menos una linea.'; end if;

  select * into v_existing from public.jobs where id = v_job_id;
  perform public.assert_property_relation_for_write(
    v_client_id, v_property_id, v_existing.client_id, v_existing.property_id, v_existing.created_at, 'servicio'
  );

  if v_quote_id is not null and v_client_id is not null and not exists (
    select 1 from public.quotes where id = v_quote_id and client_id = v_client_id
  ) then
    raise exception 'El presupuesto no pertenece al cliente del servicio.';
  end if;

  if exists (select 1 from jsonb_to_recordset(p_lines) as line(concept text, quantity numeric, unit_price numeric, line_subtotal numeric)
    where nullif(trim(coalesce(line.concept, '')), '') is null or line.quantity is null or line.quantity <= 0
      or line.unit_price is null or line.unit_price < 0 or line.line_subtotal is null or line.line_subtotal < 0) then
    raise exception 'Las lineas del servicio contienen importes no validos.';
  end if;

  insert into public.jobs (id, client_id, property_id, quote_id, scheduled_date, status, service_type, billing_concept, billing_quantity, billing_unit, billing_unit_price, notes)
  values (v_job_id, v_client_id, v_property_id, v_quote_id, (p_job ->> 'scheduled_date')::date,
    coalesce(nullif(p_job ->> 'status', ''), 'scheduled'), coalesce(nullif(p_job ->> 'service_type', ''), 'standard_cleaning'),
    nullif(p_job ->> 'billing_concept', ''), coalesce((p_job ->> 'billing_quantity')::numeric, 1),
    coalesce(nullif(trim(p_job ->> 'billing_unit'), ''), 'servicio'), (p_job ->> 'billing_unit_price')::numeric, nullif(p_job ->> 'notes', ''))
  on conflict (id) do update set client_id=excluded.client_id, property_id=excluded.property_id, quote_id=excluded.quote_id,
    scheduled_date=excluded.scheduled_date, status=excluded.status, service_type=excluded.service_type,
    billing_concept=excluded.billing_concept, billing_quantity=excluded.billing_quantity, billing_unit=excluded.billing_unit,
    billing_unit_price=excluded.billing_unit_price, notes=excluded.notes;
  delete from public.job_lines where job_id = v_job_id;
  insert into public.job_lines (id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
  select nullif(line.id, ''), v_job_id, line.sort_order, trim(line.concept), line.quantity,
    coalesce(nullif(trim(line.unit), ''), 'servicio'), line.unit_price, line.line_subtotal
  from jsonb_to_recordset(p_lines) as line(id text, sort_order integer, concept text, quantity numeric, unit text, unit_price numeric, line_subtotal numeric);
end;
$$;

create or replace function public.save_quote_with_lines(p_quote jsonb, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_quote_id text := nullif(p_quote ->> 'id', '');
  v_client_id text := nullif(p_quote ->> 'client_id', '');
  v_lead_id text := nullif(p_quote ->> 'lead_id', '');
  v_property_id text := nullif(p_quote ->> 'property_id', '');
  v_status text := coalesce(nullif(p_quote ->> 'status', ''), 'draft');
  v_existing public.quotes%rowtype;
begin
  perform public.require_authenticated_financial_write();
  if v_quote_id is null then raise exception 'El presupuesto necesita identificador.'; end if;
  if v_client_id is null and v_lead_id is null then raise exception 'El presupuesto necesita cliente o lead.'; end if;
  if v_lead_id is not null and v_status in ('draft', 'sent') and exists (
    select 1 from public.quotes where lead_id=v_lead_id and id<>v_quote_id and status in ('draft','sent')
  ) then raise exception 'Este lead ya tiene un presupuesto borrador o pendiente. Actualiza ese presupuesto en lugar de crear un duplicado.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'El presupuesto necesita al menos una linea.'; end if;

  select * into v_existing from public.quotes where id = v_quote_id;
  perform public.assert_property_relation_for_write(
    v_client_id, v_property_id, v_existing.client_id, v_existing.property_id, v_existing.created_at, 'presupuesto'
  );

  if exists (select 1 from jsonb_to_recordset(p_lines) as line(concept text, quantity numeric, unit_price numeric, line_subtotal numeric)
    where nullif(trim(coalesce(line.concept, '')), '') is null or length(trim(line.concept)) > 120
      or line.quantity is null or line.quantity <= 0 or line.unit_price is null or line.line_subtotal is null) then
    raise exception 'Las lineas del presupuesto contienen conceptos o importes no validos.';
  end if;

  insert into public.quotes (id, client_id, lead_id, property_id, status, subtotal, tax_amount, total, notes, internal_notes, pricing_metadata)
  values (v_quote_id, v_client_id, v_lead_id, v_property_id, v_status, coalesce((p_quote ->> 'subtotal')::numeric,0),
    (p_quote ->> 'tax_amount')::numeric, coalesce((p_quote ->> 'total')::numeric,0), nullif(p_quote ->> 'notes',''),
    nullif(p_quote ->> 'internal_notes',''), coalesce(p_quote -> 'pricing_metadata','{}'::jsonb))
  on conflict (id) do update set client_id=excluded.client_id, lead_id=excluded.lead_id, property_id=excluded.property_id,
    status=excluded.status, subtotal=excluded.subtotal, tax_amount=excluded.tax_amount, total=excluded.total,
    notes=excluded.notes, internal_notes=excluded.internal_notes, pricing_metadata=excluded.pricing_metadata;
  delete from public.quote_lines where quote_id=v_quote_id;
  insert into public.quote_lines (id, quote_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
  select nullif(line.id,''), v_quote_id, line.sort_order, public.simplify_billing_concept(line.concept), line.quantity,
    coalesce(nullif(trim(line.unit),''),'servicio'), line.unit_price, line.line_subtotal
  from jsonb_to_recordset(p_lines) as line(id text, sort_order integer, concept text, quantity numeric, unit text, unit_price numeric, line_subtotal numeric);
end;
$$;

create or replace function public.validate_invoice_relationships()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job record;
  v_quote record;
begin
  if new.job_id is not null then
    select client_id, property_id, quote_id into v_job from public.jobs where id = new.job_id;
    if not found then raise exception 'El servicio indicado para la factura no existe.'; end if;
    if new.client_id is distinct from v_job.client_id then raise exception 'La factura y el servicio deben pertenecer al mismo cliente.'; end if;
    if new.property_id is not null and new.property_id is distinct from v_job.property_id then raise exception 'La propiedad de la factura no coincide con la propiedad del servicio.'; end if;
  end if;

  perform public.assert_property_relation_for_write(
    new.client_id,
    new.property_id,
    case when tg_op = 'UPDATE' then old.client_id else null end,
    case when tg_op = 'UPDATE' then old.property_id else null end,
    case when tg_op = 'UPDATE' then old.created_at else null end,
    'factura'
  );

  if new.quote_id is not null then
    select client_id, property_id into v_quote from public.quotes where id = new.quote_id;
    if not found then raise exception 'El presupuesto indicado para la factura no existe.'; end if;
    if v_quote.client_id is not null and new.client_id is distinct from v_quote.client_id then raise exception 'La factura y el presupuesto deben pertenecer al mismo cliente.'; end if;
    if new.property_id is not null and v_quote.property_id is not null and new.property_id is distinct from v_quote.property_id then raise exception 'La propiedad de la factura no coincide con la del presupuesto.'; end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.assert_property_relation_for_write(text,text,text,text,timestamptz,text) from public, anon, authenticated;
revoke execute on function public.save_job_with_lines(jsonb,jsonb) from public, anon;
grant execute on function public.save_job_with_lines(jsonb,jsonb) to authenticated;
revoke execute on function public.save_quote_with_lines(jsonb,jsonb) from public, anon;
grant execute on function public.save_quote_with_lines(jsonb,jsonb) to authenticated;

commit;
