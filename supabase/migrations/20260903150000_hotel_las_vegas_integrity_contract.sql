begin;

-- Extend the existing audit contract so property corrections are first-class events.
alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check;
alter table public.audit_events
  add constraint audit_events_entity_type_check
  check (entity_type = any (array['lead','quote','invoice','payment','expense','property']::text[]));

alter table public.audit_events
  drop constraint if exists audit_events_action_check;
alter table public.audit_events
  add constraint audit_events_action_check
  check (action = any (array['upsert','status_update','convert_to_client','accept','accept_and_invoice','attachment_update','fiscal_analysis','correction']::text[]));

do $$
declare
  v_property public.properties%rowtype;
  v_costa_id text := 'CLIENT-1205d188-381c-4596-98b7-1fbb41e74ac6';
  v_miguel_id text := 'CLIENT-ce422d17-eafb-46d0-93d4-6a80cba7f67d';
  v_property_id text := 'PROPERTY-99a56b8c-96e2-496a-ac81-4c9f56414628';
  v_job_count integer;
  v_quote_count integer;
  v_invoice_count integer;
begin
  select * into v_property
  from public.properties
  where id = v_property_id
    and display_code = 'PRO-0018'
    and name = 'Hotel Las Vegas'
    and address ilike '%Carrer de Sant Jaume, 77%'
    and city = 'Calella'
    and postal_code = '08370'
  for update;

  if not found then
    raise exception 'Precheck failed: Hotel Las Vegas / PRO-0018 does not match the authorized property.';
  end if;

  if v_property.client_id is distinct from v_miguel_id then
    raise exception 'Precheck failed: property owner is no longer Miguel Da Costa.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = v_costa_id
      and full_name = 'COSTA DEL MARESME HOSPITALITY MNG, S.L'
      and tax_id = 'B24859803'
  ) then
    raise exception 'Precheck failed: Costa del Maresme client does not match.';
  end if;

  select count(*) into v_job_count
  from public.jobs j
  where j.display_code = 'JOB-0085'
    and j.client_id = v_costa_id
    and j.property_id = v_property_id;
  if v_job_count <> 1 then
    raise exception 'Precheck failed: JOB-0085 relationship changed.';
  end if;

  select count(*) into v_quote_count
  from public.quotes q
  where q.display_code = 'QUO-0056'
    and q.client_id = v_costa_id
    and q.property_id = v_property_id;
  if v_quote_count <> 1 then
    raise exception 'Precheck failed: QUO-0056 relationship changed.';
  end if;

  select count(*) into v_invoice_count
  from public.invoices i
  where i.display_code = 'INV-0069'
    and i.client_id = v_costa_id
    and i.property_id = v_property_id;
  if v_invoice_count <> 1 then
    raise exception 'Precheck failed: INV-0069 relationship changed.';
  end if;

  update public.properties
  set client_id = v_costa_id
  where id = v_property_id;

  insert into public.audit_events (
    id, entity_type, entity_id, action, changed_fields,
    previous_values, new_values, metadata, changed_by
  ) values (
    gen_random_uuid(),
    'property',
    v_property_id,
    'correction',
    array['client_id'],
    jsonb_build_object('client_id', v_miguel_id, 'client_name', 'Miguel Da Costa'),
    jsonb_build_object('client_id', v_costa_id, 'client_name', 'COSTA DEL MARESME HOSPITALITY MNG, S.L'),
    jsonb_build_object(
      'reason', 'Corrección empresarial confirmada: Hotel Las Vegas (PRO-0018) pertenece a Costa del Maresme Hospitality MNG, S.L.; la asociación con Miguel Da Costa era incorrecta.',
      'property_display_code', 'PRO-0018'
    ),
    null
  );
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
begin
  perform public.require_authenticated_financial_write();
  if v_job_id is null then raise exception 'El servicio necesita identificador.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'El servicio necesita al menos una linea.'; end if;
  if v_client_id is not null and v_property_id is not null and not exists (
    select 1 from public.properties where id = v_property_id and client_id = v_client_id
  ) then
    raise exception 'La propiedad no pertenece al cliente del servicio.';
  end if;
  if p_job ->> 'quote_id' is not null and nullif(p_job ->> 'quote_id', '') is not null and v_client_id is not null and not exists (
    select 1 from public.quotes where id = p_job ->> 'quote_id' and client_id = v_client_id
  ) then
    raise exception 'El presupuesto no pertenece al cliente del servicio.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_lines) as line(concept text, quantity numeric, unit_price numeric, line_subtotal numeric)
    where nullif(trim(coalesce(line.concept, '')), '') is null or line.quantity is null or line.quantity <= 0
      or line.unit_price is null or line.unit_price < 0 or line.line_subtotal is null or line.line_subtotal < 0) then
    raise exception 'Las lineas del servicio contienen importes no validos.';
  end if;
  insert into public.jobs (id, client_id, property_id, quote_id, scheduled_date, status, service_type, billing_concept, billing_quantity, billing_unit, billing_unit_price, notes)
  values (v_job_id, v_client_id, v_property_id, nullif(p_job ->> 'quote_id', ''), (p_job ->> 'scheduled_date')::date,
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
begin
  perform public.require_authenticated_financial_write();
  if v_quote_id is null then raise exception 'El presupuesto necesita identificador.'; end if;
  if v_client_id is null and v_lead_id is null then raise exception 'El presupuesto necesita cliente o lead.'; end if;
  if v_client_id is not null and v_property_id is not null and not exists (
    select 1 from public.properties where id = v_property_id and client_id = v_client_id
  ) then
    raise exception 'La propiedad no pertenece al cliente del presupuesto.';
  end if;
  if v_lead_id is not null and v_status in ('draft', 'sent') and exists (
    select 1 from public.quotes where lead_id=v_lead_id and id<>v_quote_id and status in ('draft','sent')
  ) then raise exception 'Este lead ya tiene un presupuesto borrador o pendiente. Actualiza ese presupuesto en lugar de crear un duplicado.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'El presupuesto necesita al menos una linea.'; end if;
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

revoke execute on function public.save_job_with_lines(jsonb, jsonb) from public, anon;
grant execute on function public.save_job_with_lines(jsonb, jsonb) to authenticated;
revoke execute on function public.save_quote_with_lines(jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_with_lines(jsonb, jsonb) to authenticated;

commit;
