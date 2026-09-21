begin;

-- Minimal internal-staff boundary required by the persisted operational-alert state.
-- This intentionally does NOT replay the broader client-portal foundation migration.

create schema if not exists portal_private;
revoke all on schema portal_private from public, anon, authenticated;

create table if not exists public.internal_staff_memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null
    check (role in ('owner', 'admin', 'operator', 'finance', 'readonly')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason_code text,
  check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create or replace function portal_private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function portal_private.set_updated_at() from public, anon, authenticated, service_role;

drop trigger if exists internal_staff_memberships_updated_at on public.internal_staff_memberships;
create trigger internal_staff_memberships_updated_at
before update on public.internal_staff_memberships
for each row execute function portal_private.set_updated_at();

create or replace function portal_private.is_active_internal_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.internal_staff_memberships as m
      where m.user_id = p_user_id
        and m.status = 'active'
        and m.revoked_at is null
    );
$$;

revoke all on function portal_private.is_active_internal_staff(uuid) from public, anon, authenticated, service_role;
grant execute on function portal_private.is_active_internal_staff(uuid) to authenticated;

alter table public.internal_staff_memberships enable row level security;
alter table public.internal_staff_memberships force row level security;

drop policy if exists "Internal staff read staff memberships" on public.internal_staff_memberships;
create policy "Internal staff read staff memberships"
on public.internal_staff_memberships for select
to authenticated
using (portal_private.is_active_internal_staff(auth.uid()));

revoke all on table public.internal_staff_memberships from anon, authenticated;
grant select on table public.internal_staff_memberships to authenticated;
grant all on table public.internal_staff_memberships to service_role;

-- Persisted operational-alert lifecycle state.
create table if not exists public.operational_alert_decisions (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  fingerprint text not null,
  scope text not null default 'global' check (scope in ('global', 'user')),
  user_id uuid references auth.users(id) on delete cascade,
  owner_key text generated always as (
    case when scope = 'global' then 'global' else user_id::text end
  ) stored,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  read_at timestamptz,
  resolved_at timestamptz,
  dismissed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_alert_decisions_scope_user_ck check (
    (scope = 'global' and user_id is null)
    or (scope = 'user' and user_id is not null)
  )
);

create unique index if not exists operational_alert_decisions_owner_key_idx
  on public.operational_alert_decisions(alert_key, fingerprint, owner_key);

create index if not exists operational_alert_decisions_user_read_idx
  on public.operational_alert_decisions(user_id, read_at, updated_at)
  where scope = 'user';

create or replace function public.set_operational_alert_decision_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_operational_alert_decision_updated_at() from public, anon, authenticated;
grant execute on function public.set_operational_alert_decision_updated_at() to service_role;

drop trigger if exists operational_alert_decisions_updated_at on public.operational_alert_decisions;
create trigger operational_alert_decisions_updated_at
before update on public.operational_alert_decisions
for each row execute function public.set_operational_alert_decision_updated_at();

alter table public.operational_alert_decisions enable row level security;
alter table public.operational_alert_decisions force row level security;

drop policy if exists "Internal users read alert decisions" on public.operational_alert_decisions;
create policy "Internal users read alert decisions"
on public.operational_alert_decisions for select
to authenticated
using (
  (scope = 'user' and user_id = (select auth.uid()))
  or (scope = 'global' and portal_private.is_active_internal_staff((select auth.uid())))
);

drop policy if exists "Users create own alert reads" on public.operational_alert_decisions;
create policy "Users create own alert reads"
on public.operational_alert_decisions for insert
to authenticated
with check (
  (scope = 'user' and user_id = (select auth.uid()))
  or (scope = 'global' and portal_private.is_active_internal_staff((select auth.uid())))
);

drop policy if exists "Users update own alert decisions" on public.operational_alert_decisions;
create policy "Users update own alert decisions"
on public.operational_alert_decisions for update
to authenticated
using (
  (scope = 'user' and user_id = (select auth.uid()))
  or (scope = 'global' and portal_private.is_active_internal_staff((select auth.uid())))
)
with check (
  (scope = 'user' and user_id = (select auth.uid()))
  or (scope = 'global' and portal_private.is_active_internal_staff((select auth.uid())))
);

revoke all on table public.operational_alert_decisions from anon, authenticated;
grant select, insert, update on table public.operational_alert_decisions to authenticated;
grant all on table public.operational_alert_decisions to service_role;

notify pgrst, 'reload schema';

commit;
