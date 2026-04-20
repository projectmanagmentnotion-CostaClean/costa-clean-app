-- Lead-owned quotes and transactional quote acceptance workflow.
-- Quotes can belong to a lead before there is a client. Acceptance converts the lead.

alter table public.leads
  add column if not exists converted_client_id text,
  add column if not exists converted_at timestamptz;

alter table public.quotes
  add column if not exists lead_id text;

alter table public.quotes
  alter column client_id drop not null;

alter table public.invoices
  add column if not exists quote_id text;

create index if not exists quotes_lead_id_idx on public.quotes (lead_id);
create index if not exists quotes_client_id_idx on public.quotes (client_id);
create index if not exists invoices_quote_id_idx on public.invoices (quote_id);
create index if not exists leads_converted_client_id_idx on public.leads (converted_client_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_client_or_lead_required_check'
  ) then
    alter table public.quotes
      add constraint quotes_client_or_lead_required_check
      check (client_id is not null or lead_id is not null);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_converted_client_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_converted_client_id_fkey
      foreign key (converted_client_id) references public.clients(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'quotes_lead_id_fkey'
  ) then
    alter table public.quotes
      add constraint quotes_lead_id_fkey
      foreign key (lead_id) references public.leads(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'invoices_quote_id_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_quote_id_fkey
      foreign key (quote_id) references public.quotes(id)
      on delete set null
      not valid;
  end if;
end;
$$;

create or replace function public.simplify_billing_concept(p_concept text)
returns text
language plpgsql
immutable
as $$
declare
  v_text text := lower(coalesce(p_concept, ''));
begin
  if nullif(trim(coalesce(p_concept, '')), '') is null then
    return 'Servicio de limpieza';
  end if;

  if v_text like '%descuento%' or v_text like '%discount%' then
    return 'Descuento aplicado';
  end if;

  if v_text like '%ropa de cama%' or v_text like '%linen%' or v_text like '%sabana%' then
    return 'Cambio de ropa de cama';
  end if;

  if v_text like '%terraza%' or v_text like '%terrace%' or v_text like '%balcon%' then
    return 'Suplemento terraza';
  end if;

  if v_text like '%jardin%' or v_text like '%garden%' then
    return 'Suplemento jardin';
  end if;

  if v_text like '%habitacion%' or v_text like '%room%' then
    return 'Suplemento habitaciones adicionales';
  end if;

  if v_text like '%bano%' or v_text like '%bath%' then
    return 'Suplemento banos adicionales';
  end if;

  if v_text like '%urgente%' or v_text like '%urgent%' then
    return 'Servicio urgente';
  end if;

  if v_text like '%cristal%' or v_text like '%ventana%' or v_text like '%window%' then
    return 'Limpieza de cristales';
  end if;

  if v_text like '%profunda%' or v_text like '%deep%' then
    return 'Limpieza profunda de vivienda';
  end if;

  if v_text like '%turist%' or v_text like '%airbnb%' or v_text like '%huesped%' then
    return 'Limpieza turistica de apartamento';
  end if;

  if v_text like '%obra%' or v_text like '%construction%' then
    return 'Limpieza post-obra de piso';
  end if;

  if v_text like '%gimnasio%' or v_text like '%gym%' then
    return 'Servicio de limpieza de gimnasio';
  end if;

  if v_text like '%limpieza%' then
    return 'Servicio de limpieza';
  end if;

  return left(trim(p_concept), 80);
end;
$$;

create or replace function public.convert_lead_to_client(
  p_lead_id text,
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead record;
  v_client record;
  v_client_id text;
  v_action text := 'already_converted';
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_lead_id, '') is null then
    raise exception 'El lead es obligatorio para convertir a cliente.';
  end if;

  select id, full_name, phone, email, status, converted_client_id
  into v_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'No se encontro el lead indicado.';
  end if;

  if v_lead.converted_client_id is not null then
    v_client_id := v_lead.converted_client_id;
  else
    select id, status, source_lead_id
    into v_client
    from public.clients
    where source_lead_id = p_lead_id
    limit 1
    for update;

    if found then
      v_client_id := v_client.id;
      v_action := 'linked_existing';
      update public.clients
      set status = 'active'
      where id = v_client_id
        and status is distinct from 'active';
    elsif nullif(p_client_id, '') is not null then
      select id, status, source_lead_id
      into v_client
      from public.clients
      where id = p_client_id
      for update;

      if found then
        v_client_id := v_client.id;
        v_action := 'linked_existing';

        update public.clients
        set
          status = 'active',
          source_lead_id = coalesce(source_lead_id, p_lead_id)
        where id = v_client_id;
      else
        v_client_id := p_client_id;
        v_action := 'created';

        insert into public.clients (
          id,
          full_name,
          phone,
          email,
          status,
          source_lead_id
        )
        values (
          v_client_id,
          v_lead.full_name,
          v_lead.phone,
          v_lead.email,
          'active',
          v_lead.id
        );
      end if;
    else
      v_client_id := 'CLIENT-' || gen_random_uuid()::text;
      v_action := 'created';

      insert into public.clients (
        id,
        full_name,
        phone,
        email,
        status,
        source_lead_id
      )
      values (
        v_client_id,
        v_lead.full_name,
        v_lead.phone,
        v_lead.email,
        'active',
        v_lead.id
      );
    end if;
  end if;

  update public.clients
  set
    status = 'active',
    source_lead_id = coalesce(source_lead_id, p_lead_id)
  where id = v_client_id;

  update public.leads
  set
    status = 'won',
    archived_at = coalesce(archived_at, now()),
    converted_client_id = v_client_id,
    converted_at = coalesce(converted_at, now())
  where id = p_lead_id;

  update public.quotes
  set client_id = v_client_id
  where lead_id = p_lead_id
    and client_id is null;

  return jsonb_build_object(
    'client_id', v_client_id,
    'lead_id', p_lead_id,
    'client_action', v_action
  );
end;
$$;

create or replace function public.save_quote_with_lines(
  p_quote jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id text := nullif(p_quote ->> 'id', '');
  v_client_id text := nullif(p_quote ->> 'client_id', '');
  v_lead_id text := nullif(p_quote ->> 'lead_id', '');
begin
  perform public.require_authenticated_financial_write();

  if v_quote_id is null then
    raise exception 'El presupuesto necesita identificador.';
  end if;

  if v_client_id is null and v_lead_id is null then
    raise exception 'El presupuesto necesita cliente o lead.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El presupuesto necesita al menos una linea.';
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
      or length(trim(line.concept)) > 120
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.line_subtotal is null
  ) then
    raise exception 'Las lineas del presupuesto contienen conceptos o importes no validos.';
  end if;

  insert into public.quotes (
    id,
    client_id,
    lead_id,
    property_id,
    status,
    subtotal,
    tax_amount,
    total,
    notes
  )
  values (
    v_quote_id,
    v_client_id,
    v_lead_id,
    nullif(p_quote ->> 'property_id', ''),
    coalesce(nullif(p_quote ->> 'status', ''), 'draft'),
    coalesce((p_quote ->> 'subtotal')::numeric, 0),
    (p_quote ->> 'tax_amount')::numeric,
    coalesce((p_quote ->> 'total')::numeric, 0),
    nullif(p_quote ->> 'notes', '')
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    lead_id = excluded.lead_id,
    property_id = excluded.property_id,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes;

  delete from public.quote_lines
  where quote_id = v_quote_id;

  insert into public.quote_lines (
    id,
    quote_id,
    sort_order,
    concept,
    quantity,
    unit,
    unit_price,
    line_subtotal
  )
  select
    nullif(line.id, ''),
    v_quote_id,
    line.sort_order,
    public.simplify_billing_concept(line.concept),
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

create or replace function public.save_invoice_with_lines(
  p_invoice jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_id text := nullif(p_invoice ->> 'id', '');
begin
  perform public.require_authenticated_financial_write();

  if v_invoice_id is null then
    raise exception 'La factura necesita identificador.';
  end if;

  if nullif(p_invoice ->> 'client_id', '') is null then
    raise exception 'La factura necesita cliente.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La factura necesita al menos una linea.';
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
      or length(trim(line.concept)) > 120
      or line.quantity is null
      or line.quantity <= 0
      or line.unit_price is null
      or line.line_subtotal is null
  ) then
    raise exception 'Las lineas de la factura contienen conceptos o importes no validos.';
  end if;

  insert into public.invoices (
    id,
    job_id,
    quote_id,
    client_id,
    issue_date,
    status,
    subtotal,
    tax_amount,
    total,
    notes
  )
  values (
    v_invoice_id,
    nullif(p_invoice ->> 'job_id', ''),
    nullif(p_invoice ->> 'quote_id', ''),
    nullif(p_invoice ->> 'client_id', ''),
    (p_invoice ->> 'issue_date')::date,
    coalesce(nullif(p_invoice ->> 'status', ''), 'draft'),
    coalesce((p_invoice ->> 'subtotal')::numeric, 0),
    coalesce((p_invoice ->> 'tax_amount')::numeric, 0),
    coalesce((p_invoice ->> 'total')::numeric, 0),
    nullif(p_invoice ->> 'notes', '')
  )
  on conflict (id) do update set
    job_id = excluded.job_id,
    quote_id = excluded.quote_id,
    client_id = excluded.client_id,
    issue_date = excluded.issue_date,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes;

  delete from public.invoice_lines
  where invoice_id = v_invoice_id;

  insert into public.invoice_lines (
    id,
    invoice_id,
    sort_order,
    concept,
    quantity,
    unit,
    unit_price,
    line_subtotal
  )
  select
    nullif(line.id, ''),
    v_invoice_id,
    line.sort_order,
    public.simplify_billing_concept(line.concept),
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

create or replace function public.accept_quote_workflow(
  p_quote_id text,
  p_create_invoice boolean default false,
  p_invoice_id text default null,
  p_issue_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote record;
  v_conversion jsonb;
  v_client_id text;
  v_invoice_id text := null;
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_quote_id, '') is null then
    raise exception 'El presupuesto es obligatorio.';
  end if;

  select id, display_code, client_id, lead_id, subtotal, tax_amount, total, notes, status
  into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'No se encontro el presupuesto indicado.';
  end if;

  if v_quote.client_id is null then
    if v_quote.lead_id is null then
      raise exception 'El presupuesto no tiene cliente ni lead para aceptar.';
    end if;

    v_conversion := public.convert_lead_to_client(v_quote.lead_id, null);
    v_client_id := v_conversion ->> 'client_id';
  else
    v_client_id := v_quote.client_id;

    if v_quote.lead_id is not null then
      v_conversion := public.convert_lead_to_client(v_quote.lead_id, v_client_id);
    else
      v_conversion := jsonb_build_object(
        'client_id', v_client_id,
        'lead_id', null,
        'client_action', 'already_client_quote'
      );
    end if;
  end if;

  update public.quotes
  set status = 'accepted',
      client_id = v_client_id
  where id = v_quote.id;

  if p_create_invoice then
    v_invoice_id := coalesce(nullif(p_invoice_id, ''), 'INVOICE-' || gen_random_uuid()::text);

    if exists (
      select 1 from public.invoices where quote_id = v_quote.id and status <> 'cancelled'
    ) then
      raise exception 'Este presupuesto ya tiene una factura activa vinculada.';
    end if;

    insert into public.invoices (
      id,
      job_id,
      quote_id,
      client_id,
      issue_date,
      status,
      subtotal,
      tax_amount,
      total,
      notes
    )
    values (
      v_invoice_id,
      (
        select id
        from public.jobs
        where quote_id = v_quote.id
        order by created_at desc
        limit 1
      ),
      v_quote.id,
      v_client_id,
      p_issue_date,
      'issued',
      v_quote.subtotal,
      coalesce(v_quote.tax_amount, 0),
      v_quote.total,
      concat_ws(E'\n\n',
        'Factura creada automaticamente al aceptar presupuesto ' || coalesce(v_quote.display_code, v_quote.id) || '.',
        case when v_quote.lead_id is not null then 'Lead convertido: ' || v_quote.lead_id || '.' end,
        nullif(v_quote.notes, '')
      )
    );

    insert into public.invoice_lines (
      id,
      invoice_id,
      sort_order,
      public.simplify_billing_concept(concept),
      quantity,
      unit,
      unit_price,
      line_subtotal
    )
    select
      'INVOICE-LINE-' || gen_random_uuid()::text,
      v_invoice_id,
      sort_order,
      concept,
      quantity,
      unit,
      unit_price,
      line_subtotal
    from public.quote_lines
    where quote_id = v_quote.id
    order by sort_order;

    if not found then
      raise exception 'El presupuesto necesita lineas para crear factura.';
    end if;
  end if;

  return jsonb_build_object(
    'quote_id', v_quote.id,
    'lead_id', v_quote.lead_id,
    'client_id', v_client_id,
    'invoice_id', v_invoice_id,
    'created_invoice', p_create_invoice,
    'client_action', v_conversion ->> 'client_action'
  );
end;
$$;

revoke execute on function public.convert_lead_to_client(text, text) from public, anon;
revoke execute on function public.accept_quote_workflow(text, boolean, text, date) from public, anon;
grant execute on function public.convert_lead_to_client(text, text) to authenticated;
grant execute on function public.accept_quote_workflow(text, boolean, text, date) to authenticated;
