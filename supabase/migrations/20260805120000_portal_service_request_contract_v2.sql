alter table public.client_service_requests
  add column if not exists public_reference text;

alter table public.client_service_requests
  add constraint client_service_requests_public_reference_format
  check (public_reference is null or public_reference ~ '^CC-SR-[0-9A-F]{24}$');

create unique index if not exists client_service_requests_v2_public_reference_uidx
  on public.client_service_requests (public_reference)
  where public_reference is not null;

create unique index if not exists client_service_requests_v2_idempotency_uidx
  on public.client_service_requests (requested_by, idempotency_key)
  where idempotency_key is not null;

create or replace function portal_private.generate_service_request_public_reference_v2()
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'CC-SR-' || upper(substr(encode(sha256(convert_to(
      gen_random_uuid()::text || ':' || gen_random_uuid()::text, 'UTF8'
    )), 'hex'), 1, 24));
    exit when not exists (
      select 1
      from public.client_service_requests
      where public_reference = v_reference
    );
  end loop;
  return v_reference;
end;
$$;

update public.client_service_requests
set public_reference = portal_private.generate_service_request_public_reference_v2()
where public_reference is null;

alter table public.client_service_requests
  alter column public_reference set default portal_private.generate_service_request_public_reference_v2(),
  alter column public_reference set not null;

alter table public.jobs
  add column if not exists public_reference text;

alter table public.jobs
  add constraint jobs_public_reference_format
  check (public_reference is null or public_reference ~ '^CC-SV-[0-9A-F]{24}$');

create unique index if not exists jobs_v2_public_reference_uidx
  on public.jobs (public_reference)
  where public_reference is not null;

create or replace function portal_private.generate_service_public_reference_v2()
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'CC-SV-' || upper(substr(encode(sha256(convert_to(
      gen_random_uuid()::text || ':' || gen_random_uuid()::text, 'UTF8'
    )), 'hex'), 1, 24));
    exit when not exists (
      select 1
      from public.jobs
      where public_reference = v_reference
    );
  end loop;
  return v_reference;
end;
$$;

update public.jobs
set public_reference = portal_private.generate_service_public_reference_v2()
where public_reference is null;

alter table public.jobs
  alter column public_reference set default portal_private.generate_service_public_reference_v2(),
  alter column public_reference set not null;

create or replace function public.portal_list_services_v2(
  p_client_id text,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'reference', j.public_reference,
    'propertyPublicRef', p.public_ref,
    'propertyName', p.name,
    'addressLabel', concat_ws(' · ', p.address, p.city),
    'serviceType', j.service_type,
    'scheduledDate', j.scheduled_date,
    'status', j.status
  ) order by j.scheduled_date desc, j.public_reference desc), '[]'::jsonb)
  from (
    select *
    from public.jobs
    where client_id = portal_private.current_portal_client_id(p_client_id)
      and deleted_at is null
      and archived_at is null
      and public_reference is not null
    order by scheduled_date desc, public_reference desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as j
  join public.properties as p
    on p.id = j.property_id
   and p.client_id = j.client_id
   and p.deleted_at is null
   and p.archived_at is null
   and p.public_ref is not null;
$$;

create or replace function public.portal_get_service_v2(
  p_client_id text,
  p_service_reference text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_service record;
begin
  if v_user_id is null
    or p_service_reference is null
    or btrim(p_service_reference) = ''
  then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  perform portal_private.assert_trusted_actor_membership(
    v_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );

  select
    j.public_reference,
    p.public_ref,
    p.name,
    concat_ws(' · ', p.address, p.city) as address_label,
    j.service_type,
    j.scheduled_date,
    j.status
  into v_service
  from public.jobs as j
  join public.properties as p
    on p.id = j.property_id
   and p.client_id = j.client_id
   and p.deleted_at is null
   and p.archived_at is null
   and p.public_ref is not null
  where j.client_id = portal_private.current_portal_client_id(p_client_id)
    and j.public_reference = p_service_reference
    and j.deleted_at is null
    and j.archived_at is null
    and j.public_reference is not null
  limit 1;

  if not found then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'reference', v_service.public_reference,
    'propertyPublicRef', v_service.public_ref,
    'propertyName', v_service.name,
    'addressLabel', coalesce(v_service.address_label, 'Dirección no disponible'),
    'serviceType', v_service.service_type,
    'scheduledDate', v_service.scheduled_date,
    'status', v_service.status
  );
end;
$$;

create or replace function public.portal_list_own_service_requests_v2(
  p_client_id text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_limit is null or p_limit not between 1 and 50 then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  perform portal_private.assert_trusted_actor_membership(
    v_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'reference', r.public_reference,
      'propertyPublicRef', p.public_ref,
      'propertyName', p.name,
      'addressLabel', concat_ws(' · ', p.address, p.city),
      'serviceType', r.service_type,
      'preferredDate', r.preferred_date,
      'preferredTimeWindow', r.preferred_time_window,
      'requestedAt', r.created_at,
      'resolvedAt', coalesce(r.reviewed_at, r.cancelled_at),
      'notes', coalesce(r.notes, ''),
      'status', r.status,
      'version', r.version,
      'canCancel', (
        r.status = 'pending_review'
        and r.approved_job_id is null
        and r.reviewed_at is null
        and r.cancelled_at is null
      )
    ) order by r.created_at desc, r.public_reference desc)
    from (
      select *
      from public.client_service_requests
      where client_id = portal_private.current_portal_client_id(p_client_id)
        and requested_by = v_user_id
        and public_reference is not null
        and idempotency_key is not null
      order by created_at desc, public_reference desc
      limit least(greatest(coalesce(p_limit, 50), 1), 50)
    ) as r
    join public.properties as p
      on p.id = r.property_id
     and p.client_id = r.client_id
     and p.deleted_at is null
     and p.archived_at is null
     and p.public_ref is not null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_get_own_service_request_v2(
  p_client_id text,
  p_request_reference text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_request record;
begin
  if v_user_id is null
    or p_request_reference is null
    or btrim(p_request_reference) = ''
  then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  perform portal_private.assert_trusted_actor_membership(
    v_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );

  select
    r.public_reference,
    p.public_ref,
    p.name,
    concat_ws(' · ', p.address, p.city) as address_label,
    r.service_type,
    r.preferred_date,
    r.preferred_time_window,
    r.created_at,
    coalesce(r.reviewed_at, r.cancelled_at) as resolved_at,
    coalesce(r.notes, '') as notes,
    r.status,
    r.version,
    (
      r.status = 'pending_review'
      and r.approved_job_id is null
      and r.reviewed_at is null
      and r.cancelled_at is null
    ) as can_cancel
  into v_request
  from public.client_service_requests as r
  join public.properties as p
    on p.id = r.property_id
   and p.client_id = r.client_id
   and p.deleted_at is null
   and p.archived_at is null
   and p.public_ref is not null
  where r.client_id = portal_private.current_portal_client_id(p_client_id)
    and r.requested_by = v_user_id
    and r.public_reference = p_request_reference
    and r.public_reference is not null
  limit 1;

  if not found then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'reference', v_request.public_reference,
    'propertyPublicRef', v_request.public_ref,
    'propertyName', v_request.name,
    'addressLabel', coalesce(v_request.address_label, 'Dirección no disponible'),
    'serviceType', v_request.service_type,
    'preferredDate', v_request.preferred_date,
    'preferredTimeWindow', v_request.preferred_time_window,
    'requestedAt', v_request.created_at,
    'resolvedAt', v_request.resolved_at,
    'notes', v_request.notes,
    'status', v_request.status,
    'version', v_request.version,
    'canCancel', v_request.can_cancel
  );
end;
$$;

create or replace function public.portal_submit_service_request_v2(
  p_client_id text,
  p_property_public_ref text,
  p_service_type text,
  p_preferred_date date,
  p_idempotency_key uuid,
  p_preferred_time_window text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_property public.properties%rowtype;
  v_request public.client_service_requests%rowtype;
  v_existing public.client_service_requests%rowtype;
  v_rate_subject text;
  v_time_window text := nullif(btrim(p_preferred_time_window), '');
  v_notes text := nullif(btrim(p_notes), '');
begin
  if v_user_id is null
    or p_idempotency_key is null
    or p_idempotency_key = '00000000-0000-0000-0000-000000000000'::uuid
  then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  v_membership_id := portal_private.assert_trusted_actor_membership(
    v_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );

  select *
    into v_property
  from public.properties
  where client_id = portal_private.current_portal_client_id(p_client_id)
    and public_ref = p_property_public_ref
    and status = 'active'
    and deleted_at is null
    and archived_at is null;

  if not found then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':' || p_client_id || ':' || p_idempotency_key::text,
    0
  ));

  select *
    into v_existing
  from public.client_service_requests
  where client_id = portal_private.current_portal_client_id(p_client_id)
    and requested_by = v_user_id
    and idempotency_key = p_idempotency_key
    and property_id = v_property.id
  limit 1;

  if v_existing.id is not null then
    if v_existing.service_type is distinct from p_service_type
      or v_existing.preferred_date is distinct from p_preferred_date
      or v_existing.preferred_time_window is distinct from v_time_window
      or coalesce(v_existing.notes, '') is distinct from coalesce(v_notes, '')
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;

    v_request := v_existing;
    return jsonb_build_object(
      'reference', v_request.public_reference,
      'status', v_request.status,
      'requestedAt', v_request.created_at,
      'resolvedAt', coalesce(v_request.reviewed_at, v_request.cancelled_at),
      'propertyPublicRef', v_property.public_ref,
      'propertyLabel', v_property.name,
      'serviceType', v_request.service_type,
      'preferredDate', v_request.preferred_date,
      'preferredTimeWindow', v_request.preferred_time_window,
      'notes', coalesce(v_request.notes, ''),
      'version', v_request.version
    );
  end if;

  if p_service_type not in (
      'regular_cleaning', 'deep_cleaning', 'move_cleaning', 'commercial_cleaning', 'other'
    )
    or p_preferred_date is null
    or p_preferred_date < current_date
    or (p_preferred_time_window is not null and p_preferred_time_window not in (
      'morning', 'afternoon', 'flexible'
    ))
    or char_length(coalesce(v_notes, '')) > 1000
  then
    raise exception 'invalid_service_request' using errcode = '22023';
  end if;

  v_rate_subject := encode(sha256(convert_to(
    'service_request_v2:' || v_user_id::text || ':' || p_client_id, 'UTF8'
  )), 'hex');
  if not portal_private.consume_rate_limit('service_request_v2', v_rate_subject, 5, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.client_service_requests (
    client_id, property_id, requested_by, service_type, preferred_date,
    preferred_time_window, notes, status, idempotency_key
  ) values (
    p_client_id, v_property.id, v_user_id, p_service_type, p_preferred_date,
    v_time_window, v_notes,
    'pending_review', p_idempotency_key
  ) returning * into v_request;

  if v_request.public_reference is null then
    raise exception 'reference_generation_failed' using errcode = 'P0001';
  end if;

  perform portal_private.write_audit_event(
    'service_request_submitted', 'accepted', v_user_id, v_membership_id,
    p_client_id, 'service_request', v_request.id, gen_random_uuid(),
    null, null, jsonb_build_object('status', v_request.status)
  );

  return jsonb_build_object(
    'reference', v_request.public_reference,
    'status', v_request.status,
    'requestedAt', v_request.created_at,
    'resolvedAt', coalesce(v_request.reviewed_at, v_request.cancelled_at),
    'propertyPublicRef', v_property.public_ref,
    'propertyLabel', v_property.name,
    'serviceType', v_request.service_type,
    'preferredDate', v_request.preferred_date,
    'preferredTimeWindow', v_request.preferred_time_window,
    'notes', coalesce(v_request.notes, ''),
    'version', v_request.version
  );
end;
$$;

create or replace function public.portal_cancel_own_service_request_v2(
  p_client_id text,
  p_request_reference text,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_request public.client_service_requests%rowtype;
  v_property public.properties%rowtype;
begin
  if v_user_id is null
    or p_request_reference is null
    or btrim(p_request_reference) = ''
    or p_expected_version is null
  then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  v_membership_id := portal_private.assert_trusted_actor_membership(
    v_user_id, p_client_id, array['client_admin', 'client_member']::text[]
  );

  update public.client_service_requests
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancelled_by = v_user_id,
      cancellation_reason_code = 'customer_withdrawn',
      version = version + 1
  where client_id = portal_private.current_portal_client_id(p_client_id)
    and requested_by = v_user_id
    and public_reference = p_request_reference
    and status = 'pending_review'
    and approved_job_id is null
    and version = p_expected_version
  returning * into v_request;

  if v_request.id is null then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;

  select *
    into v_property
  from public.properties
  where id = v_request.property_id;

  perform portal_private.write_audit_event(
    'service_request_cancelled', 'completed', v_user_id, v_membership_id,
    p_client_id, 'service_request', v_request.id, gen_random_uuid(),
    null, null, jsonb_build_object('status', v_request.status)
  );

  return jsonb_build_object(
    'reference', v_request.public_reference,
    'status', v_request.status,
    'requestedAt', v_request.created_at,
    'resolvedAt', v_request.cancelled_at,
    'propertyPublicRef', v_property.public_ref,
    'propertyLabel', v_property.name,
    'serviceType', v_request.service_type,
    'preferredDate', v_request.preferred_date,
    'preferredTimeWindow', v_request.preferred_time_window,
    'notes', coalesce(v_request.notes, ''),
    'version', v_request.version
  );
end;
$$;

revoke all on function public.portal_list_services_v2(text, integer) from public, anon;
revoke all on function public.portal_get_service_v2(text, text) from public, anon;
revoke all on function public.portal_list_own_service_requests_v2(text, integer) from public, anon;
revoke all on function public.portal_get_own_service_request_v2(text, text) from public, anon;
revoke all on function public.portal_submit_service_request_v2(text, text, text, date, uuid, text, text) from public, anon;
revoke all on function public.portal_cancel_own_service_request_v2(text, text, integer) from public, anon;

grant execute on function public.portal_list_services_v2(text, integer) to authenticated;
grant execute on function public.portal_get_service_v2(text, text) to authenticated;
grant execute on function public.portal_list_own_service_requests_v2(text, integer) to authenticated;
grant execute on function public.portal_get_own_service_request_v2(text, text) to authenticated;
grant execute on function public.portal_submit_service_request_v2(text, text, text, date, uuid, text, text) to authenticated;
grant execute on function public.portal_cancel_own_service_request_v2(text, text, integer) to authenticated;

alter function portal_private.generate_service_public_reference_v2() owner to postgres;
alter function portal_private.generate_service_request_public_reference_v2() owner to postgres;
alter function public.portal_list_services_v2(text, integer) owner to postgres;
alter function public.portal_get_service_v2(text, text) owner to postgres;
alter function public.portal_list_own_service_requests_v2(text, integer) owner to postgres;
alter function public.portal_get_own_service_request_v2(text, text) owner to postgres;
alter function public.portal_submit_service_request_v2(text, text, text, date, uuid, text, text) owner to postgres;
alter function public.portal_cancel_own_service_request_v2(text, text, integer) owner to postgres;
