begin;

create or replace function app_private.internal_staff_role_can_write(p_role text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(p_role = any(array['owner', 'admin', 'operator', 'finance']::text[]), false)
$function$;

create or replace function app_private.internal_staff_role_can_write_financially(p_role text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(p_role = any(array['owner', 'admin', 'finance']::text[]), false)
$function$;

alter function app_private.internal_staff_role_can_write(text) owner to postgres;
alter function app_private.internal_staff_role_can_write_financially(text) owner to postgres;
revoke all on function app_private.internal_staff_role_can_write(text) from public, anon, authenticated, service_role;
revoke all on function app_private.internal_staff_role_can_write_financially(text) from public, anon, authenticated, service_role;

create or replace function app_private.require_internal_staff_write()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  select membership.role into v_role
    from public.internal_staff_memberships as membership
   where membership.user_id = v_user_id
     and membership.status = 'active'
     and membership.revoked_at is null;
  if v_role is null or not app_private.internal_staff_role_can_write(v_role) then
    raise exception 'Internal staff write permission required.' using errcode = '42501';
  end if;
  return v_user_id;
end;
$function$;

create or replace function app_private.require_internal_financial_write()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  select membership.role into v_role
    from public.internal_staff_memberships as membership
   where membership.user_id = v_user_id
     and membership.status = 'active'
     and membership.revoked_at is null;
  if v_role is null or not app_private.internal_staff_role_can_write_financially(v_role) then
    raise exception 'Internal financial write permission required.' using errcode = '42501';
  end if;
  return v_user_id;
end;
$function$;

alter function app_private.require_internal_staff_write() owner to postgres;
alter function app_private.require_internal_financial_write() owner to postgres;
revoke all on function app_private.require_internal_staff_write() from public, anon, authenticated, service_role;
revoke all on function app_private.require_internal_financial_write() from public, anon, authenticated, service_role;

commit;
