-- N4 recurring service plans. Source-only migration; do not apply remotely without authorization.

create table if not exists public.recurring_service_plans (
  id text primary key,
  client_id text not null references public.clients(id),
  property_id text not null references public.properties(id),
  title text not null check (char_length(trim(title)) between 1 and 160),
  service_type text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  schedule_kind text not null check (schedule_kind in ('weekly', 'biweekly', 'monthly')),
  weekdays smallint[],
  monthly_day smallint,
  start_date date not null,
  end_date date,
  billing_concept text,
  billing_quantity numeric,
  billing_unit text,
  billing_unit_price numeric,
  template_lines jsonb not null,
  notes text,
  internal_notes text,
  last_generated_through date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.jobs add column if not exists recurring_service_plan_id text;
alter table public.jobs add column if not exists recurring_occurrence_date date;
do $$ begin
  alter table public.jobs add constraint jobs_recurring_service_plan_fk
    foreign key (recurring_service_plan_id) references public.recurring_service_plans(id);
exception when duplicate_object then null; end $$;
create unique index if not exists jobs_recurring_plan_occurrence_uidx
  on public.jobs (recurring_service_plan_id, recurring_occurrence_date)
  where recurring_service_plan_id is not null and recurring_occurrence_date is not null;

alter table public.recurring_service_plans enable row level security;
drop policy if exists recurring_service_plans_internal_read on public.recurring_service_plans;
create policy recurring_service_plans_internal_read on public.recurring_service_plans
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));

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
begin
  perform public.require_authenticated_financial_write();
  if p_through_date < p_from_date or p_through_date - p_from_date > 90 then raise exception 'recurring_horizon_invalid'; end if;
  select * into v_plan from public.recurring_service_plans where id = p_plan_id for update;
  if not found then raise exception 'recurring_plan_not_found'; end if;
  if v_plan.status <> 'active' then raise exception 'recurring_plan_not_active'; end if;
  v_dates := public.preview_recurring_service_occurrences(to_jsonb(v_plan), p_from_date, p_through_date);
  foreach v_date in array v_dates loop
    v_job_id := 'JOB-' || gen_random_uuid()::text;
    insert into public.jobs (id, client_id, property_id, quote_id, scheduled_date, status, service_type, billing_concept, billing_quantity, billing_unit, billing_unit_price, notes, recurring_service_plan_id, recurring_occurrence_date)
    values (v_job_id, v_plan.client_id, v_plan.property_id, null, v_date, 'scheduled', v_plan.service_type, v_plan.billing_concept, v_plan.billing_quantity, v_plan.billing_unit, v_plan.billing_unit_price, v_plan.notes, v_plan.id, v_date)
    on conflict (recurring_service_plan_id, recurring_occurrence_date) where recurring_service_plan_id is not null and recurring_occurrence_date is not null do nothing
    returning id into v_job_id;
    if v_job_id is not null then
      insert into public.job_lines (id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
      select 'JOB-LINE-' || v_job_id || '-' || row_number() over (), v_job_id, coalesce(l.sort_order, row_number() over ()::integer), l.concept, l.quantity, coalesce(l.unit, 'servicio'), l.unit_price, l.line_subtotal
      from jsonb_to_recordset(v_plan.template_lines) l(sort_order integer, concept text, quantity numeric, unit text, unit_price numeric, line_subtotal numeric);
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
  if p_status not in ('active', 'paused', 'archived') then raise exception 'recurring_status_invalid'; end if;
  update public.recurring_service_plans set status = p_status, updated_at = now() where id = p_plan_id;
  if not found then raise exception 'recurring_plan_not_found'; end if;
  select to_jsonb(r) into v_saved from public.recurring_service_plans r where r.id = p_plan_id;
  return v_saved;
end; $$;

revoke all on function public.save_recurring_service_plan(jsonb) from public, anon;
revoke all on function public.generate_recurring_service_occurrences(text, date, date) from public, anon;
revoke all on function public.set_recurring_service_plan_status(text, text) from public, anon;
grant execute on function public.save_recurring_service_plan(jsonb) to authenticated;
grant execute on function public.generate_recurring_service_occurrences(text, date, date) to authenticated;
grant execute on function public.set_recurring_service_plan_status(text, text) to authenticated;
