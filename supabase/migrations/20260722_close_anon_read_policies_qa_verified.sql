begin;

-- P0 closure verified against QA project kpvvydthlxupjjqqdpxy.
-- This migration is environment-agnostic SQL and must not be applied to production
-- without a separate production release authorization.

create or replace function public.create_lead(p_lead jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(trim(p_lead ->> 'id'), '');
  v_full_name text := nullif(trim(p_lead ->> 'full_name'), '');
  v_phone text := nullif(trim(p_lead ->> 'phone'), '');
  v_lead public.leads%rowtype;
begin
  perform public.require_authenticated_write();
  if p_lead is null or jsonb_typeof(p_lead) <> 'object' then
    raise exception 'Lead payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_lead) as key
    where key not in ('id', 'full_name', 'phone', 'email', 'service_type', 'property_type', 'city', 'postal_code', 'notes')
  ) then
    raise exception 'Lead payload contains unsupported fields.';
  end if;
  if v_id is null or v_full_name is null or v_phone is null or nullif(trim(p_lead ->> 'service_type'), '') is null then
    raise exception 'Lead id, full_name, phone and service_type are required.';
  end if;

  insert into public.leads (
    id, full_name, phone, email, service_type, property_type, city, postal_code, notes
  ) values (
    v_id, v_full_name, v_phone,
    nullif(trim(p_lead ->> 'email'), ''),
    trim(p_lead ->> 'service_type'),
    nullif(trim(p_lead ->> 'property_type'), ''),
    nullif(trim(p_lead ->> 'city'), ''),
    nullif(trim(p_lead ->> 'postal_code'), ''),
    nullif(trim(p_lead ->> 'notes'), '')
  ) returning * into v_lead;

  return to_jsonb(v_lead);
end;
$$;

create or replace function public.update_lead(p_lead jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(trim(p_lead ->> 'id'), '');
  v_lead public.leads%rowtype;
begin
  perform public.require_authenticated_write();
  if p_lead is null or jsonb_typeof(p_lead) <> 'object' then
    raise exception 'Lead payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_lead) as key
    where key not in ('id', 'full_name', 'phone', 'city', 'status', 'archived_at')
  ) then
    raise exception 'Lead payload contains unsupported fields.';
  end if;
  if v_id is null then raise exception 'Lead id is required.'; end if;
  if p_lead ? 'full_name' and nullif(trim(p_lead ->> 'full_name'), '') is null then
    raise exception 'Lead full_name cannot be empty.';
  end if;
  if p_lead ? 'phone' and nullif(trim(p_lead ->> 'phone'), '') is null then
    raise exception 'Lead phone cannot be empty.';
  end if;
  if p_lead ? 'status' and (p_lead ->> 'status') not in ('new', 'contacted', 'quoted', 'won', 'lost') then
    raise exception 'Unsupported lead status.';
  end if;

  update public.leads set
    full_name = case when p_lead ? 'full_name' then trim(p_lead ->> 'full_name') else full_name end,
    phone = case when p_lead ? 'phone' then trim(p_lead ->> 'phone') else phone end,
    city = case when p_lead ? 'city' then nullif(trim(p_lead ->> 'city'), '') else city end,
    status = case when p_lead ? 'status' then p_lead ->> 'status' else status end,
    archived_at = case when p_lead ? 'archived_at' then nullif(p_lead ->> 'archived_at', '')::timestamptz else archived_at end,
    updated_at = now()
  where id = v_id
  returning * into v_lead;

  if not found then raise exception 'Lead not found.' using errcode = 'P0002'; end if;
  return to_jsonb(v_lead);
end;
$$;

create or replace function public.submit_public_gym_manual_quiz_attempt(p_attempt jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(trim(p_attempt ->> 'nombre_trabajador'), '');
  v_score integer;
  v_percentage integer;
  v_passed boolean;
  v_total integer;
  v_attempt public.public_gym_manual_quiz_attempts%rowtype;
begin
  if p_attempt is null or jsonb_typeof(p_attempt) <> 'object' then
    raise exception 'Quiz payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_attempt) as key
    where key not in ('nombre_trabajador', 'puntuacion', 'porcentaje', 'aprobado', 'respuestas_json', 'errores_json', 'total_preguntas')
  ) then
    raise exception 'Quiz payload contains unsupported fields.';
  end if;
  begin
    v_score := (p_attempt ->> 'puntuacion')::integer;
    v_percentage := (p_attempt ->> 'porcentaje')::integer;
    v_passed := (p_attempt ->> 'aprobado')::boolean;
    v_total := (p_attempt ->> 'total_preguntas')::integer;
  exception when others then
    raise exception 'Quiz score fields are invalid.';
  end;
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'Worker name must contain between 2 and 120 characters.';
  end if;
  if v_total <= 0 or v_score < 0 or v_score > v_total
    or v_percentage <> round((v_score::numeric * 100) / v_total)::integer
    or v_passed <> (v_percentage >= 80) then
    raise exception 'Quiz result is inconsistent.';
  end if;
  if jsonb_typeof(p_attempt -> 'respuestas_json') <> 'object'
    or jsonb_typeof(p_attempt -> 'errores_json') <> 'array' then
    raise exception 'Quiz answer details are invalid.';
  end if;

  insert into public.public_gym_manual_quiz_attempts (
    nombre_trabajador, puntuacion, porcentaje, aprobado,
    respuestas_json, errores_json, total_preguntas
  ) values (
    v_name, v_score, v_percentage, v_passed,
    p_attempt -> 'respuestas_json', p_attempt -> 'errores_json', v_total
  ) returning * into v_attempt;

  return to_jsonb(v_attempt);
end;
$$;

revoke execute on function public.create_lead(jsonb) from public, anon;
revoke execute on function public.update_lead(jsonb) from public, anon;
grant execute on function public.create_lead(jsonb) to authenticated;
grant execute on function public.update_lead(jsonb) to authenticated;
revoke execute on function public.submit_public_gym_manual_quiz_attempt(jsonb) from public;
grant execute on function public.submit_public_gym_manual_quiz_attempt(jsonb) to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'clients', 'properties', 'leads', 'invoices', 'invoice_lines',
        'payments', 'quotes', 'quote_lines', 'public_gym_manual_quiz_attempts', 'jobs'
      ])
      and cmd = 'SELECT'
      and roles && array['public'::name, 'anon'::name]
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'leads', 'invoices', 'invoice_lines', 'payments', 'quotes', 'quote_lines',
        'public_gym_manual_quiz_attempts'
      ])
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and roles && array['public'::name, 'anon'::name]
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'properties', 'leads', 'invoices', 'invoice_lines',
    'payments', 'quotes', 'quote_lines', 'public_gym_manual_quiz_attempts', 'jobs'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'Authenticated read access', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)',
      'Authenticated read access', t
    );
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'annual_closings', 'audit_events', 'clients', 'expenses', 'intake_submissions',
    'invoice_lines', 'invoices', 'job_lines', 'jobs', 'lead_drafts', 'leads',
    'payments', 'properties', 'public_gym_manual_quiz_attempts', 'quarterly_closings',
    'quote_lines', 'quotes'
  ] loop
    execute format('revoke select on table public.%I from public, anon', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end;
$$;

do $$
declare f record;
begin
  for f in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'accept_quote_workflow', 'assert_invoice_numbering_regular',
        'backfill_invoice_fiscal_snapshots', 'build_client_fiscal_snapshot',
        'convert_lead_to_client', 'ensure_invoice_pricing_metadata',
        'find_first_missing_invoice_sequence', 'record_audit_event',
        'refresh_invoice_payment_status', 'save_invoice_with_lines',
        'save_invoice_with_lines_v2', 'save_lead_quote_with_lines',
        'save_payment_and_refresh_invoice', 'save_quote_with_lines',
        'settle_invoice_by_transfer', 'update_invoice_status', 'update_quote_status',
        'require_authenticated_financial_write', 'require_authenticated_write'
      ])
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon', f.nspname, f.proname, f.args);
    if f.proname not in ('require_authenticated_financial_write', 'require_authenticated_write') then
      execute format('grant execute on function %I.%I(%s) to authenticated', f.nspname, f.proname, f.args);
    else
      execute format('revoke execute on function %I.%I(%s) from authenticated', f.nspname, f.proname, f.args);
    end if;
  end loop;
end;
$$;

commit;
