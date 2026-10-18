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
alter function app_private.internal_staff_role_can_write(text) owner to postgres;
alter function app_private.internal_staff_role_can_write_financially(text) owner to postgres;
revoke all on function app_private.require_internal_staff_write() from public, anon, authenticated, service_role;
revoke all on function app_private.require_internal_financial_write() from public, anon, authenticated, service_role;
revoke all on function app_private.internal_staff_role_can_write(text) from public, anon, authenticated, service_role;
revoke all on function app_private.internal_staff_role_can_write_financially(text) from public, anon, authenticated, service_role;

create or replace function public.require_authenticated_write()
returns void language plpgsql security definer set search_path = '' as $function$
begin
  perform app_private.require_internal_staff_write();
end;
$function$;

create or replace function public.require_authenticated_financial_write()
returns void language plpgsql security definer set search_path = '' as $function$
begin
  perform app_private.require_internal_financial_write();
end;
$function$;

alter function public.require_authenticated_write() owner to postgres;
alter function public.require_authenticated_financial_write() owner to postgres;
revoke execute on function public.require_authenticated_write() from public, anon, authenticated;
revoke execute on function public.require_authenticated_financial_write() from public, anon, authenticated;

create or replace function app_private.is_n11_hygiene_fixture_id(p_entity_id text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p_entity_id is not null
     and pg_catalog.left(p_entity_id, pg_catalog.length('QA_HYGIENE_N11_')) = 'QA_HYGIENE_N11_'
$function$;
alter function app_private.is_n11_hygiene_fixture_id(text) owner to postgres;
revoke all on function app_private.is_n11_hygiene_fixture_id(text) from public, anon, authenticated, service_role;

alter table app_private.data_hygiene_actions
  drop constraint data_hygiene_actions_entity_id_check;
alter table app_private.data_hygiene_actions
  add constraint data_hygiene_actions_literal_fixture_prefix_check
  check (app_private.is_n11_hygiene_fixture_id(entity_id));

alter function app_private.build_data_hygiene_n11_plan() rename to build_data_hygiene_n11_plan_legacy;
revoke all on function app_private.build_data_hygiene_n11_plan_legacy() from public, anon, authenticated, service_role;

create or replace function app_private.build_data_hygiene_n11_plan()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan jsonb;
  v_actions jsonb;
begin
  v_plan := app_private.build_data_hygiene_n11_plan_legacy();
  select coalesce(pg_catalog.jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
    into v_actions
    from pg_catalog.jsonb_array_elements(v_plan -> 'actions') with ordinality as item(value, ordinality)
   where app_private.is_n11_hygiene_fixture_id(item.value ->> 'entity_id')
     and case item.value ->> 'action_type'
       when 'RELINK_RELATION' then pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('QA_HYGIENE_N11_RELINK_')) = 'QA_HYGIENE_N11_RELINK_'
       when 'ARCHIVE_STALE_RECORD' then pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('QA_HYGIENE_N11_ARCHIVE_')) = 'QA_HYGIENE_N11_ARCHIVE_'
       when 'MANUAL_REVIEW_REQUIRED' then pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('QA_HYGIENE_N11_AMBIGUOUS_')) = 'QA_HYGIENE_N11_AMBIGUOUS_'
       else false
     end;
  return v_plan || pg_catalog.jsonb_build_object('actions', v_actions);
end;
$function$;
alter function app_private.build_data_hygiene_n11_plan() owner to postgres;
revoke all on function app_private.build_data_hygiene_n11_plan() from public, anon, authenticated, service_role;

alter function public.data_hygiene_n11_apply_qa(jsonb, text) set schema app_private;
alter function app_private.data_hygiene_n11_apply_qa(jsonb, text) rename to apply_data_hygiene_n11_legacy;
revoke all on function app_private.apply_data_hygiene_n11_legacy(jsonb, text) from public, anon, authenticated, service_role;

create or replace function public.data_hygiene_n11_apply_qa(p_plan jsonb, p_plan_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_internal_staff_write();

  if p_plan is null
     or pg_catalog.jsonb_typeof(p_plan) <> 'object'
     or pg_catalog.jsonb_typeof(p_plan -> 'actions') <> 'array'
     or pg_catalog.jsonb_array_length(p_plan -> 'actions') > 100
     or (select count(*) from pg_catalog.jsonb_object_keys(p_plan) as plan_key) <> 4 then
    raise exception 'Invalid data hygiene plan contract.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_plan -> 'actions') as item(value)
     where pg_catalog.jsonb_typeof(item.value) <> 'object'
        or not app_private.is_n11_hygiene_fixture_id(item.value ->> 'entity_id')
        or case item.value ->> 'action_type'
          when 'RELINK_RELATION' then pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('QA_HYGIENE_N11_RELINK_')) <> 'QA_HYGIENE_N11_RELINK_'
          when 'ARCHIVE_STALE_RECORD' then pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('QA_HYGIENE_N11_ARCHIVE_')) <> 'QA_HYGIENE_N11_ARCHIVE_'
          when 'MANUAL_REVIEW_REQUIRED' then pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('QA_HYGIENE_N11_AMBIGUOUS_')) <> 'QA_HYGIENE_N11_AMBIGUOUS_'
          else true
        end
  ) then
    raise exception 'Plan contains an entity outside the literal synthetic QA fixture namespace.' using errcode = '22023';
  end if;

  return app_private.apply_data_hygiene_n11_legacy(p_plan, p_plan_hash);
end;
$function$;

alter function public.data_hygiene_n11_apply_qa(jsonb, text) owner to postgres;
revoke all on function public.data_hygiene_n11_apply_qa(jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.data_hygiene_n11_apply_qa(jsonb, text) to authenticated;

commit;
