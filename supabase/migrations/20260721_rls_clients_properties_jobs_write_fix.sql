begin;

create or replace function public.require_authenticated_write()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for protected write.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_authenticated_write() from public, anon, authenticated;

create or replace function public.create_client(p_client jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(trim(p_client ->> 'id'), '');
  v_full_name text := nullif(trim(p_client ->> 'full_name'), '');
  v_status text := coalesce(nullif(trim(p_client ->> 'status'), ''), 'active');
  v_client public.clients%rowtype;
begin
  perform public.require_authenticated_write();

  if p_client is null or jsonb_typeof(p_client) <> 'object' then
    raise exception 'Client payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_client) as key
    where key not in ('id', 'full_name', 'phone', 'email', 'tax_id', 'billing_address', 'status', 'source_lead_id')
  ) then
    raise exception 'Client payload contains unsupported fields.';
  end if;
  if v_id is null or v_full_name is null then
    raise exception 'Client id and full_name are required.';
  end if;
  if v_status not in ('active', 'inactive') then
    raise exception 'Unsupported client status.';
  end if;

  insert into public.clients (
    id, full_name, phone, email, tax_id, billing_address, status, source_lead_id
  ) values (
    v_id,
    v_full_name,
    nullif(trim(p_client ->> 'phone'), ''),
    nullif(trim(p_client ->> 'email'), ''),
    nullif(trim(p_client ->> 'tax_id'), ''),
    nullif(trim(p_client ->> 'billing_address'), ''),
    v_status,
    nullif(trim(p_client ->> 'source_lead_id'), '')
  )
  returning * into v_client;

  return to_jsonb(v_client);
end;
$$;

create or replace function public.update_client(p_client jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(trim(p_client ->> 'id'), '');
  v_client public.clients%rowtype;
begin
  perform public.require_authenticated_write();

  if p_client is null or jsonb_typeof(p_client) <> 'object' then
    raise exception 'Client payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_client) as key
    where key not in ('id', 'full_name', 'phone', 'email', 'tax_id', 'billing_address', 'status', 'archived_at', 'source_lead_id')
  ) then
    raise exception 'Client payload contains unsupported fields.';
  end if;
  if v_id is null then
    raise exception 'Client id is required.';
  end if;
  if p_client ? 'full_name' and nullif(trim(p_client ->> 'full_name'), '') is null then
    raise exception 'Client full_name cannot be empty.';
  end if;
  if p_client ? 'status' and coalesce(p_client ->> 'status', '') not in ('active', 'inactive') then
    raise exception 'Unsupported client status.';
  end if;

  update public.clients
  set
    full_name = case when p_client ? 'full_name' then trim(p_client ->> 'full_name') else full_name end,
    phone = case when p_client ? 'phone' then nullif(trim(p_client ->> 'phone'), '') else phone end,
    email = case when p_client ? 'email' then nullif(trim(p_client ->> 'email'), '') else email end,
    tax_id = case when p_client ? 'tax_id' then nullif(trim(p_client ->> 'tax_id'), '') else tax_id end,
    billing_address = case when p_client ? 'billing_address' then nullif(trim(p_client ->> 'billing_address'), '') else billing_address end,
    status = case when p_client ? 'status' then p_client ->> 'status' else status end,
    archived_at = case when p_client ? 'archived_at' then nullif(p_client ->> 'archived_at', '')::timestamptz else archived_at end,
    source_lead_id = case when p_client ? 'source_lead_id' then nullif(trim(p_client ->> 'source_lead_id'), '') else source_lead_id end,
    updated_at = now()
  where id = v_id
  returning * into v_client;

  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_client);
end;
$$;

create or replace function public.create_property(p_property jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(trim(p_property ->> 'id'), '');
  v_client_id text := nullif(trim(p_property ->> 'client_id'), '');
  v_name text := nullif(trim(p_property ->> 'name'), '');
  v_property_type text := nullif(trim(p_property ->> 'property_type'), '');
  v_address text := nullif(trim(p_property ->> 'address'), '');
  v_property public.properties%rowtype;
begin
  perform public.require_authenticated_write();

  if p_property is null or jsonb_typeof(p_property) <> 'object' then
    raise exception 'Property payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_property) as key
    where key not in ('id', 'client_id', 'name', 'property_type', 'address', 'city', 'postal_code', 'notes')
  ) then
    raise exception 'Property payload contains unsupported fields.';
  end if;
  if v_id is null or v_client_id is null or v_name is null or v_property_type is null or v_address is null then
    raise exception 'Property id, client_id, name, property_type and address are required.';
  end if;
  if not exists (select 1 from public.clients where id = v_client_id) then
    raise exception 'Property client not found.' using errcode = '23503';
  end if;

  insert into public.properties (
    id, client_id, name, property_type, address, city, postal_code, notes
  ) values (
    v_id,
    v_client_id,
    v_name,
    v_property_type,
    v_address,
    nullif(trim(p_property ->> 'city'), ''),
    nullif(trim(p_property ->> 'postal_code'), ''),
    nullif(trim(p_property ->> 'notes'), '')
  )
  returning * into v_property;

  return to_jsonb(v_property);
end;
$$;

create or replace function public.update_property(p_property jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(trim(p_property ->> 'id'), '');
  v_property public.properties%rowtype;
begin
  perform public.require_authenticated_write();

  if p_property is null or jsonb_typeof(p_property) <> 'object' then
    raise exception 'Property payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_property) as key
    where key not in ('id', 'name', 'property_type', 'address', 'city', 'postal_code', 'notes')
  ) then
    raise exception 'Property payload contains unsupported fields.';
  end if;
  if v_id is null then
    raise exception 'Property id is required.';
  end if;
  if (p_property ? 'name' and nullif(trim(p_property ->> 'name'), '') is null)
    or (p_property ? 'property_type' and nullif(trim(p_property ->> 'property_type'), '') is null)
    or (p_property ? 'address' and nullif(trim(p_property ->> 'address'), '') is null) then
    raise exception 'Property name, property_type and address cannot be empty.';
  end if;

  update public.properties
  set
    name = case when p_property ? 'name' then trim(p_property ->> 'name') else name end,
    property_type = case when p_property ? 'property_type' then trim(p_property ->> 'property_type') else property_type end,
    address = case when p_property ? 'address' then trim(p_property ->> 'address') else address end,
    city = case when p_property ? 'city' then nullif(trim(p_property ->> 'city'), '') else city end,
    postal_code = case when p_property ? 'postal_code' then nullif(trim(p_property ->> 'postal_code'), '') else postal_code end,
    notes = case when p_property ? 'notes' then nullif(trim(p_property ->> 'notes'), '') else notes end,
    updated_at = now()
  where id = v_id
  returning * into v_property;

  if not found then
    raise exception 'Property not found.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_property);
end;
$$;

create or replace function public.update_job_status(p_job_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
begin
  perform public.require_authenticated_write();

  if nullif(trim(p_job_id), '') is null then
    raise exception 'Job id is required.';
  end if;
  if p_status not in ('scheduled', 'in_progress', 'completed', 'cancelled') then
    raise exception 'Unsupported job status.';
  end if;

  update public.jobs
  set status = p_status, updated_at = now()
  where id = p_job_id
  returning * into v_job;

  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_job);
end;
$$;

create or replace function public.reassign_property_client_authenticated(p_property_id text, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_authenticated_write();
  return public.reassign_property_client(p_property_id, p_client_id);
end;
$$;

drop policy if exists "Allow public insert access on clients" on public.clients;
drop policy if exists "Allow public update access on clients" on public.clients;
drop policy if exists "Allow public insert access on properties" on public.properties;
drop policy if exists "Allow public update access on properties" on public.properties;
drop policy if exists "Allow public insert access on jobs" on public.jobs;
drop policy if exists "Allow public update access on jobs" on public.jobs;

revoke execute on function public.create_client(jsonb) from public, anon;
revoke execute on function public.update_client(jsonb) from public, anon;
revoke execute on function public.create_property(jsonb) from public, anon;
revoke execute on function public.update_property(jsonb) from public, anon;
revoke execute on function public.update_job_status(text, text) from public, anon;
revoke execute on function public.reassign_property_client_authenticated(text, text) from public, anon;
revoke execute on function public.reassign_property_client(text, text) from public, anon, authenticated;
revoke execute on function public.save_job_with_lines(jsonb, jsonb) from public, anon;

grant execute on function public.create_client(jsonb) to authenticated;
grant execute on function public.update_client(jsonb) to authenticated;
grant execute on function public.create_property(jsonb) to authenticated;
grant execute on function public.update_property(jsonb) to authenticated;
grant execute on function public.update_job_status(text, text) to authenticated;
grant execute on function public.reassign_property_client_authenticated(text, text) to authenticated;
grant execute on function public.save_job_with_lines(jsonb, jsonb) to authenticated;

commit;
