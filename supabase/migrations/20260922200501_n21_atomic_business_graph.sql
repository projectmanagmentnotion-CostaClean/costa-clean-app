begin;

-- N2.1 owns only the modern invoice -> service graph. Historical rows are not
-- backfilled and the legacy relation migrations are intentionally not replayed.
alter table public.jobs
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create index if not exists jobs_source_invoice_idx
  on public.jobs ((source_metadata ->> 'source'), (source_metadata ->> 'source_invoice_id'));

create table if not exists public.invoice_business_operations (
  operation_key text primary key,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_settlement_operations (
  operation_key text primary key,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.invoice_business_operations enable row level security;
alter table public.invoice_settlement_operations enable row level security;
revoke all on public.invoice_business_operations from public, anon, authenticated;
revoke all on public.invoice_settlement_operations from public, anon, authenticated;

create or replace function public.save_invoice_business_graph(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_invoice jsonb := coalesce(p_request -> 'invoice', '{}'::jsonb);
  v_lines jsonb := coalesce(p_request -> 'lines', '[]'::jsonb);
  v_operation_key text := nullif(trim(p_request ->> 'operation_key'), '');
  v_origin text := coalesce(nullif(trim(p_request ->> 'service_origin'), ''), 'AUTO_CREATE');
  v_invoice_id text := nullif(v_invoice ->> 'id', '');
  v_client_id text := nullif(v_invoice ->> 'client_id', '');
  v_property_id text := nullif(v_invoice ->> 'property_id', '');
  v_quote_id text := nullif(v_invoice ->> 'quote_id', '');
  v_job_id text := nullif(v_invoice ->> 'job_id', '');
  v_service_date date := coalesce(nullif(p_request ->> 'service_date', '')::date, nullif(v_invoice ->> 'issue_date', '')::date);
  v_existing_job record;
  v_quote record;
  v_operation record;
  v_result jsonb;
  v_created_job_id text;
  v_job_count integer := 0;
  v_inserted integer := 0;
  v_line jsonb;
begin
  perform public.require_authenticated_financial_write();

  if v_operation_key is null then raise exception 'La factura necesita clave de operacion.'; end if;
  if v_invoice_id is null then raise exception 'La factura necesita identificador.'; end if;
  if v_client_id is null then raise exception 'La factura necesita cliente.'; end if;
  if v_property_id is null then raise exception 'La factura necesita inmueble para crear el grafo operativo.'; end if;
  if v_service_date is null then raise exception 'La factura necesita fecha de servicio o emision.'; end if;
  if v_origin not in ('AUTO_CREATE', 'EXISTING_JOB', 'FROM_QUOTE') then raise exception 'Origen de servicio no valido.'; end if;
  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) = 0 then raise exception 'La factura necesita al menos una linea.'; end if;

  insert into public.invoice_business_operations(operation_key, payload)
  values (v_operation_key, p_request)
  on conflict (operation_key) do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_operation
  from public.invoice_business_operations
  where operation_key = v_operation_key
  for update;

  if v_inserted = 0 then
    if v_operation.payload is distinct from p_request then
      raise exception 'La clave de operacion ya existe con un payload distinto.';
    end if;
    if v_operation.result is not null then return v_operation.result; end if;
  end if;

  if not exists (select 1 from public.clients c where c.id = v_client_id and c.deleted_at is null and c.archived_at is null) then
    raise exception 'El cliente no existe o no esta activo.';
  end if;
  if not exists (select 1 from public.properties p where p.id = v_property_id and p.client_id = v_client_id and p.deleted_at is null and p.archived_at is null) then
    raise exception 'El inmueble no pertenece al cliente o no esta activo.';
  end if;

  if v_quote_id is not null then
    select q.* into v_quote from public.quotes q where q.id = v_quote_id and q.deleted_at is null and q.archived_at is null;
    if not found then raise exception 'El presupuesto de origen no existe o no esta activo.'; end if;
    if v_quote.client_id is distinct from v_client_id then raise exception 'El presupuesto no pertenece al cliente de la factura.'; end if;
    if v_quote.property_id is not null and v_quote.property_id is distinct from v_property_id then raise exception 'El presupuesto no pertenece al inmueble de la factura.'; end if;
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) as line(concept text, quantity numeric, unit_price numeric, line_subtotal numeric)
    where nullif(trim(coalesce(line.concept, '')), '') is null
       or line.quantity is null or line.quantity <= 0
       or line.unit_price is null or line.unit_price < 0
       or line.line_subtotal is null or line.line_subtotal < 0
  ) then raise exception 'Las lineas de la factura contienen importes no validos.'; end if;

  if v_origin = 'EXISTING_JOB' then
    if v_job_id is null then raise exception 'Selecciona un servicio existente.'; end if;
    select j.* into v_existing_job from public.jobs j where j.id = v_job_id;
    if not found then raise exception 'El servicio indicado no existe.'; end if;
    if v_existing_job.client_id is distinct from v_client_id or v_existing_job.property_id is distinct from v_property_id then
      raise exception 'El servicio no coincide con cliente e inmueble de la factura.';
    end if;
    if v_existing_job.deleted_at is not null or v_existing_job.archived_at is not null or v_existing_job.cancelled_at is not null or v_existing_job.status in ('cancelled', 'completed') then
      raise exception 'El servicio indicado no esta disponible para vincular.';
    end if;
    if v_quote_id is not null and v_existing_job.quote_id is not null and v_existing_job.quote_id is distinct from v_quote_id then
      raise exception 'El servicio no es compatible con el presupuesto.';
    end if;
  elsif v_origin = 'FROM_QUOTE' then
    if v_quote_id is null then raise exception 'Selecciona un presupuesto de origen.'; end if;
    select count(*) into v_job_count from public.jobs j
    where j.quote_id = v_quote_id and j.client_id = v_client_id and j.property_id = v_property_id
      and j.deleted_at is null and j.archived_at is null and j.cancelled_at is null and j.status not in ('cancelled', 'completed');
    if v_job_count > 1 then raise exception 'El presupuesto tiene varios servicios compatibles. Selecciona uno explicitamente.'; end if;
    if v_job_count = 1 then
      select j.id into v_job_id from public.jobs j
      where j.quote_id = v_quote_id and j.client_id = v_client_id and j.property_id = v_property_id
        and j.deleted_at is null and j.archived_at is null and j.cancelled_at is null and j.status not in ('cancelled', 'completed')
      order by j.created_at, j.id limit 1;
    end if;
  end if;

  if v_origin = 'AUTO_CREATE' or (v_origin = 'FROM_QUOTE' and v_job_id is null) then
    v_created_job_id := 'JOB-' || gen_random_uuid()::text;
    insert into public.jobs (
      id, client_id, property_id, quote_id, scheduled_date, status, service_type,
      billing_concept, billing_quantity, billing_unit, billing_unit_price, notes, source_metadata
    )
    values (
      v_created_job_id, v_client_id, v_property_id, v_quote_id, v_service_date, 'scheduled', 'standard_cleaning',
      nullif(v_lines -> 0 ->> 'concept', ''), coalesce((v_lines -> 0 ->> 'quantity')::numeric, 1),
      coalesce(nullif(v_lines -> 0 ->> 'unit', ''), 'servicio'), (v_lines -> 0 ->> 'unit_price')::numeric,
      nullif(v_invoice ->> 'notes', ''), jsonb_build_object('source', 'invoice_auto_service', 'source_invoice_id', v_invoice_id, 'operation_key', v_operation_key)
    );
    v_job_id := v_created_job_id;
    for v_line in select * from jsonb_array_elements(v_lines) loop
      insert into public.job_lines(id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
      values (
        'JOB-LINE-' || gen_random_uuid()::text, v_job_id,
        coalesce((v_line ->> 'sort_order')::integer, 0) + 1,
        trim(v_line ->> 'concept'), (v_line ->> 'quantity')::numeric,
        coalesce(nullif(trim(v_line ->> 'unit'), ''), 'servicio'),
        (v_line ->> 'unit_price')::numeric, (v_line ->> 'line_subtotal')::numeric
      );
    end loop;
  end if;

  v_invoice := v_invoice || jsonb_build_object(
    'job_id', v_job_id,
    'quote_id', v_quote_id,
    'property_id', v_property_id,
    'pricing_metadata', coalesce(v_invoice -> 'pricing_metadata', '{}'::jsonb) || jsonb_build_object(
      'n21_business_graph', jsonb_build_object('service_origin', v_origin, 'operation_key', v_operation_key, 'service_date', v_service_date)
    )
  );

  perform public.save_invoice_with_lines_v2(v_invoice, v_lines);

  v_result := jsonb_build_object('invoice_id', v_invoice_id, 'job_id', v_job_id, 'quote_id', v_quote_id, 'service_origin', v_origin, 'operation_key', v_operation_key);
  update public.invoice_business_operations set result = v_result where operation_key = v_operation_key;
  return v_result;
end;
$$;

create or replace function public.settle_invoice_business(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_operation_key text := nullif(trim(p_request ->> 'operation_key'), '');
  v_invoice_id text := nullif(trim(p_request ->> 'invoice_id'), '');
  v_payment_method text := coalesce(nullif(trim(p_request ->> 'payment_method'), ''), 'transfer');
  v_payment_date date := coalesce(nullif(p_request ->> 'payment_date', '')::date, current_date);
  v_operation record;
  v_invoice record;
  v_paid numeric := 0;
  v_outstanding numeric := 0;
  v_paid_after numeric := 0;
  v_payment_id text;
  v_result jsonb;
  v_inserted integer := 0;
begin
  perform public.require_authenticated_financial_write();
  if v_operation_key is null or v_invoice_id is null then raise exception 'El cobro necesita factura y clave de operacion.'; end if;

  insert into public.invoice_settlement_operations(operation_key, payload)
  values (v_operation_key, p_request)
  on conflict (operation_key) do nothing;
  get diagnostics v_inserted = row_count;
  select * into v_operation from public.invoice_settlement_operations where operation_key = v_operation_key for update;
  if v_inserted = 0 then
    if v_operation.payload is distinct from p_request then raise exception 'La clave de cobro ya existe con un payload distinto.'; end if;
    if v_operation.result is not null then return v_operation.result; end if;
  end if;

  select id, total, status into v_invoice from public.invoices where id = v_invoice_id for update;
  if not found then raise exception 'No se encontro la factura indicada.'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'No se puede cobrar una factura cancelada.'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = v_invoice_id and cancelled_at is null and deleted_at is null;
  v_outstanding := greatest(coalesce(v_invoice.total, 0) - v_paid, 0);
  if v_outstanding <= 0.009 then
    v_result := jsonb_build_object('payment_id', null, 'invoice_id', v_invoice_id, 'created_payment', false, 'outstanding_before', 0, 'paid_total_after', v_paid, 'outstanding_after', 0, 'financial_status', 'paid');
  else
    v_payment_id := 'PAYMENT-' || gen_random_uuid()::text;
    insert into public.payments(id, invoice_id, payment_date, amount, payment_method, origin_type, notes)
    values (v_payment_id, v_invoice_id, v_payment_date, v_outstanding, v_payment_method, 'settlement_auto', 'Cobro automatico N2.1 por saldo pendiente.');
    perform public.refresh_invoice_payment_status(v_invoice_id);
    select coalesce(sum(amount), 0) into v_paid_after from public.payments where invoice_id = v_invoice_id and cancelled_at is null and deleted_at is null;
    v_result := jsonb_build_object('payment_id', v_payment_id, 'invoice_id', v_invoice_id, 'created_payment', true, 'outstanding_before', v_outstanding, 'paid_total_after', v_paid_after, 'outstanding_after', greatest(coalesce(v_invoice.total, 0) - v_paid_after, 0), 'financial_status', case when v_paid_after >= coalesce(v_invoice.total, 0) - 0.009 then 'paid' when v_paid_after > 0.009 then 'partially_paid' else 'pending' end);
  end if;
  update public.invoice_settlement_operations set result = v_result where operation_key = v_operation_key;
  return v_result;
end;
$$;

revoke all on function public.save_invoice_business_graph(jsonb) from public, anon;
grant execute on function public.save_invoice_business_graph(jsonb) to authenticated;
revoke all on function public.settle_invoice_business(jsonb) from public, anon;
grant execute on function public.settle_invoice_business(jsonb) to authenticated;

commit;
