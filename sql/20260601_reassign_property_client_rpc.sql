begin;

create or replace function public.reassign_property_client(
  p_property_id text,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    raise exception 'No se encontró la propiedad indicada.';
  end if;

  perform 1
  from public.clients
  where id = p_client_id
  for update;

  if not found then
    raise exception 'No se encontró el cliente destino.';
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

grant execute on function public.reassign_property_client(text, text) to anon, authenticated;

commit;
