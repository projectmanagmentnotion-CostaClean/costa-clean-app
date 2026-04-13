-- First accountability layer for key CostaClean business records.
-- This migration only adds audit infrastructure; it does not modify or delete existing data.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  changed_fields text[] not null default '{}',
  previous_values jsonb,
  new_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  constraint audit_events_entity_type_check check (
    entity_type in ('quote', 'invoice', 'payment', 'expense')
  ),
  constraint audit_events_action_check check (
    action in ('upsert', 'status_update', 'attachment_update', 'fiscal_analysis')
  )
);

create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, changed_at desc);

create index if not exists audit_events_changed_at_idx
  on public.audit_events (changed_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "Authenticated users can read audit events" on public.audit_events;
create policy "Authenticated users can read audit events"
  on public.audit_events
  for select
  to authenticated
  using (auth.uid() is not null);

create or replace function public.record_audit_event(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_changed_fields text[] default '{}',
  p_new_values jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for audit events.';
  end if;

  insert into public.audit_events (
    entity_type,
    entity_id,
    action,
    changed_fields,
    new_values,
    metadata,
    changed_by
  )
  values (
    p_entity_type,
    p_entity_id,
    p_action,
    coalesce(p_changed_fields, '{}'),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

revoke execute on function public.record_audit_event(text, text, text, text[], jsonb, jsonb) from public, anon;
grant execute on function public.record_audit_event(text, text, text, text[], jsonb, jsonb) to authenticated;
