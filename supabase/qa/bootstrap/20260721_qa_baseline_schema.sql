-- CostaClean QA schema baseline - reviewed 2026-07-21.
-- Source: authorized production public schema-only export via pg_dump 17.10.
-- Contains no table rows, production sequence state, owners, ACLs, or secrets.
-- QA-only baseline: do not apply to production.
-- public.save_invoice_with_lines(jsonb, jsonb) is supplied by the earlier
-- 20260707 reviewed migration and is intentionally not duplicated here.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: accept_quote_workflow(text, boolean, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_quote_workflow(p_quote_id text, p_create_invoice boolean DEFAULT false, p_invoice_id text DEFAULT NULL::text, p_issue_date date DEFAULT CURRENT_DATE) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_quote record;
  v_conversion jsonb;
  v_client_id text;
  v_invoice_id text := null;
begin
  perform public.require_authenticated_financial_write();

  select id, display_code, client_id, lead_id, subtotal, tax_amount, total, internal_notes, pricing_metadata, status
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

    perform public.assert_invoice_numbering_regular(extract(year from p_issue_date)::integer, v_invoice_id);

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
      notes,
      internal_notes,
      pricing_metadata
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
      'Servicio realizado segun presupuesto aprobado.' || E'\n' ||
      'Condiciones economicas aplicadas segun presupuesto aceptado.' || E'\n' ||
      'Precios sin IVA.',
      concat_ws(E'\n\n',
        'Factura creada automaticamente desde presupuesto aceptado.',
        nullif(v_quote.internal_notes, '')
      ),
      public.ensure_invoice_pricing_metadata(
        coalesce(v_quote.pricing_metadata, '{}'::jsonb) || jsonb_build_object(
          'source_quote_id', v_quote.id,
          'accepted_invoice_created_at', now()
        ),
        v_client_id,
        'client_backfill'
      )
    );

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
      'INVOICE-LINE-' || gen_random_uuid()::text,
      v_invoice_id,
      sort_order,
      public.simplify_billing_concept(concept),
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

    perform public.refresh_invoice_payment_status(v_invoice_id);
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


--
-- Name: assert_invoice_numbering_regular(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_invoice_numbering_regular(p_year integer, p_exclude_invoice_id text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_gap_from integer;
  v_gap_to integer;
begin
  if p_year is null then
    return;
  end if;

  with sequences as (
    select distinct public.extract_invoice_fiscal_sequence(invoice_number, p_year) as seq
    from public.invoices
    where id is distinct from p_exclude_invoice_id
      and public.extract_invoice_fiscal_sequence(invoice_number, p_year) is not null
  ),
  ordered as (
    select
      seq,
      lag(seq) over (order by seq) as prev_seq
    from sequences
  )
  select
    prev_seq + 1,
    seq - 1
  into v_gap_from, v_gap_to
  from ordered
  where prev_seq is not null
    and seq - prev_seq > 1
  order by prev_seq
  limit 1;

  if v_gap_from is null then
    return;
  end if;

  raise exception 'No se puede emitir factura. Hay huecos en la numeracion fiscal: %.',
    case
      when v_gap_from = v_gap_to then public.build_invoice_number(p_year, v_gap_from)
      else public.build_invoice_number(p_year, v_gap_from) || ' a ' || public.build_invoice_number(p_year, v_gap_to)
    end;
end;
$$;


--
-- Name: backfill_invoice_fiscal_snapshots(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_invoice_fiscal_snapshots() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_total_invoices integer := 0;
  v_normalized_ids text[] := '{}'::text[];
  v_repaired_ids text[] := '{}'::text[];
  v_blocked_ids text[] := '{}'::text[];
begin
  perform public.require_authenticated_financial_write();

  select count(*)
  into v_total_invoices
  from public.invoices;

  with extracted as (
    select
      i.id,
      (
        select elem
        from jsonb_array_elements(i.pricing_metadata) with ordinality as arr(elem, ord)
        where jsonb_typeof(elem) = 'object'
          and elem ? 'client_fiscal_snapshot'
        order by ord desc
        limit 1
      ) as latest_snapshot_wrapper
    from public.invoices i
    where jsonb_typeof(i.pricing_metadata) = 'array'
  ),
  normalized_arrays as (
    update public.invoices i
    set pricing_metadata =
      case
        when extracted.latest_snapshot_wrapper is not null then extracted.latest_snapshot_wrapper
        else '{}'::jsonb
      end,
      updated_at = now()
    from extracted
    where i.id = extracted.id
    returning i.id
  ),
  normalized_scalars as (
    update public.invoices
    set pricing_metadata = '{}'::jsonb,
      updated_at = now()
    where pricing_metadata is null
       or jsonb_typeof(pricing_metadata) <> 'object'
    returning id
  )
  select coalesce(array_agg(id), '{}'::text[])
  into v_normalized_ids
  from (
    select id from normalized_arrays
    union
    select id from normalized_scalars
  ) as normalized_rows;

  with reparable as (
    select
      i.id,
      coalesce(i.pricing_metadata, '{}'::jsonb) as pricing_metadata,
      c.id as client_id,
      nullif(trim(coalesce(c.full_name, '')), '') as full_name,
      nullif(trim(coalesce(c.tax_id, '')), '') as tax_id,
      nullif(trim(coalesce(c.billing_address, '')), '') as billing_address,
      nullif(trim(coalesce(c.email, '')), '') as email
    from public.invoices i
    join public.clients c
      on c.id = i.client_id
    where not (coalesce(i.pricing_metadata, '{}'::jsonb) ? 'client_fiscal_snapshot')
      and nullif(trim(coalesce(c.full_name, '')), '') is not null
      and nullif(trim(coalesce(c.tax_id, '')), '') is not null
      and nullif(trim(coalesce(c.billing_address, '')), '') is not null
  ),
  updated_rows as (
    update public.invoices i
    set
      pricing_metadata = reparable.pricing_metadata
        || jsonb_build_object(
          'client_fiscal_snapshot',
          jsonb_build_object(
            'client_id', reparable.client_id,
            'name', reparable.full_name,
            'fiscal_name', reparable.full_name,
            'tax_id', reparable.tax_id,
            'billing_address', reparable.billing_address,
            'email', reparable.email,
            'captured_at', now(),
            'source', 'client_backfill'
          ),
          'fiscal_backfilled_at', now(),
          'fiscal_backfill_source', 'client'
        ),
      updated_at = now()
    from reparable
    where i.id = reparable.id
    returning i.id
  )
  select coalesce(array_agg(id), '{}'::text[])
  into v_repaired_ids
  from updated_rows;

  select coalesce(array_agg(i.id), '{}'::text[])
  into v_blocked_ids
  from public.invoices i
  left join public.clients c
    on c.id = i.client_id
  where not (coalesce(i.pricing_metadata, '{}'::jsonb) ? 'client_fiscal_snapshot')
    and (
      c.id is null
      or nullif(trim(coalesce(c.full_name, '')), '') is null
      or nullif(trim(coalesce(c.tax_id, '')), '') is null
      or nullif(trim(coalesce(c.billing_address, '')), '') is null
    );

  return jsonb_build_object(
    'total_invoices', v_total_invoices,
    'normalized', coalesce(array_length(v_normalized_ids, 1), 0),
    'repaired', coalesce(array_length(v_repaired_ids, 1), 0),
    'blocked', coalesce(array_length(v_blocked_ids, 1), 0),
    'failed', 0,
    'normalized_invoice_ids', v_normalized_ids,
    'repaired_invoice_ids', v_repaired_ids,
    'blocked_invoice_ids', v_blocked_ids,
    'failed_invoice_ids', '{}'::text[]
  );
end;
$$;


--
-- Name: build_client_fiscal_snapshot(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_client_fiscal_snapshot(p_client_id text, p_source text DEFAULT 'client_backfill'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_client record;
begin
  if nullif(trim(coalesce(p_client_id, '')), '') is null then
    return null;
  end if;

  select
    id,
    full_name,
    tax_id,
    billing_address,
    email
  into v_client
  from public.clients
  where id = p_client_id;

  if not found then
    return null;
  end if;

  if nullif(trim(coalesce(v_client.full_name, '')), '') is null
    or nullif(trim(coalesce(v_client.tax_id, '')), '') is null
    or nullif(trim(coalesce(v_client.billing_address, '')), '') is null then
    return null;
  end if;

  return jsonb_build_object(
    'client_id', v_client.id,
    'name', v_client.full_name,
    'fiscal_name', v_client.full_name,
    'tax_id', v_client.tax_id,
    'billing_address', v_client.billing_address,
    'email', v_client.email,
    'captured_at', now(),
    'source', p_source
  );
end;
$$;


--
-- Name: build_invoice_display_code(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_invoice_display_code(p_sequence integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select 'INV-' || lpad(p_sequence::text, 4, '0');
$$;


--
-- Name: build_invoice_number(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_invoice_number(p_year integer, p_sequence integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select p_year::text || '-' || lpad(p_sequence::text, 3, '0');
$$;


--
-- Name: convert_lead_to_client(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_lead_to_client(p_lead_id text, p_client_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: ensure_invoice_pricing_metadata(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_invoice_pricing_metadata(p_metadata jsonb, p_client_id text, p_source text DEFAULT 'client_backfill'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_metadata jsonb := case
    when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
      then coalesce(p_metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_snapshot jsonb;
begin
  if jsonb_typeof(v_metadata -> 'client_fiscal_snapshot') = 'object' then
    return v_metadata;
  end if;

  v_snapshot := public.build_client_fiscal_snapshot(p_client_id, p_source);

  if v_snapshot is null then
    return v_metadata;
  end if;

  return v_metadata
    || jsonb_build_object(
      'client_fiscal_snapshot', v_snapshot,
      'fiscal_backfilled_at', now(),
      'fiscal_backfill_source', 'client'
    );
end;
$$;


--
-- Name: expenses_autocalc_amounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expenses_autocalc_amounts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: extract_invoice_display_sequence(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_invoice_display_sequence(p_display_code text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
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
$_$;


--
-- Name: extract_invoice_fiscal_sequence(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_invoice_fiscal_sequence(p_invoice_number text, p_year integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
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
$_$;


--
-- Name: find_first_missing_invoice_sequence(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_first_missing_invoice_sequence(p_year integer, p_exclude_invoice_id text DEFAULT NULL::text) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  with sequences as (
    select distinct public.extract_invoice_fiscal_sequence(invoice_number, p_year) as seq
    from public.invoices
    where id is distinct from p_exclude_invoice_id
      and public.extract_invoice_fiscal_sequence(invoice_number, p_year) is not null
  ),
  max_sequence as (
    select coalesce(max(seq), 0) + 1 as upper_bound
    from sequences
  ),
  candidates as (
    select generate_series(1, (select upper_bound from max_sequence)) as seq
  )
  select coalesce(
    (
      select min(candidates.seq)
      from candidates
      left join sequences on sequences.seq = candidates.seq
      where sequences.seq is null
    ),
    1
  );
$$;


--
-- Name: invoice_status_consumes_fiscal_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoice_status_consumes_fiscal_number(p_status text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_status, '') in ('issued', 'paid', 'cancelled');
$$;


--
-- Name: reassign_property_client(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reassign_property_client(p_property_id text, p_client_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_property record;
  v_previous_client_id text;
  v_updated_jobs integer := 0;
  v_updated_quotes integer := 0;
  v_remaining_completed_jobs integer := 0;
  v_remaining_accepted_quotes integer := 0;
  v_remaining_invoices integer := 0;
begin
  if nullif(p_property_id, '') is null then
    raise exception 'La propiedad es obligatoria.';
  end if;

  if nullif(p_client_id, '') is null then
    raise exception 'El cliente destino es obligatorio.';
  end if;

  select id, client_id, name
  into v_property
  from public.properties
  where id = p_property_id
  for update;

  if not found then
    raise exception 'No se encontrÃ³ la propiedad indicada.';
  end if;

  perform 1
  from public.clients
  where id = p_client_id
  for update;

  if not found then
    raise exception 'No se encontrÃ³ el cliente destino.';
  end if;

  v_previous_client_id := v_property.client_id;

  if v_previous_client_id = p_client_id then
    return jsonb_build_object(
      'property_id', p_property_id,
      'previous_client_id', v_previous_client_id,
      'client_id', p_client_id,
      'updated_jobs', 0,
      'updated_quotes', 0,
      'remaining_completed_jobs', 0,
      'remaining_accepted_quotes', 0,
      'remaining_invoices', 0
    );
  end if;

  update public.jobs
  set client_id = p_client_id
  where property_id = p_property_id
    and client_id = v_previous_client_id
    and status in ('scheduled', 'in_progress', 'cancelled');

  get diagnostics v_updated_jobs = row_count;

  update public.quotes
  set client_id = p_client_id
  where property_id = p_property_id
    and client_id = v_previous_client_id
    and status in ('draft', 'sent', 'rejected', 'expired');

  get diagnostics v_updated_quotes = row_count;

  update public.properties
  set client_id = p_client_id
  where id = p_property_id;

  select count(*)
  into v_remaining_completed_jobs
  from public.jobs
  where property_id = p_property_id
    and client_id = v_previous_client_id
    and status = 'completed';

  select count(*)
  into v_remaining_accepted_quotes
  from public.quotes
  where property_id = p_property_id
    and client_id = v_previous_client_id
    and status = 'accepted';

  select count(*)
  into v_remaining_invoices
  from public.invoices i
  where i.client_id = v_previous_client_id
    and exists (
      select 1
      from public.jobs j
      where j.id = i.job_id
        and j.property_id = p_property_id
    );

  return jsonb_build_object(
    'property_id', p_property_id,
    'previous_client_id', v_previous_client_id,
    'client_id', p_client_id,
    'updated_jobs', v_updated_jobs,
    'updated_quotes', v_updated_quotes,
    'remaining_completed_jobs', v_remaining_completed_jobs,
    'remaining_accepted_quotes', v_remaining_accepted_quotes,
    'remaining_invoices', v_remaining_invoices
  );
end;
$$;


--
-- Name: record_audit_event(text, text, text, text[], jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_audit_event(p_entity_type text, p_entity_id text, p_action text, p_changed_fields text[] DEFAULT '{}'::text[], p_new_values jsonb DEFAULT '{}'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for audit events.';
  end if;

  insert into public.audit_events (
    entity_type,
    entity_id,
    action,
    changed_fields,
    new_values,
    metadata,
    changed_by
  )
  values (
    p_entity_type,
    p_entity_id,
    p_action,
    coalesce(p_changed_fields, '{}'),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  );
end;
$$;


--
-- Name: refresh_invoice_payment_status(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_invoice_payment_status(p_invoice_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_total numeric;
  v_status text;
  v_paid numeric;
begin
  perform public.require_authenticated_financial_write();

  select total, status
  into v_total, v_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found or v_status = 'cancelled' then
    return;
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  if coalesce(v_total, 0) > 0 and v_paid >= v_total then
    update public.invoices
    set status = 'paid'
    where id = p_invoice_id
      and status <> 'paid';
  elsif v_status = 'paid' and v_paid < coalesce(v_total, 0) then
    update public.invoices
    set status = 'issued'
    where id = p_invoice_id;
  end if;
end;
$$;


--
-- Name: require_authenticated_financial_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_authenticated_financial_write() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for financial writes.';
  end if;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: save_invoice_with_lines_v2(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_invoice_with_lines_v2(p_invoice jsonb, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_invoice_id text := nullif(p_invoice ->> 'id', '');
  v_status text := coalesce(nullif(p_invoice ->> 'status', ''), 'draft');
  v_pricing_metadata jsonb := case
    when jsonb_typeof(coalesce(p_invoice -> 'pricing_metadata', '{}'::jsonb)) = 'object'
      then coalesce(p_invoice -> 'pricing_metadata', '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_snapshot jsonb := case
    when jsonb_typeof(v_pricing_metadata -> 'client_fiscal_snapshot') = 'object'
      then v_pricing_metadata -> 'client_fiscal_snapshot'
    else '{}'::jsonb
  end;
  v_saved_invoice jsonb;
begin
  perform public.require_authenticated_financial_write();

  if public.invoice_status_consumes_fiscal_number(v_status) then
    if nullif(trim(coalesce(v_snapshot ->> 'tax_id', '')), '') is null
      or nullif(trim(coalesce(v_snapshot ->> 'billing_address', '')), '') is null
      or nullif(trim(coalesce(v_snapshot ->> 'fiscal_name', v_snapshot ->> 'name', '')), '') is null then
      raise exception 'No se puede emitir factura sin snapshot fiscal completo del cliente.';
    end if;
  end if;

  perform public.save_invoice_with_lines(p_invoice, p_lines);

  select jsonb_build_object(
    'id', invoices.id,
    'display_code', invoices.display_code,
    'invoice_number', invoices.invoice_number,
    'status', invoices.status,
    'issue_date', invoices.issue_date
  )
  into v_saved_invoice
  from public.invoices
  where id = v_invoice_id;

  if v_saved_invoice is null then
    raise exception 'La factura se guardo, pero no se pudo confirmar su lectura en el RPC.';
  end if;

  return v_saved_invoice;
end;
$$;


--
-- Name: save_job_with_lines(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_job_with_lines(p_job jsonb, p_lines jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: save_lead_quote_with_lines(text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_lead_quote_with_lines(p_lead_id text, p_intake_submission_id text, p_quote jsonb, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_lead_id text := nullif(p_lead_id, '');
  v_intake_id text := nullif(p_intake_submission_id, '');
  v_requested_quote_id text := nullif(p_quote ->> 'id', '');
  v_quote_id text;
  v_existing record;
  v_quote_payload jsonb;
begin
  perform public.require_authenticated_financial_write();

  if v_lead_id is null then
    raise exception 'El lead es obligatorio para guardar el presupuesto.';
  end if;

  if v_intake_id is not null then
    select q.id, q.status
    into v_existing
    from public.intake_submissions i
    join public.quotes q on q.id = i.quote_id
    where i.id::text = v_intake_id
    limit 1
    for update of q;

    if found then
      if v_existing.status in ('draft', 'sent', 'pending', 'pending_review') then
        v_quote_id := v_existing.id;
      else
        raise exception 'Este intake ya tiene un presupuesto finalizado. No se sobrescribirÃ¡ automÃ¡ticamente.';
      end if;
    end if;
  end if;

  if v_quote_id is null then
    select id, status
    into v_existing
    from public.quotes
    where lead_id = v_lead_id
      and status in ('draft', 'sent', 'pending', 'pending_review')
    order by created_at desc
    limit 1
    for update;

    if found then
      v_quote_id := v_existing.id;
    end if;
  end if;

  if v_quote_id is null and exists (
    select 1
    from public.quotes
    where lead_id = v_lead_id
      and status in ('accepted', 'rejected', 'expired', 'cancelled')
  ) then
    raise exception 'Este lead ya tiene un presupuesto finalizado. No se crearÃ¡ otro borrador automÃ¡ticamente.';
  end if;

  v_quote_id := coalesce(v_quote_id, v_requested_quote_id, 'QUOTE-' || gen_random_uuid()::text);

  v_quote_payload := p_quote || jsonb_build_object(
    'id', v_quote_id,
    'lead_id', v_lead_id,
    'client_id', null,
    'status', coalesce(nullif(p_quote ->> 'status', ''), 'draft')
  );

  perform public.save_quote_with_lines(v_quote_payload, p_lines);

  if v_intake_id is not null then
    update public.intake_submissions
    set
      status = 'converted',
      lead_id = v_lead_id,
      quote_id = v_quote_id
    where id::text = v_intake_id;
  end if;

  update public.lead_drafts
  set
    status = 'converted',
    matched_lead_id = v_lead_id
  where intake_submission_id::text = v_intake_id;

  update public.leads
  set status = 'quoted'
  where id = v_lead_id
    and status <> 'won';

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'lead_id', v_lead_id,
    'action',
      case
        when v_requested_quote_id is not null and v_requested_quote_id = v_quote_id then 'created_or_updated'
        when v_existing.id is not null then 'resolved_existing'
        else 'created_or_updated'
      end
  );
end;
$$;


--
-- Name: save_payment_and_refresh_invoice(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_payment_and_refresh_invoice(p_payment jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_payment_id text := nullif(p_payment ->> 'id', '');
  v_invoice_id text := nullif(p_payment ->> 'invoice_id', '');
  v_previous_invoice_id text;
  v_amount numeric := (p_payment ->> 'amount')::numeric;
  v_payment_method text := nullif(p_payment ->> 'payment_method', '');
  v_origin_type text := coalesce(nullif(p_payment ->> 'origin_type', ''), 'manual');
begin
  perform public.require_authenticated_financial_write();

  if v_payment_id is null then
    raise exception 'El cobro necesita identificador.';
  end if;

  if v_invoice_id is null then
    raise exception 'El cobro necesita una factura vinculada.';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'El importe del cobro debe ser mayor que cero.';
  end if;

  if v_payment_method is not null and v_payment_method not in ('transfer', 'cash', 'bizum', 'card') then
    raise exception 'El metodo de cobro no es valido.';
  end if;

  if v_origin_type not in ('manual', 'transfer_auto') then
    raise exception 'El origen del cobro no es valido.';
  end if;

  select invoice_id
  into v_previous_invoice_id
  from public.payments
  where id = v_payment_id
  for update;

  insert into public.payments (
    id,
    invoice_id,
    payment_date,
    amount,
    payment_method,
    origin_type,
    notes
  )
  values (
    v_payment_id,
    v_invoice_id,
    (p_payment ->> 'payment_date')::date,
    v_amount,
    v_payment_method,
    v_origin_type,
    nullif(p_payment ->> 'notes', '')
  )
  on conflict (id) do update set
    invoice_id = excluded.invoice_id,
    payment_date = excluded.payment_date,
    amount = excluded.amount,
    payment_method = excluded.payment_method,
    origin_type = excluded.origin_type,
    notes = excluded.notes;

  if v_previous_invoice_id is not null and v_previous_invoice_id <> v_invoice_id then
    perform public.refresh_invoice_payment_status(v_previous_invoice_id);
  end if;

  perform public.refresh_invoice_payment_status(v_invoice_id);
end;
$$;


--
-- Name: save_quote_with_lines(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_quote_with_lines(p_quote jsonb, p_lines jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_quote_id text := nullif(p_quote ->> 'id', '');
  v_client_id text := nullif(p_quote ->> 'client_id', '');
  v_lead_id text := nullif(p_quote ->> 'lead_id', '');
  v_status text := coalesce(nullif(p_quote ->> 'status', ''), 'draft');
begin
  perform public.require_authenticated_financial_write();

  if v_quote_id is null then
    raise exception 'El presupuesto necesita identificador.';
  end if;

  if v_client_id is null and v_lead_id is null then
    raise exception 'El presupuesto necesita cliente o lead.';
  end if;

  if v_lead_id is not null and v_status in ('draft', 'sent') and exists (
    select 1
    from public.quotes
    where lead_id = v_lead_id
      and id <> v_quote_id
      and status in ('draft', 'sent')
  ) then
    raise exception 'Este lead ya tiene un presupuesto borrador o pendiente. Actualiza ese presupuesto en lugar de crear un duplicado.';
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
    notes,
    internal_notes,
    pricing_metadata
  )
  values (
    v_quote_id,
    v_client_id,
    v_lead_id,
    nullif(p_quote ->> 'property_id', ''),
    v_status,
    coalesce((p_quote ->> 'subtotal')::numeric, 0),
    (p_quote ->> 'tax_amount')::numeric,
    coalesce((p_quote ->> 'total')::numeric, 0),
    nullif(p_quote ->> 'notes', ''),
    nullif(p_quote ->> 'internal_notes', ''),
    coalesce(p_quote -> 'pricing_metadata', '{}'::jsonb)
  )
  on conflict (id) do update set
    client_id = excluded.client_id,
    lead_id = excluded.lead_id,
    property_id = excluded.property_id,
    status = excluded.status,
    subtotal = excluded.subtotal,
    tax_amount = excluded.tax_amount,
    total = excluded.total,
    notes = excluded.notes,
    internal_notes = excluded.internal_notes,
    pricing_metadata = excluded.pricing_metadata;

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


--
-- Name: set_clients_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_clients_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'CLI-' || lpad(nextval('public.clients_display_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_expenses_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_expenses_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'EXP-' || to_char(coalesce(new.expense_date, current_date), 'YYYY') || '-' || lpad(new.expense_number::text, 5, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_invoices_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_invoices_codes() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
declare
  seq_num integer;
  invoice_year text;
begin
  invoice_year := coalesce(
    nullif(split_part(coalesce(new.invoice_number, ''), '-', 1), ''),
    extract(year from coalesce(new.issue_date, current_date))::text
  );

  if (new.invoice_number is null or btrim(new.invoice_number) = '')
     and (new.display_code is null or btrim(new.display_code) = '') then
    seq_num := nextval('public.invoices_invoice_number_seq');
    new.invoice_number := invoice_year || '-' || lpad(seq_num::text, 3, '0');
    new.display_code := 'INV-' || lpad(seq_num::text, 4, '0');
    return new;
  end if;

  if (new.invoice_number is not null and btrim(new.invoice_number) <> '')
     and (new.display_code is null or btrim(new.display_code) = '')
     and new.invoice_number ~ '^\d{4}-\d{3}$' then
    seq_num := right(new.invoice_number, 3)::integer;
    new.display_code := 'INV-' || lpad(seq_num::text, 4, '0');
    return new;
  end if;

  if (new.display_code is not null and btrim(new.display_code) <> '')
     and (new.invoice_number is null or btrim(new.invoice_number) = '')
     and new.display_code ~ '^INV-\d{4}$' then
    seq_num := right(new.display_code, 4)::integer;
    new.invoice_number := extract(year from coalesce(new.issue_date, current_date))::text || '-' || lpad(seq_num::text, 3, '0');
    return new;
  end if;

  return new;
end;
$_$;


--
-- Name: set_jobs_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_jobs_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'JOB-' || lpad(nextval('public.jobs_display_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_leads_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_leads_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'LEA-' || lpad(nextval('public.leads_display_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_payments_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_payments_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'PAY-' || lpad(nextval('public.payments_display_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_properties_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_properties_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'PRO-' || lpad(nextval('public.properties_display_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_public_intake_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_public_intake_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_quotes_display_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_quotes_display_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := 'QUO-' || lpad(nextval('public.quotes_display_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


--
-- Name: set_updated_at_annual_closings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_annual_closings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_updated_at_expenses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_expenses() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_updated_at_quarterly_closings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_quarterly_closings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;


--
-- Name: settle_invoice_by_transfer(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_invoice_by_transfer(p_invoice_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_invoice record;
  v_paid numeric := 0;
  v_outstanding numeric := 0;
  v_payment_id text;
  v_paid_after numeric := 0;
  v_outstanding_after numeric := 0;
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_invoice_id, '') is null then
    raise exception 'La factura necesita identificador.';
  end if;

  select id, total, status
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'No se encontro la factura indicada.';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception 'No se puede cobrar por transferencia una factura cancelada.';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  v_outstanding := greatest(coalesce(v_invoice.total, 0) - v_paid, 0);

  if v_outstanding <= 0.009 then
    return jsonb_build_object(
      'payment_id', null,
      'invoice_id', p_invoice_id,
      'created_payment', false,
      'outstanding_before', 0,
      'paid_total_after', v_paid,
      'outstanding_after', 0,
      'financial_status', 'paid'
    );
  end if;

  v_payment_id := 'PAYMENT-' || gen_random_uuid()::text;

  insert into public.payments (
    id,
    invoice_id,
    payment_date,
    amount,
    payment_method,
    origin_type,
    notes
  )
  values (
    v_payment_id,
    p_invoice_id,
    current_date,
    v_outstanding,
    'transfer',
    'transfer_auto',
    'Cobro automatico por transferencia desde la factura.'
  );

  perform public.refresh_invoice_payment_status(p_invoice_id);

  select coalesce(sum(amount), 0)
  into v_paid_after
  from public.payments
  where invoice_id = p_invoice_id;

  v_outstanding_after := greatest(coalesce(v_invoice.total, 0) - v_paid_after, 0);

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'created_payment', true,
    'outstanding_before', v_outstanding,
    'paid_total_after', v_paid_after,
    'outstanding_after', v_outstanding_after,
    'financial_status', case
      when v_outstanding_after <= 0.009 then 'paid'
      when v_paid_after > 0.009 then 'partially_paid'
      else 'pending'
    end
  );
end;
$$;


--
-- Name: simplify_billing_concept(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.simplify_billing_concept(p_concept text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_compacted text := regexp_replace(coalesce(p_concept, ''), '\s+', ' ', 'g');
begin
  v_compacted := btrim(v_compacted);

  if v_compacted = '' then
    return 'Servicio de limpieza';
  end if;

  return left(v_compacted, 120);
end;
$$;


--
-- Name: sync_invoice_numbering(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_invoice_numbering() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_year integer;
  v_sequence integer;
  v_manual_override boolean := coalesce(current_setting('app.invoice_number_override', true), 'false') = 'true';
  v_new_consumes boolean := public.invoice_status_consumes_fiscal_number(new.status);
  v_old_consumes boolean := case
    when tg_op = 'UPDATE' then public.invoice_status_consumes_fiscal_number(old.status)
    else false
  end;
  v_display_sequence integer;
begin
  v_year := extract(year from coalesce(new.issue_date, current_date))::integer;

  if tg_op = 'INSERT' then
    if not v_new_consumes then
      new.invoice_number := null;
      new.display_code := null;
      return new;
    end if;

    perform pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text));

    select public.find_first_missing_invoice_sequence(v_year, new.id)
    into v_sequence;

    new.invoice_number := public.build_invoice_number(v_year, v_sequence);
    new.display_code := public.build_invoice_display_code(v_sequence);
    return new;
  end if;

  if not v_new_consumes then
    if v_old_consumes then
      new.invoice_number := old.invoice_number;
      new.display_code := old.display_code;
    else
      new.invoice_number := null;
      new.display_code := null;
    end if;
    return new;
  end if;

  if not v_old_consumes then
    perform pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text));

    select public.find_first_missing_invoice_sequence(v_year, new.id)
    into v_sequence;

    new.invoice_number := public.build_invoice_number(v_year, v_sequence);
    new.display_code := public.build_invoice_display_code(v_sequence);
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
    new.display_code := public.build_invoice_display_code(v_sequence);
    return new;
  end if;

  if new.invoice_number is distinct from old.invoice_number
    or new.display_code is distinct from old.display_code then
    raise exception 'No se puede cambiar la numeracion fiscal de una factura ya emitida desde flujos normales.';
  end if;

  new.invoice_number := old.invoice_number;
  new.display_code := old.display_code;
  return new;
end;
$$;


--
-- Name: update_invoice_status(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_invoice_status(p_invoice_id text, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_invoice_id, '') is null then
    raise exception 'La factura necesita identificador.';
  end if;

  if p_status not in ('draft', 'issued', 'paid', 'cancelled') then
    raise exception 'Estado de factura no valido.';
  end if;

  update public.invoices
  set status = p_status
  where id = p_invoice_id;

  if not found then
    raise exception 'No se encontro la factura indicada.';
  end if;
end;
$$;


--
-- Name: update_quote_status(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_status(p_quote_id text, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_quote_id, '') is null then
    raise exception 'El presupuesto necesita identificador.';
  end if;

  if p_status not in ('draft', 'sent', 'accepted', 'rejected', 'expired') then
    raise exception 'Estado de presupuesto no valido.';
  end if;

  update public.quotes
  set status = p_status
  where id = p_quote_id;

  if not found then
    raise exception 'No se encontro el presupuesto indicado.';
  end if;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: annual_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annual_closings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fiscal_year integer NOT NULL,
    status text DEFAULT 'issues'::text NOT NULL,
    closed_at timestamp with time zone,
    notes text,
    snapshot_json jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT annual_closings_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'issues'::text])))
);


--
-- Name: TABLE annual_closings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.annual_closings IS 'Snapshots persistidos del cierre anual operativo de CostaClean CRM.';


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
    previous_values jsonb,
    new_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    changed_by uuid DEFAULT auth.uid(),
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_events_action_check CHECK ((action = ANY (ARRAY['upsert'::text, 'status_update'::text, 'convert_to_client'::text, 'accept'::text, 'accept_and_invoice'::text, 'attachment_update'::text, 'fiscal_analysis'::text]))),
    CONSTRAINT audit_events_entity_type_check CHECK ((entity_type = ANY (ARRAY['lead'::text, 'quote'::text, 'invoice'::text, 'payment'::text, 'expense'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text NOT NULL,
    phone text,
    email text,
    tax_id text,
    billing_address text,
    status text DEFAULT 'active'::text NOT NULL,
    source_lead_id text,
    display_code text,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: clients_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_code text,
    expense_number bigint NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    accounting_date date,
    due_date date,
    supplier_name text NOT NULL,
    supplier_tax_id text,
    category text NOT NULL,
    subcategory text,
    description text NOT NULL,
    document_type text DEFAULT 'ticket'::text NOT NULL,
    reference_number text,
    payment_method text,
    payment_status text DEFAULT 'paid'::text NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(6,2) DEFAULT 21 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    is_deductible boolean DEFAULT true NOT NULL,
    deductible_percentage numeric(5,2) DEFAULT 100 NOT NULL,
    affects_quarterly_closure boolean DEFAULT true NOT NULL,
    affects_annual_closure boolean DEFAULT true NOT NULL,
    receipt_file_url text,
    receipt_file_path text,
    attachment_count integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    fiscal_year integer GENERATED ALWAYS AS ((EXTRACT(year FROM expense_date))::integer) STORED,
    fiscal_quarter integer GENERATED ALWAYS AS (((((EXTRACT(month FROM expense_date))::integer - 1) / 3) + 1)) STORED,
    document_support_status text DEFAULT 'missing'::text NOT NULL,
    fiscal_review_status text DEFAULT 'pending'::text NOT NULL,
    fiscal_risk_level text DEFAULT 'medium'::text NOT NULL,
    manager_note text,
    ai_fiscal_classification text,
    ai_deductibility_percentage numeric(5,2),
    ai_vat_deductibility_percentage numeric(5,2),
    ai_estimated_deductible_base numeric(12,2),
    ai_estimated_deductible_vat numeric(12,2),
    ai_fiscal_confidence numeric(5,2),
    ai_fiscal_risk_level text,
    ai_fiscal_reasoning text,
    ai_fiscal_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_fiscal_model text,
    ai_fiscal_analyzed_at timestamp with time zone,
    ai_fiscal_source_version text,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    CONSTRAINT expenses_ai_deductibility_percentage_check CHECK (((ai_deductibility_percentage IS NULL) OR ((ai_deductibility_percentage >= (0)::numeric) AND (ai_deductibility_percentage <= (100)::numeric)))),
    CONSTRAINT expenses_ai_estimated_amounts_non_negative_check CHECK ((((ai_estimated_deductible_base IS NULL) OR (ai_estimated_deductible_base >= (0)::numeric)) AND ((ai_estimated_deductible_vat IS NULL) OR (ai_estimated_deductible_vat >= (0)::numeric)))),
    CONSTRAINT expenses_ai_fiscal_classification_check CHECK (((ai_fiscal_classification IS NULL) OR (ai_fiscal_classification = ANY (ARRAY['probably_deductible'::text, 'partially_deductible'::text, 'probably_not_deductible'::text, 'requires_review'::text])))),
    CONSTRAINT expenses_ai_fiscal_confidence_check CHECK (((ai_fiscal_confidence IS NULL) OR ((ai_fiscal_confidence >= (0)::numeric) AND (ai_fiscal_confidence <= (1)::numeric)))),
    CONSTRAINT expenses_ai_fiscal_flags_array_check CHECK ((jsonb_typeof(ai_fiscal_flags) = 'array'::text)),
    CONSTRAINT expenses_ai_fiscal_risk_level_check CHECK (((ai_fiscal_risk_level IS NULL) OR (ai_fiscal_risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))),
    CONSTRAINT expenses_ai_vat_deductibility_percentage_check CHECK (((ai_vat_deductibility_percentage IS NULL) OR ((ai_vat_deductibility_percentage >= (0)::numeric) AND (ai_vat_deductibility_percentage <= (100)::numeric)))),
    CONSTRAINT expenses_amounts_non_negative_check CHECK (((subtotal >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (total >= (0)::numeric))),
    CONSTRAINT expenses_category_check CHECK ((category = ANY (ARRAY['materiales'::text, 'transporte'::text, 'combustible'::text, 'herramientas'::text, 'productos_limpieza'::text, 'lavanderia'::text, 'alquiler'::text, 'seguros'::text, 'software'::text, 'telefonia'::text, 'publicidad_marketing'::text, 'gestoria'::text, 'suministros'::text, 'mantenimiento'::text, 'dietas_viajes'::text, 'impuestos_tasas'::text, 'servicios_profesionales'::text, 'otros'::text]))),
    CONSTRAINT expenses_deductible_percentage_check CHECK (((deductible_percentage >= (0)::numeric) AND (deductible_percentage <= (100)::numeric))),
    CONSTRAINT expenses_document_support_status_check CHECK ((document_support_status = ANY (ARRAY['missing'::text, 'ticket'::text, 'invoice_valid'::text, 'pending_review'::text]))),
    CONSTRAINT expenses_document_type_check CHECK ((document_type = ANY (ARRAY['ticket'::text, 'factura'::text, 'recibo'::text, 'otro'::text]))),
    CONSTRAINT expenses_fiscal_review_status_check CHECK ((fiscal_review_status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'observed'::text]))),
    CONSTRAINT expenses_fiscal_risk_level_check CHECK ((fiscal_risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT expenses_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'bizum'::text, 'direct_debit'::text, 'other'::text])))),
    CONSTRAINT expenses_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'partially_paid'::text, 'cancelled'::text])))
);


--
-- Name: TABLE expenses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.expenses IS 'Gastos empresariales de CostaClean con soporte para deducciÃ³n, cierre trimestral y anual, y adjuntos de tickets o facturas.';


--
-- Name: expenses_expense_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.expenses ALTER COLUMN expense_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.expenses_expense_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: intake_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    submitted_at timestamp with time zone,
    normalized_input jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_field_map jsonb DEFAULT '{}'::jsonb NOT NULL,
    pricing_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    lead_draft_id uuid,
    lead_id text,
    quote_id text,
    external_source_key text,
    import_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT intake_submissions_required_contact_check CHECK ((((source = ANY (ARRAY['public_quote_form'::text, 'public_quote_request'::text])) AND (length(TRIM(BOTH FROM COALESCE((normalized_input ->> 'fullName'::text), ''::text))) > 0) AND (length(TRIM(BOTH FROM COALESCE((normalized_input ->> 'phone'::text), ''::text))) > 0) AND (COALESCE(((normalized_input ->> 'consentQuoteProcessing'::text))::boolean, false) = true)) OR ((source = ANY (ARRAY['google_form_import'::text, 'google_forms_csv'::text])) AND ((length(TRIM(BOTH FROM COALESCE((normalized_input ->> 'fullName'::text), ''::text))) > 0) OR (length(TRIM(BOTH FROM COALESCE((normalized_input ->> 'phone'::text), ''::text))) > 0) OR (length(TRIM(BOTH FROM COALESCE((normalized_input ->> 'email'::text), ''::text))) > 0))))),
    CONSTRAINT intake_submissions_source_check CHECK ((source = ANY (ARRAY['public_quote_form'::text, 'public_quote_request'::text, 'google_forms_csv'::text, 'google_form_import'::text]))),
    CONSTRAINT intake_submissions_status_check CHECK ((status = ANY (ARRAY['received'::text, 'reviewing'::text, 'converted'::text, 'rejected'::text])))
);


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    id text NOT NULL,
    invoice_id text NOT NULL,
    sort_order integer DEFAULT 1 NOT NULL,
    concept text NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'servicio'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    line_subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_lines_line_subtotal_non_negative_check CHECK ((line_subtotal >= (0)::numeric)),
    CONSTRAINT invoice_lines_quantity_positive_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT invoice_lines_sort_order_positive_check CHECK ((sort_order > 0)),
    CONSTRAINT invoice_lines_unit_price_non_negative_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_code text,
    job_id text NOT NULL,
    client_id text NOT NULL,
    invoice_number text,
    issue_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    notes text,
    quote_id text,
    internal_notes text,
    pricing_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    property_id text
);


--
-- Name: invoices_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_invoice_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_invoice_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_lines (
    id text NOT NULL,
    job_id text NOT NULL,
    sort_order integer DEFAULT 1 NOT NULL,
    concept text NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'servicio'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    line_subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_lines_line_subtotal_non_negative_check CHECK ((line_subtotal >= (0)::numeric)),
    CONSTRAINT job_lines_quantity_positive_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT job_lines_sort_order_positive_check CHECK ((sort_order > 0)),
    CONSTRAINT job_lines_unit_price_non_negative_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_code text,
    client_id text NOT NULL,
    property_id text NOT NULL,
    quote_id text,
    scheduled_date date NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    service_type text NOT NULL,
    notes text,
    billing_concept text,
    billing_quantity numeric(12,2) DEFAULT 1 NOT NULL,
    billing_unit text DEFAULT 'service'::text NOT NULL,
    billing_unit_price numeric(12,2),
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    CONSTRAINT jobs_billing_quantity_positive_check CHECK ((billing_quantity > (0)::numeric)),
    CONSTRAINT jobs_billing_unit_price_non_negative_check CHECK (((billing_unit_price IS NULL) OR (billing_unit_price >= (0)::numeric)))
);


--
-- Name: jobs_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_submission_id uuid NOT NULL,
    suggested_full_name text NOT NULL,
    phone text NOT NULL,
    email text,
    city text,
    postal_code text,
    status text DEFAULT 'ready_for_review'::text NOT NULL,
    matched_lead_id text,
    normalized_input jsonb DEFAULT '{}'::jsonb NOT NULL,
    quote_draft_seed jsonb DEFAULT '{}'::jsonb NOT NULL,
    pricing_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    ai_email_draft text,
    ai_whatsapp_draft text,
    ai_draft_status text DEFAULT 'not_generated'::text NOT NULL,
    ai_generation_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_drafts_ai_draft_status_check CHECK ((ai_draft_status = ANY (ARRAY['not_generated'::text, 'drafted'::text, 'reviewed'::text]))),
    CONSTRAINT lead_drafts_status_check CHECK ((status = ANY (ARRAY['new'::text, 'matched_existing_lead'::text, 'ready_for_review'::text, 'converted'::text, 'dismissed'::text])))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    email text,
    service_type text NOT NULL,
    property_type text,
    city text,
    postal_code text,
    notes text,
    status text DEFAULT 'new'::text NOT NULL,
    archived_at timestamp with time zone,
    display_code text,
    normalized_phone text,
    public_intake_last_submission_id uuid,
    public_intake_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    converted_client_id text,
    converted_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text
);


--
-- Name: leads_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_code text,
    invoice_id text NOT NULL,
    payment_date date NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    payment_method text,
    notes text,
    origin_type text DEFAULT 'manual'::text,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text
);


--
-- Name: payments_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id text NOT NULL,
    name text NOT NULL,
    property_type text NOT NULL,
    address text NOT NULL,
    city text,
    postal_code text,
    notes text,
    display_code text,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: properties_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.properties_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: public_gym_manual_quiz_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_gym_manual_quiz_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre_trabajador text NOT NULL,
    puntuacion integer NOT NULL,
    porcentaje integer NOT NULL,
    aprobado boolean NOT NULL,
    fecha timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    respuestas_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    errores_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_preguntas integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT public_gym_manual_quiz_attempts_porcentaje_check CHECK (((porcentaje >= 0) AND (porcentaje <= 100))),
    CONSTRAINT public_gym_manual_quiz_attempts_puntuacion_check CHECK ((puntuacion >= 0)),
    CONSTRAINT public_gym_manual_quiz_attempts_total_preguntas_check CHECK ((total_preguntas > 0)),
    CONSTRAINT public_gym_manual_quiz_attempts_worker_name_length CHECK (((char_length(btrim(nombre_trabajador)) >= 2) AND (char_length(btrim(nombre_trabajador)) <= 120)))
);


--
-- Name: quarterly_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quarterly_closings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fiscal_year integer NOT NULL,
    fiscal_quarter integer NOT NULL,
    status text DEFAULT 'issues'::text NOT NULL,
    closed_at timestamp with time zone,
    notes text,
    snapshot_json jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT quarterly_closings_quarter_check CHECK ((fiscal_quarter = ANY (ARRAY[1, 2, 3, 4]))),
    CONSTRAINT quarterly_closings_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'issues'::text])))
);


--
-- Name: TABLE quarterly_closings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quarterly_closings IS 'Snapshots persistidos del cierre trimestral operativo de CostaClean CRM.';


--
-- Name: quote_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_lines (
    id text NOT NULL,
    quote_id text NOT NULL,
    sort_order integer DEFAULT 1 NOT NULL,
    concept text NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'servicio'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    line_subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_lines_line_subtotal_non_negative_check CHECK ((line_subtotal >= (0)::numeric)),
    CONSTRAINT quote_lines_quantity_positive_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT quote_lines_sort_order_positive_check CHECK ((sort_order > 0)),
    CONSTRAINT quote_lines_unit_price_non_negative_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id text,
    property_id text,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2),
    total numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    display_code text,
    lead_id text,
    internal_notes text,
    pricing_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    CONSTRAINT quotes_client_or_lead_required_check CHECK (((client_id IS NOT NULL) OR (lead_id IS NOT NULL)))
);


--
-- Name: quotes_display_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotes_display_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: annual_closings annual_closings_fiscal_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_closings
    ADD CONSTRAINT annual_closings_fiscal_year_key UNIQUE (fiscal_year);


--
-- Name: annual_closings annual_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_closings
    ADD CONSTRAINT annual_closings_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_display_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_display_code_key UNIQUE (display_code);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: intake_submissions intake_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_submissions
    ADD CONSTRAINT intake_submissions_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_lines job_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_lines
    ADD CONSTRAINT job_lines_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: lead_drafts lead_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_drafts
    ADD CONSTRAINT lead_drafts_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: public_gym_manual_quiz_attempts public_gym_manual_quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_gym_manual_quiz_attempts
    ADD CONSTRAINT public_gym_manual_quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: quarterly_closings quarterly_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_closings
    ADD CONSTRAINT quarterly_closings_pkey PRIMARY KEY (id);


--
-- Name: quarterly_closings quarterly_closings_year_quarter_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_closings
    ADD CONSTRAINT quarterly_closings_year_quarter_unique UNIQUE (fiscal_year, fiscal_quarter);


--
-- Name: quote_lines quote_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_lines
    ADD CONSTRAINT quote_lines_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: audit_events_changed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_changed_at_idx ON public.audit_events USING btree (changed_at DESC);


--
-- Name: audit_events_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_entity_idx ON public.audit_events USING btree (entity_type, entity_id, changed_at DESC);


--
-- Name: clients_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_display_code_unique ON public.clients USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: clients_source_lead_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_source_lead_id_unique ON public.clients USING btree (source_lead_id) WHERE (source_lead_id IS NOT NULL);


--
-- Name: idx_annual_closings_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_annual_closings_year ON public.annual_closings USING btree (fiscal_year DESC);


--
-- Name: idx_expenses_ai_fiscal_analyzed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_ai_fiscal_analyzed_at ON public.expenses USING btree (ai_fiscal_analyzed_at DESC);


--
-- Name: idx_expenses_ai_fiscal_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_ai_fiscal_classification ON public.expenses USING btree (ai_fiscal_classification);


--
-- Name: idx_expenses_ai_fiscal_flags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_ai_fiscal_flags ON public.expenses USING gin (ai_fiscal_flags);


--
-- Name: idx_expenses_ai_fiscal_risk_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_ai_fiscal_risk_level ON public.expenses USING btree (ai_fiscal_risk_level);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category ON public.expenses USING btree (category);


--
-- Name: idx_expenses_document_support_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_document_support_status ON public.expenses USING btree (document_support_status);


--
-- Name: idx_expenses_expense_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_expense_date ON public.expenses USING btree (expense_date DESC);


--
-- Name: idx_expenses_fiscal_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_fiscal_review_status ON public.expenses USING btree (fiscal_review_status);


--
-- Name: idx_expenses_fiscal_risk_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_fiscal_risk_level ON public.expenses USING btree (fiscal_risk_level);


--
-- Name: idx_expenses_fiscal_year_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_fiscal_year_quarter ON public.expenses USING btree (fiscal_year, fiscal_quarter);


--
-- Name: idx_expenses_is_deductible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_is_deductible ON public.expenses USING btree (is_deductible);


--
-- Name: idx_expenses_supplier_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_supplier_name ON public.expenses USING btree (supplier_name);


--
-- Name: idx_quarterly_closings_year_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quarterly_closings_year_quarter ON public.quarterly_closings USING btree (fiscal_year DESC, fiscal_quarter DESC);


--
-- Name: intake_submissions_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_submissions_contact_idx ON public.intake_submissions USING btree (lower((normalized_input ->> 'phone'::text)), lower(COALESCE((normalized_input ->> 'email'::text), ''::text)));


--
-- Name: intake_submissions_external_source_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX intake_submissions_external_source_key_idx ON public.intake_submissions USING btree (external_source_key) WHERE (external_source_key IS NOT NULL);


--
-- Name: intake_submissions_source_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_submissions_source_created_idx ON public.intake_submissions USING btree (source, created_at DESC);


--
-- Name: intake_submissions_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_submissions_status_created_idx ON public.intake_submissions USING btree (status, created_at DESC);


--
-- Name: invoice_lines_invoice_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_invoice_id_sort_order_idx ON public.invoice_lines USING btree (invoice_id, sort_order);


--
-- Name: invoices_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_display_code_unique ON public.invoices USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: invoices_display_code_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_display_code_unique_idx ON public.invoices USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: invoices_invoice_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_invoice_number_unique ON public.invoices USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);


--
-- Name: invoices_invoice_number_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_invoice_number_unique_idx ON public.invoices USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);


--
-- Name: invoices_quote_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_quote_id_idx ON public.invoices USING btree (quote_id);


--
-- Name: job_lines_job_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_lines_job_id_sort_order_idx ON public.job_lines USING btree (job_id, sort_order);


--
-- Name: jobs_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jobs_display_code_unique ON public.jobs USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: lead_drafts_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_drafts_contact_idx ON public.lead_drafts USING btree (lower(phone), lower(COALESCE(email, ''::text)));


--
-- Name: lead_drafts_intake_submission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_drafts_intake_submission_idx ON public.lead_drafts USING btree (intake_submission_id);


--
-- Name: lead_drafts_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_drafts_status_created_idx ON public.lead_drafts USING btree (status, created_at DESC);


--
-- Name: leads_converted_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_converted_client_id_idx ON public.leads USING btree (converted_client_id);


--
-- Name: leads_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leads_display_code_unique ON public.leads USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: leads_normalized_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_normalized_phone_idx ON public.leads USING btree (normalized_phone);


--
-- Name: payments_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_display_code_unique ON public.payments USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: properties_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX properties_display_code_unique ON public.properties USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: public_gym_manual_quiz_attempts_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_gym_manual_quiz_attempts_fecha_idx ON public.public_gym_manual_quiz_attempts USING btree (fecha DESC);


--
-- Name: quote_lines_quote_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quote_lines_quote_id_sort_order_idx ON public.quote_lines USING btree (quote_id, sort_order);


--
-- Name: quotes_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_client_id_idx ON public.quotes USING btree (client_id);


--
-- Name: quotes_display_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX quotes_display_code_unique ON public.quotes USING btree (display_code) WHERE (display_code IS NOT NULL);


--
-- Name: quotes_lead_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_lead_id_idx ON public.quotes USING btree (lead_id);


--
-- Name: intake_submissions set_intake_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_intake_submissions_updated_at BEFORE UPDATE ON public.intake_submissions FOR EACH ROW EXECUTE FUNCTION public.set_public_intake_updated_at();


--
-- Name: lead_drafts set_lead_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lead_drafts_updated_at BEFORE UPDATE ON public.lead_drafts FOR EACH ROW EXECUTE FUNCTION public.set_public_intake_updated_at();


--
-- Name: expenses trg_expenses_autocalc_amounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_expenses_autocalc_amounts BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.expenses_autocalc_amounts();


--
-- Name: clients trg_set_clients_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_clients_display_code BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_clients_display_code();


--
-- Name: expenses trg_set_expenses_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_expenses_display_code BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_expenses_display_code();


--
-- Name: invoices trg_set_invoices_codes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_invoices_codes BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoices_codes();


--
-- Name: jobs trg_set_jobs_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_jobs_display_code BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_jobs_display_code();


--
-- Name: leads trg_set_leads_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_leads_display_code BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_leads_display_code();


--
-- Name: payments trg_set_payments_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_payments_display_code BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_payments_display_code();


--
-- Name: properties trg_set_properties_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_properties_display_code BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_properties_display_code();


--
-- Name: quotes trg_set_quotes_display_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_quotes_display_code BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_quotes_display_code();


--
-- Name: annual_closings trg_set_updated_at_annual_closings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_annual_closings BEFORE UPDATE ON public.annual_closings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_annual_closings();


--
-- Name: expenses trg_set_updated_at_expenses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_expenses BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_expenses();


--
-- Name: quarterly_closings trg_set_updated_at_quarterly_closings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_quarterly_closings BEFORE UPDATE ON public.quarterly_closings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_quarterly_closings();


--
-- Name: invoices trg_sync_invoice_numbering; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_invoice_numbering BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_numbering();


--
-- Name: intake_submissions intake_submissions_lead_draft_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_submissions
    ADD CONSTRAINT intake_submissions_lead_draft_fk FOREIGN KEY (lead_draft_id) REFERENCES public.lead_drafts(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- Name: invoice_lines invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: invoices invoices_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: invoices invoices_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL NOT VALID;


--
-- Name: job_lines job_lines_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_lines
    ADD CONSTRAINT job_lines_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: jobs jobs_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: jobs jobs_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: lead_drafts lead_drafts_intake_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_drafts
    ADD CONSTRAINT lead_drafts_intake_submission_id_fkey FOREIGN KEY (intake_submission_id) REFERENCES public.intake_submissions(id) ON DELETE CASCADE;


--
-- Name: leads leads_converted_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_client_id_fkey FOREIGN KEY (converted_client_id) REFERENCES public.clients(id) ON DELETE SET NULL NOT VALID;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: properties properties_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: quote_lines quote_lines_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_lines
    ADD CONSTRAINT quote_lines_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: quotes quotes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL NOT VALID;


--
-- Name: quotes quotes_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: annual_closings Allow authenticated insert annual closings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert annual closings" ON public.annual_closings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: expenses Allow authenticated insert expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: quarterly_closings Allow authenticated insert quarterly closings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert quarterly closings" ON public.quarterly_closings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: annual_closings Allow authenticated select annual closings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated select annual closings" ON public.annual_closings FOR SELECT TO authenticated USING (true);


--
-- Name: expenses Allow authenticated select expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated select expenses" ON public.expenses FOR SELECT TO authenticated USING (true);


--
-- Name: quarterly_closings Allow authenticated select quarterly closings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated select quarterly closings" ON public.quarterly_closings FOR SELECT TO authenticated USING (true);


--
-- Name: annual_closings Allow authenticated update annual closings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update annual closings" ON public.annual_closings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: expenses Allow authenticated update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: quarterly_closings Allow authenticated update quarterly closings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update quarterly closings" ON public.quarterly_closings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: quote_lines Allow public delete access on quote_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete access on quote_lines" ON public.quote_lines FOR DELETE USING (true);


--
-- Name: clients Allow public insert access on clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on clients" ON public.clients FOR INSERT TO anon WITH CHECK (true);


--
-- Name: invoices Allow public insert access on invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on invoices" ON public.invoices FOR INSERT TO anon WITH CHECK (true);


--
-- Name: jobs Allow public insert access on jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on jobs" ON public.jobs FOR INSERT TO anon WITH CHECK (true);


--
-- Name: leads Allow public insert access on leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on leads" ON public.leads FOR INSERT TO anon WITH CHECK (true);


--
-- Name: payments Allow public insert access on payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on payments" ON public.payments FOR INSERT TO anon WITH CHECK (true);


--
-- Name: properties Allow public insert access on properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on properties" ON public.properties FOR INSERT TO anon WITH CHECK (true);


--
-- Name: quote_lines Allow public insert access on quote_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on quote_lines" ON public.quote_lines FOR INSERT WITH CHECK (true);


--
-- Name: quotes Allow public insert access on quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access on quotes" ON public.quotes FOR INSERT TO anon WITH CHECK (true);


--
-- Name: clients Allow public read access on clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on clients" ON public.clients FOR SELECT TO anon USING (true);


--
-- Name: invoices Allow public read access on invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on invoices" ON public.invoices FOR SELECT TO anon USING (true);


--
-- Name: jobs Allow public read access on jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on jobs" ON public.jobs FOR SELECT TO anon USING (true);


--
-- Name: leads Allow public read access on leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on leads" ON public.leads FOR SELECT TO anon USING (true);


--
-- Name: payments Allow public read access on payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on payments" ON public.payments FOR SELECT TO anon USING (true);


--
-- Name: properties Allow public read access on properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on properties" ON public.properties FOR SELECT TO anon USING (true);


--
-- Name: quote_lines Allow public read access on quote_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on quote_lines" ON public.quote_lines FOR SELECT USING (true);


--
-- Name: quotes Allow public read access on quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access on quotes" ON public.quotes FOR SELECT TO anon USING (true);


--
-- Name: clients Allow public update access on clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on clients" ON public.clients FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: invoices Allow public update access on invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on invoices" ON public.invoices FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: jobs Allow public update access on jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on jobs" ON public.jobs FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: leads Allow public update access on leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on leads" ON public.leads FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: payments Allow public update access on payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on payments" ON public.payments FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: properties Allow public update access on properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on properties" ON public.properties FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: quote_lines Allow public update access on quote_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on quote_lines" ON public.quote_lines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: quotes Allow public update access on quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access on quotes" ON public.quotes FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: intake_submissions Authenticated users can manage intake submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage intake submissions" ON public.intake_submissions TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: lead_drafts Authenticated users can manage lead drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage lead drafts" ON public.lead_drafts TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: audit_events Authenticated users can read audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read audit events" ON public.audit_events FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: invoice_lines Public can delete invoice_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can delete invoice_lines" ON public.invoice_lines FOR DELETE USING (true);


--
-- Name: public_gym_manual_quiz_attempts Public can insert gym manual quiz attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert gym manual quiz attempts" ON public.public_gym_manual_quiz_attempts FOR INSERT WITH CHECK (true);


--
-- Name: invoice_lines Public can insert invoice_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert invoice_lines" ON public.invoice_lines FOR INSERT WITH CHECK (true);


--
-- Name: public_gym_manual_quiz_attempts Public can read gym manual quiz attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read gym manual quiz attempts" ON public.public_gym_manual_quiz_attempts FOR SELECT USING (true);


--
-- Name: invoice_lines Public can read invoice_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read invoice_lines" ON public.invoice_lines FOR SELECT USING (true);


--
-- Name: invoice_lines Public can update invoice_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can update invoice_lines" ON public.invoice_lines FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: intake_submissions Public users can create intake submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public users can create intake submissions" ON public.intake_submissions FOR INSERT TO anon WITH CHECK (true);


--
-- Name: annual_closings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.annual_closings ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: job_lines authenticated can read job lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read job lines" ON public.job_lines FOR SELECT TO authenticated USING (true);


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: intake_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: job_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: public_gym_manual_quiz_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_gym_manual_quiz_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: quarterly_closings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quarterly_closings ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
