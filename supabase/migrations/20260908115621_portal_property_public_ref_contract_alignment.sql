create or replace function public.portal_list_properties(p_client_id text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'publicRef', p.display_code,
    'name', p.name,
    'propertyType', p.property_type,
    'address', p.address,
    'city', p.city,
    'postalCode', p.postal_code,
    'status', p.status
  ) order by p.created_at desc), '[]'::jsonb)
  from (
    select *
    from public.properties
    where client_id = portal_private.current_portal_client_id(p_client_id)
      and deleted_at is null
      and archived_at is null
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as p;
$$;

create or replace function public.portal_get_property(p_client_id text, p_property_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select jsonb_build_object(
    'id', p.id,
    'publicRef', p.display_code,
    'name', p.name,
    'propertyType', p.property_type,
    'address', p.address,
    'city', p.city,
    'postalCode', p.postal_code,
    'status', p.status
  )
  from public.properties as p
  where p.client_id = portal_private.current_portal_client_id(p_client_id)
    and p.id = p_property_id
    and p.deleted_at is null
    and p.archived_at is null;
$$;
