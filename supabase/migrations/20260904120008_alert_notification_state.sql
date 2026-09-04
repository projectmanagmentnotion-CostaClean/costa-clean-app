create table if not exists public.operational_alert_decisions (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  fingerprint text not null,
  scope text not null default 'global' check (scope in ('global', 'user')),
  user_id uuid references auth.users(id) on delete cascade,
  owner_key text generated always as (case when scope = 'global' then 'global' else user_id::text end) stored,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  read_at timestamptz,
  resolved_at timestamptz,
  dismissed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_alert_decisions_scope_user_ck check (
    (scope = 'global' and user_id is null) or (scope = 'user' and user_id is not null)
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
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

revoke all on table public.operational_alert_decisions from anon;
grant select, insert, update on table public.operational_alert_decisions to authenticated;
grant all on table public.operational_alert_decisions to service_role;

revoke all on function public.set_operational_alert_decision_updated_at() from public, anon, authenticated;
