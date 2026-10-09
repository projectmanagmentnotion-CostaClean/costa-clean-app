begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;

create table if not exists public.internal_staff_memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'operator', 'finance', 'readonly')),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete restrict,
  revocation_reason_code text null,
  check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

alter table public.internal_staff_memberships enable row level security;
revoke all on table public.internal_staff_memberships from public, anon, authenticated, service_role;

do $membership_contract$
declare
  v_table oid := to_regclass('public.internal_staff_memberships');
  v_role_check boolean;
  v_status_check boolean;
  v_revocation_check boolean;
  v_user_fk boolean;
begin
  if v_table is null then
    raise exception 'APP internal-staff membership relation is missing.' using errcode = '55000';
  end if;

  if exists (
    select required.column_name, required.data_type, required.is_nullable
    from (values
      ('user_id', 'uuid', 'NO'),
      ('role', 'text', 'NO'),
      ('status', 'text', 'NO'),
      ('created_at', 'timestamp with time zone', 'NO'),
      ('created_by', 'uuid', 'YES'),
      ('updated_at', 'timestamp with time zone', 'NO'),
      ('revoked_at', 'timestamp with time zone', 'YES'),
      ('revoked_by', 'uuid', 'YES'),
      ('revocation_reason_code', 'text', 'YES')
    ) as required(column_name, data_type, is_nullable)
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = 'internal_staff_memberships'
     and actual.column_name = required.column_name
    where actual.column_name is null
       or actual.data_type <> required.data_type
       or actual.is_nullable <> required.is_nullable
  ) then
    raise exception 'APP internal-staff membership relation has an incompatible column contract.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = v_table and c.contype = 'p'
      and c.conkey = array[(select a.attnum from pg_attribute a where a.attrelid = v_table and a.attname = 'user_id')]::smallint[]
  ) then
    raise exception 'APP internal-staff membership relation must have user_id as its primary key.' using errcode = '55000';
  end if;

  select
    coalesce(bool_or(c.contype = 'c' and c.convalidated and lower(pg_get_constraintdef(c.oid)) like '%role%' and lower(pg_get_constraintdef(c.oid)) like '%owner%' and lower(pg_get_constraintdef(c.oid)) like '%admin%' and lower(pg_get_constraintdef(c.oid)) like '%operator%' and lower(pg_get_constraintdef(c.oid)) like '%finance%' and lower(pg_get_constraintdef(c.oid)) like '%readonly%'), false),
    coalesce(bool_or(c.contype = 'c' and c.convalidated and lower(pg_get_constraintdef(c.oid)) like '%status%' and lower(pg_get_constraintdef(c.oid)) like '%active%' and lower(pg_get_constraintdef(c.oid)) like '%suspended%' and lower(pg_get_constraintdef(c.oid)) like '%revoked%'), false),
    coalesce(bool_or(c.contype = 'c' and c.convalidated and lower(pg_get_constraintdef(c.oid)) like '%revoked_at%' and lower(pg_get_constraintdef(c.oid)) like '%status%'), false)
  into v_role_check, v_status_check, v_revocation_check
  from pg_constraint c
  where c.conrelid = v_table;

  if not v_role_check or not v_status_check or not v_revocation_check then
    raise exception 'APP internal-staff membership role/status/revocation constraints are incompatible.' using errcode = '55000';
  end if;

  select exists (
    select 1 from pg_constraint c
    where c.conrelid = v_table and c.contype = 'f' and c.convalidated
      and c.conkey = array[(select a.attnum from pg_attribute a where a.attrelid = v_table and a.attname = 'user_id')]::smallint[]
      and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'r'
  ) into v_user_fk;
  if not v_user_fk then
    raise exception 'APP internal-staff membership user_id must reference auth.users with ON DELETE RESTRICT.' using errcode = '55000';
  end if;

  if not (select c.relrowsecurity from pg_class c where c.oid = v_table) then
    raise exception 'APP internal-staff membership relation must have RLS enabled.' using errcode = '55000';
  end if;
end;
$membership_contract$;

create or replace function app_private.is_active_internal_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
     and p_user_id = auth.uid()
     and exists (
       select 1
       from public.internal_staff_memberships as membership
       where membership.user_id = p_user_id
         and membership.status = 'active'
         and membership.revoked_at is null
     );
$function$;

create or replace function app_private.require_active_internal_staff()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not app_private.is_active_internal_staff(v_user_id) then
    raise exception 'Active internal staff membership required.' using errcode = '42501';
  end if;
  return v_user_id;
end;
$function$;

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

alter function app_private.is_active_internal_staff(uuid) owner to postgres;
alter function app_private.require_active_internal_staff() owner to postgres;
alter function app_private.internal_staff_role_can_write(text) owner to postgres;
alter function app_private.internal_staff_role_can_write_financially(text) owner to postgres;
alter function app_private.require_internal_staff_write() owner to postgres;
alter function app_private.require_internal_financial_write() owner to postgres;
revoke all on function app_private.is_active_internal_staff(uuid) from public, anon, authenticated, service_role;
revoke all on function app_private.require_active_internal_staff() from public, anon, authenticated, service_role;
revoke all on function app_private.internal_staff_role_can_write(text) from public, anon, authenticated, service_role;
revoke all on function app_private.internal_staff_role_can_write_financially(text) from public, anon, authenticated, service_role;
revoke all on function app_private.require_internal_staff_write() from public, anon, authenticated, service_role;
revoke all on function app_private.require_internal_financial_write() from public, anon, authenticated, service_role;

create or replace function public.require_authenticated_write()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_internal_staff_write();
end;
$function$;

create or replace function public.require_authenticated_financial_write()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_internal_financial_write();
end;
$function$;

alter function public.require_authenticated_write() owner to postgres;
alter function public.require_authenticated_financial_write() owner to postgres;
revoke execute on function public.require_authenticated_write() from public, anon, authenticated;
revoke execute on function public.require_authenticated_financial_write() from public, anon, authenticated;

commit;
