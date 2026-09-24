-- QA-only canonical N4 restore after unrelated RC3 contamination.
-- Never include this file in a Production migration manifest.
-- No tables/functions are dropped and no RC3 objects are touched.

alter table public.jobs add column if not exists recurring_service_plan_id text;
alter table public.jobs add column if not exists recurring_occurrence_date date;
do $$ begin
  alter table public.jobs add constraint jobs_recurring_service_plan_fk
    foreign key (recurring_service_plan_id) references public.recurring_service_plans(id);
exception when duplicate_object then null; end $$;
create unique index if not exists jobs_recurring_plan_occurrence_uidx
  on public.jobs (recurring_service_plan_id, recurring_occurrence_date)
  where recurring_service_plan_id is not null and recurring_occurrence_date is not null;

alter table public.recurring_service_plans
  add column if not exists timezone text not null default 'Europe/Madrid',
  add column if not exists default_start_time time,
  add column if not exists default_duration_minutes integer,
  add column if not exists default_workers_required integer;

alter table public.recurring_service_plans
  drop constraint if exists recurring_service_plans_status_check;
alter table public.recurring_service_plans
  add constraint recurring_service_plans_status_check
  check (status in ('active', 'paused', 'ended', 'archived'));

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

alter table public.recurring_service_plans enable row level security;
alter table public.recurring_service_plan_slots enable row level security;
alter table public.recurring_service_occurrences enable row level security;

drop policy if exists recurring_service_plans_internal_read on public.recurring_service_plans;
create policy recurring_service_plans_internal_read on public.recurring_service_plans
  for select to authenticated using (app_private.is_active_internal_staff(auth.uid()));
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

create or replace function public.preview_recurring_service_occurrences(
  p_plan jsonb, p_from_date date, p_through_date date
) returns date[] language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_start date := greatest((p_plan ->> 'start_date')::date, p_from_date);
  v_end date := least(p_through_date, coalesce((p_plan ->> 'end_date')::date, p_through_date));
  v_cursor date;
  v_weekday integer;
  v_days smallint[] := coalesce((select array_agg(value::smallint) from jsonb_array_elements_text(coalesce(p_plan -> 'weekdays', '[]'::jsonb))), '{}'::smallint[]);
  v_dates date[] := '{}'::date[];
begin
  if v_start > v_end then return v_dates; end if;
  v_cursor := v_start;
  while v_cursor <= v_end loop
    v_weekday := extract(isodow from v_cursor)::integer;
    if p_plan ->> 'schedule_kind' = 'monthly' and extract(day from v_cursor)::integer = (p_plan ->> 'monthly_day')::integer then
      v_dates := array_append(v_dates, v_cursor);
    elsif p_plan ->> 'schedule_kind' in ('weekly', 'biweekly') and v_weekday = any(v_days)
      and (p_plan ->> 'schedule_kind' = 'weekly' or floor((v_cursor - (p_plan ->> 'start_date')::date) / 7)::integer % 2 = 0) then
      v_dates := array_append(v_dates, v_cursor);
    end if;
    v_cursor := v_cursor + 1;
  end loop;
  return v_dates;
end; $$;

create or replace function public.save_recurring_service_plan(p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id text := nullif(p_plan ->> 'id', '');
  v_client_id text := nullif(p_plan ->> 'client_id', '');
  v_property_id text := nullif(p_plan ->> 'property_id', '');
  v_kind text := nullif(p_plan ->> 'schedule_kind', '');
  v_status text := coalesce(nullif(p_plan ->> 'status', ''), 'active');
  v_start date := (p_plan ->> 'start_date')::date;
  v_end date := nullif(p_plan ->> 'end_date', '')::date;
  v_days smallint[] := coalesce((select array_agg(value::smallint) from jsonb_array_elements_text(coalesce(p_plan -> 'weekdays', '[]'::jsonb))), '{}'::smallint[]);
  v_saved jsonb;
begin
  perform public.require_authenticated_financial_write();
  if v_id is null or v_client_id is null or v_property_id is null then raise exception 'recurring_relationship_required'; end if;
  if not exists (select 1 from public.clients where id = v_client_id and coalesce(status, '') not in ('archived', 'deleted')) then raise exception 'recurring_client_invalid'; end if;
  if not exists (select 1 from public.properties where id = v_property_id and client_id = v_client_id and coalesce(status, '') not in ('archived', 'deleted')) then raise exception 'recurring_property_client_mismatch'; end if;
  if v_kind not in ('weekly', 'biweekly', 'monthly') then raise exception 'recurring_schedule_invalid'; end if;
  if v_kind in ('weekly', 'biweekly') and (cardinality(v_days) = 0 or exists (select 1 from unnest(v_days) d where d < 1 or d > 7)) then raise exception 'recurring_weekdays_invalid'; end if;
  if v_kind = 'monthly' and ((p_plan ->> 'monthly_day')::integer not between 1 and 28) then raise exception 'recurring_monthly_day_invalid'; end if;
  if v_end is not null and v_end < v_start then raise exception 'recurring_end_before_start'; end if;
  if jsonb_typeof(p_plan -> 'template_lines') <> 'array' or jsonb_array_length(p_plan -> 'template_lines') = 0 then raise exception 'recurring_template_empty'; end if;
  if exists (select 1 from jsonb_to_recordset(p_plan -> 'template_lines') l(concept text, quantity numeric, unit_price numeric, line_subtotal numeric) where nullif(trim(l.concept), '') is null or l.quantity is null or l.quantity <= 0 or l.unit_price is null or l.unit_price < 0 or l.line_subtotal is null or abs(l.line_subtotal - l.quantity * l.unit_price) > 0.01) then raise exception 'recurring_template_invalid'; end if;
  insert into public.recurring_service_plans (id, client_id, property_id, title, service_type, status, schedule_kind, weekdays, monthly_day, start_date, end_date, billing_concept, billing_quantity, billing_unit, billing_unit_price, template_lines, notes, internal_notes, updated_at)
  values (v_id, v_client_id, v_property_id, trim(p_plan ->> 'title'), coalesce(nullif(p_plan ->> 'service_type', ''), 'standard_cleaning'), v_status, v_kind, case when v_kind = 'monthly' then null else v_days end, case when v_kind = 'monthly' then (p_plan ->> 'monthly_day')::smallint else null end, v_start, v_end, nullif(p_plan ->> 'billing_concept', ''), (p_plan ->> 'billing_quantity')::numeric, nullif(p_plan ->> 'billing_unit', ''), (p_plan ->> 'billing_unit_price')::numeric, p_plan -> 'template_lines', nullif(p_plan ->> 'notes', ''), nullif(p_plan ->> 'internal_notes', ''), now())
  on conflict (id) do update set client_id = excluded.client_id, property_id = excluded.property_id, title = excluded.title, service_type = excluded.service_type, status = excluded.status, schedule_kind = excluded.schedule_kind, weekdays = excluded.weekdays, monthly_day = excluded.monthly_day, start_date = excluded.start_date, end_date = excluded.end_date, billing_concept = excluded.billing_concept, billing_quantity = excluded.billing_quantity, billing_unit = excluded.billing_unit, billing_unit_price = excluded.billing_unit_price, template_lines = excluded.template_lines, notes = excluded.notes, internal_notes = excluded.internal_notes, updated_at = now();
  select to_jsonb(r) into v_saved from public.recurring_service_plans r where r.id = v_id;
  return v_saved;
end; $$;

create or replace function public.generate_recurring_service_occurrences(p_plan_id text, p_from_date date, p_through_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_plan public.recurring_service_plans%rowtype;
  v_dates date[];
  v_date date;
  v_job_id text;
  v_job_ids text[] := '{}'::text[];
  v_created integer := 0;
  v_slot record;
  v_occurrence record;
begin
  perform public.require_authenticated_financial_write();
  if p_through_date < p_from_date or p_through_date - p_from_date > 90 then raise exception 'recurring_horizon_invalid'; end if;
  select * into v_plan from public.recurring_service_plans where id = p_plan_id for update;
  if not found then raise exception 'recurring_plan_not_found'; end if;
  if v_plan.status <> 'active' then raise exception 'recurring_plan_not_active'; end if;
  v_dates := public.preview_recurring_service_occurrences(to_jsonb(v_plan), p_from_date, p_through_date);
  foreach v_date in array v_dates loop
    select s.* into v_slot from public.recurring_service_plan_slots s where s.recurring_service_plan_id = v_plan.id and s.weekday = extract(isodow from v_date)::integer;
    if not found then
      select p.default_start_time as start_time, p.default_duration_minutes as duration_minutes, p.default_workers_required as workers_required into v_slot from public.recurring_service_plans p where p.id = v_plan.id;
      if v_slot.duration_minutes is null then continue; end if;
    end if;
    insert into public.recurring_service_occurrences(recurring_service_plan_id, occurrence_date, status, start_time, duration_minutes, workers_required, metadata, updated_at)
    values (v_plan.id, v_date, 'planned', v_slot.start_time, v_slot.duration_minutes, v_slot.workers_required, jsonb_build_object('timezone', coalesce(v_plan.timezone, 'Europe/Madrid')), now()) on conflict (recurring_service_plan_id, occurrence_date) do nothing;
    select * into v_occurrence from public.recurring_service_occurrences where recurring_service_plan_id = v_plan.id and occurrence_date = v_date for update;
    if v_occurrence.status = 'skipped' or v_occurrence.job_id is not null then continue; end if;
    v_job_id := 'JOB-' || gen_random_uuid()::text;
    insert into public.jobs (id, client_id, property_id, quote_id, scheduled_date, status, service_type, billing_concept, billing_quantity, billing_unit, billing_unit_price, notes, recurring_service_plan_id, recurring_occurrence_date, source_metadata)
    values (v_job_id, v_plan.client_id, v_plan.property_id, null, v_date, 'scheduled', v_plan.service_type, v_plan.billing_concept, v_plan.billing_quantity, v_plan.billing_unit, v_plan.billing_unit_price, v_plan.notes, v_plan.id, v_date, jsonb_build_object('source', 'recurring_service', 'recurring_service_plan_id', v_plan.id, 'occurrence_date', v_date, 'timezone', coalesce(v_plan.timezone, 'Europe/Madrid'), 'start_time', v_slot.start_time, 'duration_minutes', v_slot.duration_minutes, 'workers_required', v_slot.workers_required)) on conflict (recurring_service_plan_id, recurring_occurrence_date) where recurring_service_plan_id is not null and recurring_occurrence_date is not null do nothing returning id into v_job_id;
    if v_job_id is not null then
      insert into public.job_lines (id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
      select 'JOB-LINE-' || v_job_id || '-' || row_number() over (), v_job_id, coalesce(l.sort_order, row_number() over ()::integer), l.concept, l.quantity, coalesce(l.unit, 'servicio'), l.unit_price, l.line_subtotal from jsonb_to_recordset(v_plan.template_lines) l(sort_order integer, concept text, quantity numeric, unit text, unit_price numeric, line_subtotal numeric);
      update public.recurring_service_occurrences set status = 'generated', job_id = v_job_id, updated_at = now() where recurring_service_plan_id = v_plan.id and occurrence_date = v_date;
      v_created := v_created + 1; v_job_ids := array_append(v_job_ids, v_job_id);
    end if;
  end loop;
  update public.recurring_service_plans set last_generated_through = greatest(coalesce(last_generated_through, p_through_date), p_through_date), updated_at = now() where id = v_plan.id;
  return jsonb_build_object('plan_id', v_plan.id, 'from_date', p_from_date, 'through_date', p_through_date, 'expected_count', cardinality(v_dates), 'created_count', v_created, 'existing_count', cardinality(v_dates) - v_created, 'job_ids', to_jsonb(v_job_ids));
end; $$;

create or replace function public.set_recurring_service_plan_status(p_plan_id text, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_saved jsonb;
begin
  perform public.require_authenticated_financial_write();
  if p_status not in ('active', 'paused', 'ended', 'archived') then raise exception 'recurring_status_invalid'; end if;
  update public.recurring_service_plans set status = p_status, updated_at = now() where id = p_plan_id;
  if not found then raise exception 'recurring_plan_not_found'; end if;
  select to_jsonb(r) into v_saved from public.recurring_service_plans r where r.id = p_plan_id;
  return v_saved;
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
revoke all on function public.save_recurring_service_plan(jsonb) from public, anon;
revoke all on function public.generate_recurring_service_occurrences(text, date, date) from public, anon;
revoke all on function public.set_recurring_service_plan_status(text, text) from public, anon;
grant execute on function public.save_recurring_service_plan(jsonb) to authenticated;
grant execute on function public.generate_recurring_service_occurrences(text, date, date) to authenticated;
grant execute on function public.set_recurring_service_plan_status(text, text) to authenticated;
revoke all on function public.set_recurring_service_occurrence(text, date, text, jsonb) from public, anon;
grant execute on function public.set_recurring_service_occurrence(text, date, text, jsonb) to authenticated;

revoke all privileges on table public.recurring_service_plans, public.recurring_service_plan_slots, public.recurring_service_occurrences from public, anon, authenticated;
grant select on table public.recurring_service_plans, public.recurring_service_plan_slots, public.recurring_service_occurrences to authenticated;
