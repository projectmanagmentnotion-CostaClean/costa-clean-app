-- CP-3C.2R: customer-safe denial semantics for read RPCs.
-- Unauthorized client context becomes NULL, so filtered reads return no data
-- instead of surfacing PostgREST 500/P0002. Write authorization is unchanged.
create or replace function portal_private.current_portal_client_id(p_client_id text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select case
    when portal_private.has_active_portal_membership(auth.uid(), p_client_id)
      then p_client_id
    else null::text
  end;
$$;

-- Rollback:
-- create or replace function portal_private.current_portal_client_id(p_client_id text)
-- returns text language plpgsql stable security definer
-- set search_path = pg_catalog, public, portal_private as $$
-- begin
--   if not portal_private.has_active_portal_membership(auth.uid(), p_client_id) then
--     raise exception 'resource_not_found' using errcode = 'P0002';
--   end if;
--   return p_client_id;
-- end;
-- $$;
