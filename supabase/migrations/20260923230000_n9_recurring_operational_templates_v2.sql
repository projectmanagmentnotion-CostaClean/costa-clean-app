-- N9 V2 recurring operational templates and planned-cost forecasts.
-- Fresh-install replacement for the historical N9 artifact; workload aggregation is corrected inline.
-- Source-only; do not apply remotely without explicit authorization.
-- Planned rows never represent actual time, stock consumption or fiscal activity.

create table if not exists public.recurring_service_team_templates (
  id text primary key,
  plan_id text not null references public.recurring_service_plans(id) on delete cascade,
  team_member_id text not null references public.team_members(id),
  planned_minutes integer not null check (planned_minutes > 0),
  hourly_cost_override numeric check (hourly_cost_override is null or hourly_cost_override >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, team_member_id)
);

create table if not exists public.recurring_service_material_templates (
  id text primary key,
  plan_id text not null references public.recurring_service_plans(id) on delete cascade,
  material_id text not null references public.materials(id),
  planned_quantity numeric not null check (planned_quantity > 0),
  unit_cost_override numeric check (unit_cost_override is null or unit_cost_override >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, material_id)
);

create table if not exists public.job_material_requirements (
  id text primary key,
  job_id text not null references public.jobs(id) on delete cascade,
  material_id text not null references public.materials(id),
  planned_quantity numeric not null check (planned_quantity > 0),
  unit_cost_snapshot numeric check (unit_cost_snapshot is null or unit_cost_snapshot >= 0),
  source_plan_id text references public.recurring_service_plans(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, material_id)
);

alter table public.recurring_service_team_templates enable row level security;
alter table public.recurring_service_team_templates force row level security;
alter table public.recurring_service_material_templates enable row level security;
alter table public.recurring_service_material_templates force row level security;
alter table public.job_material_requirements enable row level security;
alter table public.job_material_requirements force row level security;

drop policy if exists n9_team_templates_internal_read on public.recurring_service_team_templates;
create policy n9_team_templates_internal_read on public.recurring_service_team_templates for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
drop policy if exists n9_material_templates_internal_read on public.recurring_service_material_templates;
create policy n9_material_templates_internal_read on public.recurring_service_material_templates for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
drop policy if exists n9_job_material_requirements_internal_read on public.job_material_requirements;
create policy n9_job_material_requirements_internal_read on public.job_material_requirements for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
revoke all on table public.recurring_service_team_templates, public.recurring_service_material_templates, public.job_material_requirements from public, anon, authenticated;
grant select on table public.recurring_service_team_templates, public.recurring_service_material_templates, public.job_material_requirements to authenticated;

-- N9 extends the N8 profitability contract only after its planned-material table exists.
create or replace function public.get_job_final_profitability(p_job_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_base jsonb; v_planned_material numeric := 0; v_planned_cost numeric := 0; v_planned_revenue numeric := 0;
begin
  perform portal_private.require_active_internal_staff();
  v_base := public.get_job_final_profitability_base(p_job_id);
  select coalesce(sum(r.planned_quantity * coalesce(r.unit_cost_snapshot, 0)), 0)
    into v_planned_material
    from public.job_material_requirements r where r.job_id = p_job_id;
  v_planned_material := round(v_planned_material, 2);
  v_planned_cost := round(coalesce((v_base ->> 'planned_labor_cost')::numeric, 0) + v_planned_material, 2);
  v_planned_revenue := coalesce((v_base ->> 'planned_revenue_base')::numeric, 0);
  return v_base || jsonb_build_object(
    'planned_material_cost', v_planned_material,
    'planned_direct_cost', v_planned_cost,
    'planned_direct_contribution_after_materials', round(v_planned_revenue - v_planned_cost, 2),
    'planned_direct_margin_after_materials_percent', case when v_planned_revenue > 0 then round((v_planned_revenue - v_planned_cost) / v_planned_revenue * 100, 2) else null end
  );
end; $$;

create or replace function public.save_recurring_service_operational_template(p_plan_id text, p_team jsonb, p_materials jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_item jsonb; v_id text; v_result jsonb; v_count integer;
begin
  perform portal_private.require_active_internal_staff();
  if not exists (select 1 from public.recurring_service_plans where id = p_plan_id) then raise exception 'recurring_plan_not_found'; end if;
  if jsonb_typeof(coalesce(p_team, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_materials, '[]'::jsonb)) <> 'array' then raise exception 'recurring_operational_template_invalid'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_team, '[]'::jsonb)) x group by x ->> 'team_member_id' having count(*) > 1) then raise exception 'recurring_team_template_duplicate_worker'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) x group by x ->> 'material_id' having count(*) > 1) then raise exception 'recurring_material_template_duplicate_material'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_team, '[]'::jsonb)) loop
    v_id := nullif(trim(v_item ->> 'team_member_id'), '');
    if v_id is null or not exists (select 1 from public.team_members where id = v_id and status = 'active' and archived_at is null) then raise exception 'recurring_team_template_worker_invalid'; end if;
    if nullif(v_item ->> 'planned_minutes', '')::integer is null or nullif(v_item ->> 'planned_minutes', '')::integer <= 0 then raise exception 'recurring_team_template_minutes_invalid'; end if;
    if nullif(v_item ->> 'hourly_cost_override', '')::numeric < 0 then raise exception 'recurring_team_template_cost_invalid'; end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) loop
    v_id := nullif(trim(v_item ->> 'material_id'), '');
    if v_id is null or not exists (select 1 from public.materials where id = v_id and status = 'active' and archived_at is null) then raise exception 'recurring_material_template_material_invalid'; end if;
    if nullif(v_item ->> 'planned_quantity', '')::numeric is null or nullif(v_item ->> 'planned_quantity', '')::numeric <= 0 then raise exception 'recurring_material_template_quantity_invalid'; end if;
    if nullif(v_item ->> 'unit_cost_override', '')::numeric < 0 then raise exception 'recurring_material_template_cost_invalid'; end if;
  end loop;
  delete from public.recurring_service_team_templates where plan_id = p_plan_id;
  delete from public.recurring_service_material_templates where plan_id = p_plan_id;
  insert into public.recurring_service_team_templates (id, plan_id, team_member_id, planned_minutes, hourly_cost_override, notes)
    select coalesce(nullif(x ->> 'id', ''), 'RST-' || gen_random_uuid()::text), p_plan_id, x ->> 'team_member_id', (x ->> 'planned_minutes')::integer, nullif(x ->> 'hourly_cost_override', '')::numeric, nullif(trim(x ->> 'notes'), '') from jsonb_array_elements(coalesce(p_team, '[]'::jsonb)) x;
  insert into public.recurring_service_material_templates (id, plan_id, material_id, planned_quantity, unit_cost_override, notes)
    select coalesce(nullif(x ->> 'id', ''), 'RSM-' || gen_random_uuid()::text), p_plan_id, x ->> 'material_id', (x ->> 'planned_quantity')::numeric, nullif(x ->> 'unit_cost_override', '')::numeric, nullif(trim(x ->> 'notes'), '') from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) x;
  select jsonb_build_object('plan_id', p_plan_id, 'team', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.recurring_service_team_templates t where t.plan_id = p_plan_id), '[]'::jsonb), 'materials', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.recurring_service_material_templates m where m.plan_id = p_plan_id), '[]'::jsonb)) into v_result;
  return v_result;
end; $$;

-- N4 generation extended with one transaction: job, lines, planned team and planned materials.
create or replace function public.generate_recurring_service_occurrences(p_plan_id text, p_from_date date, p_through_date date)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_plan public.recurring_service_plans%rowtype; v_date date; v_dates date[]; v_job_id text; v_job_ids text[] := '{}'::text[]; v_created integer := 0;
begin
  perform public.require_authenticated_financial_write();
  if p_through_date < p_from_date or p_through_date - p_from_date > 90 then raise exception 'recurring_horizon_invalid'; end if;
  select * into v_plan from public.recurring_service_plans where id = p_plan_id for update;
  if not found then raise exception 'recurring_plan_not_found'; end if;
  if v_plan.status <> 'active' then raise exception 'recurring_plan_not_active'; end if;
  if exists (select 1 from public.recurring_service_team_templates t join public.team_members m on m.id = t.team_member_id where t.plan_id = v_plan.id and (m.status <> 'active' or m.archived_at is not null)) then raise exception 'recurring_team_template_worker_inactive'; end if;
  if exists (select 1 from public.recurring_service_material_templates t join public.materials m on m.id = t.material_id where t.plan_id = v_plan.id and (m.status <> 'active' or m.archived_at is not null)) then raise exception 'recurring_material_template_material_inactive'; end if;
  v_dates := public.preview_recurring_service_occurrences(to_jsonb(v_plan), p_from_date, p_through_date);
  foreach v_date in array v_dates loop
    v_job_id := 'JOB-' || gen_random_uuid()::text;
    insert into public.jobs (id, client_id, property_id, quote_id, scheduled_date, status, service_type, billing_concept, billing_quantity, billing_unit, billing_unit_price, notes, recurring_service_plan_id, recurring_occurrence_date)
      values (v_job_id, v_plan.client_id, v_plan.property_id, null, v_date, 'scheduled', v_plan.service_type, v_plan.billing_concept, v_plan.billing_quantity, v_plan.billing_unit, v_plan.billing_unit_price, v_plan.notes, v_plan.id, v_date)
      on conflict (recurring_service_plan_id, recurring_occurrence_date) where recurring_service_plan_id is not null and recurring_occurrence_date is not null do nothing returning id into v_job_id;
    if v_job_id is not null then
      insert into public.job_lines (id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal)
        select 'JOB-LINE-' || v_job_id || '-' || row_number() over (), v_job_id, coalesce(l.sort_order, row_number() over ()::integer), l.concept, l.quantity, coalesce(l.unit, 'servicio'), l.unit_price, l.line_subtotal from jsonb_to_recordset(v_plan.template_lines) l(sort_order integer, concept text, quantity numeric, unit text, unit_price numeric, line_subtotal numeric);
      insert into public.job_team_assignments (id, job_id, team_member_id, planned_minutes, hourly_cost_snapshot, status, notes)
        select 'JTA-' || gen_random_uuid()::text, v_job_id, t.team_member_id, t.planned_minutes, coalesce(t.hourly_cost_override, m.default_hourly_cost), 'assigned', t.notes from public.recurring_service_team_templates t join public.team_members m on m.id = t.team_member_id where t.plan_id = v_plan.id;
      insert into public.job_material_requirements (id, job_id, material_id, planned_quantity, unit_cost_snapshot, source_plan_id, notes)
        select 'JMR-' || gen_random_uuid()::text, v_job_id, t.material_id, t.planned_quantity, coalesce(t.unit_cost_override, m.default_unit_cost), v_plan.id, t.notes from public.recurring_service_material_templates t join public.materials m on m.id = t.material_id where t.plan_id = v_plan.id;
      v_created := v_created + 1; v_job_ids := array_append(v_job_ids, v_job_id);
    end if;
  end loop;
  update public.recurring_service_plans set last_generated_through = greatest(coalesce(last_generated_through, p_through_date), p_through_date), updated_at = now() where id = v_plan.id;
  return jsonb_build_object('plan_id', v_plan.id, 'from_date', p_from_date, 'through_date', p_through_date, 'expected_count', cardinality(v_dates), 'created_count', v_created, 'existing_count', cardinality(v_dates) - v_created, 'job_ids', to_jsonb(v_job_ids));
end; $$;

create or replace function public.list_recurring_service_operational_plans()
returns jsonb language sql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
    'team_templates', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.recurring_service_team_templates t where t.plan_id = p.id), '[]'::jsonb),
    'material_templates', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.recurring_service_material_templates m where m.plan_id = p.id), '[]'::jsonb)
  ) order by p.title), '[]'::jsonb) from public.recurring_service_plans p where p.status <> 'archived' and portal_private.is_active_internal_staff(auth.uid());
$$;

create or replace function public.get_recurring_operational_forecast(p_from_date date, p_through_date date)
returns jsonb language sql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
  with jobs as (select j.id from public.jobs j where j.scheduled_date between p_from_date and p_through_date and j.status <> 'cancelled' and j.archived_at is null and j.deleted_at is null), labor as (select coalesce(sum(a.planned_minutes), 0) / 60.0 planned_hours, coalesce(sum(a.planned_minutes / 60.0 * coalesce(a.hourly_cost_snapshot, 0)), 0) planned_labor_cost from public.job_team_assignments a where a.job_id in (select id from jobs) and a.status <> 'cancelled'), materials as (select coalesce(sum(r.planned_quantity * coalesce(r.unit_cost_snapshot, 0)), 0) planned_material_cost from public.job_material_requirements r where r.job_id in (select id from jobs)) select jsonb_build_object('scheduled_visit_count', (select count(*) from jobs), 'planned_worker_hours', round((select planned_hours from labor), 2), 'planned_labor_cost', round((select planned_labor_cost from labor), 2), 'planned_material_cost', round((select planned_material_cost from materials), 2), 'planned_direct_cost', round((select planned_labor_cost from labor) + (select planned_material_cost from materials), 2), 'planned_revenue', coalesce((select sum(coalesce(i.line_subtotal, j.billing_quantity * j.billing_unit_price, 0)) from jobs x join public.jobs j on j.id = x.id left join public.job_lines i on i.job_id = j.id), 0));
$$;

create or replace function public.get_material_needs_forecast(p_through_date date)
returns jsonb language sql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
  with required as (select r.material_id, sum(r.planned_quantity) required_quantity from public.job_material_requirements r join public.jobs j on j.id = r.job_id where j.scheduled_date between current_date and p_through_date and j.status <> 'cancelled' and j.archived_at is null and j.deleted_at is null group by r.material_id), stock as (select m.id, coalesce(sum(public.material_signed_effect(mm.movement_type, mm.quantity)), 0) current_stock from public.materials m left join public.material_movements mm on mm.material_id = m.id group by m.id) select coalesce(jsonb_agg(jsonb_build_object('material_id', r.material_id, 'material_name', m.name, 'unit', m.unit, 'required_quantity', r.required_quantity, 'current_stock', s.current_stock, 'shortage_quantity', greatest(r.required_quantity - s.current_stock, 0)) order by m.name), '[]'::jsonb) from required r join public.materials m on m.id = r.material_id join stock s on s.id = r.material_id where portal_private.is_active_internal_staff(auth.uid());
$$;

create or replace function public.get_team_workload_forecast(p_through_date date)
returns jsonb language sql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
  with workload as (
    select
      a.team_member_id,
      m.full_name as worker_name,
      round(coalesce(sum(a.planned_minutes), 0)::numeric / 60.0, 2) as planned_hours
    from public.job_team_assignments a
    join public.jobs j on j.id = a.job_id
    join public.team_members m on m.id = a.team_member_id
    where j.scheduled_date between current_date and p_through_date
      and j.status <> 'cancelled'
      and j.archived_at is null
      and j.deleted_at is null
      and a.status <> 'cancelled'
      and portal_private.is_active_internal_staff(auth.uid())
    group by a.team_member_id, m.full_name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'team_member_id', team_member_id,
        'worker_name', worker_name,
        'planned_hours', planned_hours
      ) order by worker_name
    ),
    '[]'::jsonb
  )
  from workload;
$$;

revoke all on function public.save_recurring_service_operational_template(text, jsonb, jsonb), public.list_recurring_service_operational_plans(), public.get_recurring_operational_forecast(date, date), public.get_material_needs_forecast(date), public.get_team_workload_forecast(date) from public, anon;
grant execute on function public.save_recurring_service_operational_template(text, jsonb, jsonb), public.list_recurring_service_operational_plans(), public.get_recurring_operational_forecast(date, date), public.get_material_needs_forecast(date), public.get_team_workload_forecast(date) to authenticated;

