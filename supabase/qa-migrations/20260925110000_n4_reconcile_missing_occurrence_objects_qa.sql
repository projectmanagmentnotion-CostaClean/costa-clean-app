-- QA-only additive reconciliation for the N4 recurring-services catalog.
-- The QA project already contains recurring_service_plans and the N4 jobs
-- columns. This migration adds only the missing slots/occurrences objects
-- and the two missing N4 write RPCs. Never apply to Production.

create table if not exists public.recurring_service_plan_slots (
  recurring_service_plan_id text not null references public.recurring_service_plans(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time,
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  workers_required integer not null default 1 check (workers_required between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recurring_service_plan_id, weekday)
);

create table if not exists public.recurring_service_occurrences (
  recurring_service_plan_id text not null references public.recurring_service_plans(id) on delete cascade,
  occurrence_date date not null,
  status text not null default 'planned' check (status in ('planned', 'skipped', 'generated')),
  start_time time,
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  workers_required integer not null check (workers_required between 1 and 100),
  job_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recurring_service_plan_id, occurrence_date),
  unique (job_id)
);

create index if not exists recurring_service_occurrences_date_idx
  on public.recurring_service_occurrences (occurrence_date, status);

alter table public.recurring_service_plan_slots enable row level security;
alter table public.recurring_service_occurrences enable row level security;

drop policy if exists recurring_service_plan_slots_internal_read on public.recurring_service_plan_slots;
create policy recurring_service_plan_slots_internal_read on public.recurring_service_plan_slots
  for select to authenticated using (app_private.is_active_internal_staff(auth.uid()));
drop policy if exists recurring_service_occurrences_internal_read on public.recurring_service_occurrences;
create policy recurring_service_occurrences_internal_read on public.recurring_service_occurrences
  for select to authenticated using (app_private.is_active_internal_staff(auth.uid()));

create or replace function public.save_recurring_service_plan_schedule(p_plan_id text, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_slot jsonb;
  v_count integer := 0;
begin
  perform public.require_authenticated_financial_write();
  if not exists (select 1 from public.recurring_service_plans where id = p_plan_id) then raise exception 'recurring_plan_not_found'; end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then raise exception 'recurring_slots_empty'; end if;
  if exists (select 1 from jsonb_to_recordset(p_slots) s(weekday integer, duration_minutes integer, workers_required integer)
    where s.weekday is null or s.weekday < 1 or s.weekday > 7
      or s.duration_minutes is null or s.duration_minutes < 15 or s.duration_minutes > 1440
      or s.workers_required is null or s.workers_required < 1 or s.workers_required > 100) then raise exception 'recurring_slot_invalid'; end if;
  if (select count(*) from jsonb_to_recordset(p_slots) s(weekday integer))
      <> (select count(distinct s.weekday) from jsonb_to_recordset(p_slots) s(weekday integer)) then raise exception 'recurring_slot_duplicate_weekday'; end if;
  delete from public.recurring_service_plan_slots where recurring_service_plan_id = p_plan_id;
  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into public.recurring_service_plan_slots(recurring_service_plan_id, weekday, start_time, duration_minutes, workers_required, updated_at)
    values (p_plan_id, (v_slot ->> 'weekday')::smallint, nullif(v_slot ->> 'start_time', '')::time,
      (v_slot ->> 'duration_minutes')::integer, (v_slot ->> 'workers_required')::integer, now());
    v_count := v_count + 1;
  end loop;
  update public.recurring_service_plans p
     set default_start_time = nullif(p_slots -> 0 ->> 'start_time', '')::time,
         default_duration_minutes = (p_slots -> 0 ->> 'duration_minutes')::integer,
         default_workers_required = (p_slots -> 0 ->> 'workers_required')::integer,
         updated_at = now()
   where p.id = p_plan_id;
  return jsonb_build_object('plan_id', p_plan_id, 'slot_count', v_count);
end; $$;

create or replace function public.set_recurring_service_occurrence(p_plan_id text, p_occurrence_date date, p_status text, p_patch jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_occurrence public.recurring_service_occurrences%rowtype;
  v_job public.jobs%rowtype;
begin
  perform public.require_authenticated_financial_write();
  select * into v_occurrence from public.recurring_service_occurrences where recurring_service_plan_id = p_plan_id and occurrence_date = p_occurrence_date for update;
  if not found then raise exception 'recurring_occurrence_not_found'; end if;
  if v_occurrence.job_id is not null then
    select * into v_job from public.jobs where id = v_occurrence.job_id;
    if found and v_job.status in ('completed', 'in_progress') then raise exception 'recurring_occurrence_started_immutable'; end if;
  end if;
  if p_status not in ('planned', 'skipped') then raise exception 'recurring_occurrence_status_invalid'; end if;
  update public.recurring_service_occurrences set status = p_status, start_time = case when p_patch ? 'start_time' then nullif(p_patch ->> 'start_time', '')::time else start_time end, duration_minutes = case when p_patch ? 'duration_minutes' then (p_patch ->> 'duration_minutes')::integer else duration_minutes end, workers_required = case when p_patch ? 'workers_required' then (p_patch ->> 'workers_required')::integer else workers_required end, updated_at = now() where recurring_service_plan_id = p_plan_id and occurrence_date = p_occurrence_date returning * into v_occurrence;
  return to_jsonb(v_occurrence);
end; $$;

revoke all on function public.save_recurring_service_plan_schedule(text, jsonb) from public, anon;
grant execute on function public.save_recurring_service_plan_schedule(text, jsonb) to authenticated;
revoke all on function public.set_recurring_service_occurrence(text, date, text, jsonb) from public, anon;
grant execute on function public.set_recurring_service_occurrence(text, date, text, jsonb) to authenticated;

revoke all privileges on table public.recurring_service_plan_slots, public.recurring_service_occurrences from public, anon, authenticated;
grant select on table public.recurring_service_plan_slots, public.recurring_service_occurrences to authenticated;
