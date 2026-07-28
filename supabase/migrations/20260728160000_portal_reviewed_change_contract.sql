begin;

alter table public.client_portal_profile_change_requests
  add column idempotency_key uuid,
  add column public_reference text;

alter table public.client_portal_property_change_requests
  add column idempotency_key uuid,
  add column public_reference text;

alter table public.client_portal_profile_change_requests
  add constraint client_portal_profile_change_public_reference_format
  check (public_reference is null or public_reference ~ '^CC-PR-[0-9A-F]{24}$');

alter table public.client_portal_property_change_requests
  add constraint client_portal_property_change_public_reference_format
  check (public_reference is null or public_reference ~ '^CC-PT-[0-9A-F]{24}$');

create unique index client_portal_profile_change_v2_idempotency_uidx
  on public.client_portal_profile_change_requests (requested_by, idempotency_key)
  where idempotency_key is not null;
create unique index client_portal_property_change_v2_idempotency_uidx
  on public.client_portal_property_change_requests (requested_by, idempotency_key)
  where idempotency_key is not null;
create unique index client_portal_profile_change_v2_public_reference_uidx
  on public.client_portal_profile_change_requests (public_reference)
  where public_reference is not null;
create unique index client_portal_property_change_v2_public_reference_uidx
  on public.client_portal_property_change_requests (public_reference)
  where public_reference is not null;

create or replace function portal_private.normalize_profile_change_v2(
  p_changes jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_value text;
  v_normalized jsonb := '{}'::jsonb;
begin
  if p_changes is null
    or jsonb_typeof(p_changes) <> 'object'
    or (select count(*) from jsonb_object_keys(p_changes)) not between 1 and 5
  then
    raise exception 'invalid_change_request' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_changes)
  loop
    if v_key not in ('fullName', 'phone', 'email', 'taxId', 'billingAddress')
      or jsonb_typeof(p_changes -> v_key) <> 'string'
    then
      raise exception 'invalid_change_request' using errcode = '22023';
    end if;

    v_value := btrim(p_changes ->> v_key);
    if v_value = ''
      or v_value ~ '[[:cntrl:]]'
      or v_value ~ '[<>]'
      or (v_key = 'fullName' and char_length(v_value) > 200)
      or (v_key = 'phone' and char_length(v_value) > 40)
      or (v_key = 'email' and (
        char_length(v_value) > 320
        or v_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      ))
      or (v_key = 'taxId' and char_length(v_value) > 80)
      or (v_key = 'billingAddress' and char_length(v_value) > 320)
    then
      raise exception 'invalid_change_request' using errcode = '22023';
    end if;

    if v_key = 'email' then
      v_value := lower(v_value);
    elsif v_key = 'taxId' then
      v_value := upper(v_value);
    end if;
    v_normalized := v_normalized || jsonb_build_object(v_key, v_value);
  end loop;

  return v_normalized;
end;
$$;

create or replace function portal_private.normalize_property_change_v2(
  p_changes jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_value text;
  v_normalized jsonb := '{}'::jsonb;
begin
  if p_changes is null
    or jsonb_typeof(p_changes) <> 'object'
    or (select count(*) from jsonb_object_keys(p_changes)) not between 1 and 5
  then
    raise exception 'invalid_change_request' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_changes)
  loop
    if v_key not in ('name', 'propertyType', 'address', 'city', 'postalCode')
      or jsonb_typeof(p_changes -> v_key) <> 'string'
    then
      raise exception 'invalid_change_request' using errcode = '22023';
    end if;

    v_value := btrim(p_changes ->> v_key);
    if v_value = ''
      or v_value ~ '[[:cntrl:]]'
      or v_value ~ '[<>]'
      or (v_key = 'name' and char_length(v_value) > 200)
      or (v_key = 'propertyType' and char_length(v_value) > 80)
      or (v_key = 'address' and char_length(v_value) > 320)
      or (v_key = 'city' and char_length(v_value) > 120)
      or (v_key = 'postalCode' and char_length(v_value) > 32)
    then
      raise exception 'invalid_change_request' using errcode = '22023';
    end if;
    v_normalized := v_normalized || jsonb_build_object(v_key, v_value);
  end loop;

  return v_normalized;
end;
$$;

create or replace function portal_private.reviewed_change_receipt_v2(
  p_reference text,
  p_status text,
  p_requested_at timestamptz,
  p_changes jsonb,
  p_request_type text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'reference', p_reference,
    'status', p_status,
    'requestedAt', p_requested_at,
    'changedFields', (
      select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
      from jsonb_object_keys(p_changes) as k
    ),
    'requestType', p_request_type
  );
$$;

create or replace function public.portal_submit_profile_change_request_v2(
  p_client_id text,
  p_proposed_changes jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_changes jsonb;
  v_client public.clients%rowtype;
  v_existing public.client_portal_profile_change_requests%rowtype;
  v_created public.client_portal_profile_change_requests%rowtype;
  v_reference text;
  v_key text;
  v_attempt integer;
  v_constraint_name text;
  v_canonical text;
  v_rate_subject text;
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
  v_changes := portal_private.normalize_profile_change_v2(p_proposed_changes);

  select * into v_existing
  from public.client_portal_profile_change_requests
  where requested_by = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.client_id is distinct from p_client_id
      or v_existing.proposed_changes is distinct from v_changes
      or v_existing.public_reference is null
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return portal_private.reviewed_change_receipt_v2(
      v_existing.public_reference, v_existing.status, v_existing.requested_at,
      v_existing.proposed_changes, 'profile'
    );
  end if;

  select * into v_client
  from public.clients
    where id = p_client_id
      and status = 'active'
      and deleted_at is null
      and archived_at is null
  for share;
  if not found then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  for v_key in select jsonb_object_keys(v_changes)
  loop
    v_canonical := case v_key
      when 'fullName' then btrim(v_client.full_name)
      when 'phone' then btrim(v_client.phone)
      when 'email' then lower(btrim(v_client.email))
      when 'taxId' then upper(btrim(v_client.tax_id))
      when 'billingAddress' then btrim(v_client.billing_address)
    end;
    if v_canonical is not distinct from (v_changes ->> v_key) then
      raise exception 'invalid_change_request' using errcode = '22023';
    end if;
  end loop;

  for v_attempt in 1..5 loop
    v_reference := 'CC-PR-' || upper(substr(encode(sha256(convert_to(
      gen_random_uuid()::text || ':' || gen_random_uuid()::text, 'UTF8'
    )), 'hex'), 1, 24));
    begin
      insert into public.client_portal_profile_change_requests (
        client_id, requested_by, proposed_changes, idempotency_key, public_reference
      ) values (
        p_client_id, v_user_id, v_changes, p_idempotency_key, v_reference
      )
      on conflict (requested_by, idempotency_key)
        where idempotency_key is not null
      do nothing
      returning * into v_created;
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name = 'client_portal_profile_change_v2_public_reference_uidx' then
          continue;
        end if;
        raise;
    end;
  end loop;

  if v_created.id is null then
    select * into v_existing
    from public.client_portal_profile_change_requests
    where requested_by = v_user_id and idempotency_key = p_idempotency_key;
    if v_existing.client_id is distinct from p_client_id
      or v_existing.proposed_changes is distinct from v_changes
      or v_existing.public_reference is null
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return portal_private.reviewed_change_receipt_v2(
      v_existing.public_reference, v_existing.status, v_existing.requested_at,
      v_existing.proposed_changes, 'profile'
    );
  end if;
  if v_created.public_reference is null then
    raise exception 'reference_generation_failed' using errcode = 'P0001';
  end if;

  v_rate_subject := encode(sha256(convert_to(
    'profile_change_v2:' || v_user_id::text || ':' || p_client_id, 'UTF8'
  )), 'hex');
  if not portal_private.consume_rate_limit('profile_change_v2', v_rate_subject, 5, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  perform portal_private.write_audit_event(
    'profile_change_requested', 'accepted', v_user_id, v_membership_id,
    p_client_id, 'profile_change', v_created.id, gen_random_uuid(),
    null, null, jsonb_build_object('fields', (
      select jsonb_agg(k order by k) from jsonb_object_keys(v_changes) as k
    ))
  );
  return portal_private.reviewed_change_receipt_v2(
    v_created.public_reference, v_created.status, v_created.requested_at,
    v_created.proposed_changes, 'profile'
  );
end;
$$;

create or replace function public.portal_submit_property_change_request_v2(
  p_client_id text,
  p_property_id text,
  p_proposed_changes jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_changes jsonb;
  v_property public.properties%rowtype;
  v_existing public.client_portal_property_change_requests%rowtype;
  v_created public.client_portal_property_change_requests%rowtype;
  v_reference text;
  v_key text;
  v_attempt integer;
  v_constraint_name text;
  v_canonical text;
  v_rate_subject text;
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
  v_changes := portal_private.normalize_property_change_v2(p_proposed_changes);

  select * into v_existing
  from public.client_portal_property_change_requests
  where requested_by = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.client_id is distinct from p_client_id
      or v_existing.property_id is distinct from p_property_id
      or v_existing.proposed_changes is distinct from v_changes
      or v_existing.public_reference is null
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return portal_private.reviewed_change_receipt_v2(
      v_existing.public_reference, v_existing.status, v_existing.requested_at,
      v_existing.proposed_changes, 'property'
    );
  end if;

  select * into v_property
  from public.properties
    where id = p_property_id
      and client_id = p_client_id
      and status = 'active'
      and deleted_at is null
      and archived_at is null
  for share;
  if not found then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  for v_key in select jsonb_object_keys(v_changes)
  loop
    v_canonical := case v_key
      when 'name' then btrim(v_property.name)
      when 'propertyType' then btrim(v_property.property_type)
      when 'address' then btrim(v_property.address)
      when 'city' then btrim(v_property.city)
      when 'postalCode' then btrim(v_property.postal_code)
    end;
    if v_canonical is not distinct from (v_changes ->> v_key) then
      raise exception 'invalid_change_request' using errcode = '22023';
    end if;
  end loop;

  for v_attempt in 1..5 loop
    v_reference := 'CC-PT-' || upper(substr(encode(sha256(convert_to(
      gen_random_uuid()::text || ':' || gen_random_uuid()::text, 'UTF8'
    )), 'hex'), 1, 24));
    begin
      insert into public.client_portal_property_change_requests (
        client_id, property_id, requested_by, proposed_changes,
        idempotency_key, public_reference
      ) values (
        p_client_id, p_property_id, v_user_id, v_changes,
        p_idempotency_key, v_reference
      )
      on conflict (requested_by, idempotency_key)
        where idempotency_key is not null
      do nothing
      returning * into v_created;
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name = 'client_portal_property_change_v2_public_reference_uidx' then
          continue;
        end if;
        raise;
    end;
  end loop;

  if v_created.id is null then
    select * into v_existing
    from public.client_portal_property_change_requests
    where requested_by = v_user_id and idempotency_key = p_idempotency_key;
    if v_existing.client_id is distinct from p_client_id
      or v_existing.property_id is distinct from p_property_id
      or v_existing.proposed_changes is distinct from v_changes
      or v_existing.public_reference is null
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return portal_private.reviewed_change_receipt_v2(
      v_existing.public_reference, v_existing.status, v_existing.requested_at,
      v_existing.proposed_changes, 'property'
    );
  end if;
  if v_created.public_reference is null then
    raise exception 'reference_generation_failed' using errcode = 'P0001';
  end if;

  v_rate_subject := encode(sha256(convert_to(
    'property_change_v2:' || v_user_id::text || ':' || p_client_id, 'UTF8'
  )), 'hex');
  if not portal_private.consume_rate_limit('property_change_v2', v_rate_subject, 5, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  perform portal_private.write_audit_event(
    'property_change_requested', 'accepted', v_user_id, v_membership_id,
    p_client_id, 'property_change', v_created.id, gen_random_uuid(),
    null, null, jsonb_build_object('fields', (
      select jsonb_agg(k order by k) from jsonb_object_keys(v_changes) as k
    ))
  );
  return portal_private.reviewed_change_receipt_v2(
    v_created.public_reference, v_created.status, v_created.requested_at,
    v_created.proposed_changes, 'property'
  );
end;
$$;

create or replace function public.portal_list_own_profile_change_requests_v2(
  p_client_id text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
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
      'status', r.status,
      'requestedAt', r.requested_at,
      'resolvedAt', r.reviewed_at,
      'changedFields', (
        select jsonb_agg(k order by k)
        from jsonb_object_keys(r.proposed_changes) as k
      ),
      'requestType', 'profile'
    ) order by r.requested_at desc, r.public_reference desc)
    from (
      select * from public.client_portal_profile_change_requests
      where client_id = p_client_id
        and requested_by = v_user_id
        and public_reference is not null
        and idempotency_key is not null
      order by requested_at desc, public_reference desc
      limit p_limit
    ) as r
  ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_list_own_property_change_requests_v2(
  p_client_id text,
  p_property_id text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
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
  perform 1 from public.properties
    where id = p_property_id
      and client_id = p_client_id
      and status = 'active'
      and deleted_at is null
      and archived_at is null;
  if not found then
    raise exception 'resource_not_found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'reference', r.public_reference,
      'status', r.status,
      'requestedAt', r.requested_at,
      'resolvedAt', r.reviewed_at,
      'changedFields', (
        select jsonb_agg(k order by k)
        from jsonb_object_keys(r.proposed_changes) as k
      ),
      'requestType', 'property'
    ) order by r.requested_at desc, r.public_reference desc)
    from (
      select * from public.client_portal_property_change_requests
      where client_id = p_client_id
        and property_id = p_property_id
        and requested_by = v_user_id
        and public_reference is not null
        and idempotency_key is not null
      order by requested_at desc, public_reference desc
      limit p_limit
    ) as r
  ), '[]'::jsonb);
end;
$$;

drop policy "Portal reads same-client profile requests"
  on public.client_portal_profile_change_requests;
drop policy "Portal reads same-client property requests"
  on public.client_portal_property_change_requests;

revoke execute on function
  public.portal_submit_profile_change_trusted(uuid, text, jsonb, text, uuid)
from service_role;
revoke execute on function
  public.portal_submit_property_change_trusted(uuid, text, text, jsonb, text, uuid)
from service_role;

alter function portal_private.normalize_profile_change_v2(jsonb) owner to postgres;
alter function portal_private.normalize_property_change_v2(jsonb) owner to postgres;
alter function portal_private.reviewed_change_receipt_v2(text, text, timestamptz, jsonb, text)
  owner to postgres;
alter function public.portal_submit_profile_change_request_v2(text, jsonb, uuid)
  owner to postgres;
alter function public.portal_submit_property_change_request_v2(text, text, jsonb, uuid)
  owner to postgres;
alter function public.portal_list_own_profile_change_requests_v2(text, integer)
  owner to postgres;
alter function public.portal_list_own_property_change_requests_v2(text, text, integer)
  owner to postgres;

revoke all on function portal_private.normalize_profile_change_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function portal_private.normalize_property_change_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function portal_private.reviewed_change_receipt_v2(text, text, timestamptz, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_submit_profile_change_request_v2(text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_submit_property_change_request_v2(text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_list_own_profile_change_requests_v2(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_list_own_property_change_requests_v2(text, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.portal_submit_profile_change_request_v2(text, jsonb, uuid)
  to authenticated;
grant execute on function public.portal_submit_property_change_request_v2(text, text, jsonb, uuid)
  to authenticated;
grant execute on function public.portal_list_own_profile_change_requests_v2(text, integer)
  to authenticated;
grant execute on function public.portal_list_own_property_change_requests_v2(text, text, integer)
  to authenticated;

comment on function public.portal_submit_profile_change_request_v2(text, jsonb, uuid)
  is 'Authenticated requester-only profile correction contract with atomic idempotency.';
comment on function public.portal_submit_property_change_request_v2(text, text, jsonb, uuid)
  is 'Authenticated requester-only eligible-property correction contract with atomic idempotency.';
comment on function public.portal_list_own_profile_change_requests_v2(text, integer)
  is 'Minimized requester-only profile correction status list.';
comment on function public.portal_list_own_property_change_requests_v2(text, text, integer)
  is 'Minimized requester-only eligible-property correction status list.';

commit;
