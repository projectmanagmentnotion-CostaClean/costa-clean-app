-- N8 direct expense allocation. Source-only; do not apply remotely without authorization.
-- Allocation is an operational view over expenses.subtotal. It never changes the source expense.

create table if not exists public.job_expense_allocations (
  id text primary key,
  expense_id uuid not null references public.expenses(id),
  job_id text not null references public.jobs(id),
  allocated_base_amount numeric not null check (allocated_base_amount > 0),
  expense_subtotal_snapshot numeric not null check (expense_subtotal_snapshot >= 0),
  expense_category_snapshot text not null,
  notes text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (expense_id, job_id)
);

alter table public.job_expense_allocations enable row level security;
alter table public.job_expense_allocations force row level security;
drop policy if exists n8_job_expense_allocations_internal_read on public.job_expense_allocations;
create policy n8_job_expense_allocations_internal_read on public.job_expense_allocations
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
revoke all on table public.job_expense_allocations from public, anon, authenticated;
grant select on table public.job_expense_allocations to authenticated;

create or replace function public.save_job_expense_allocation(p_allocation jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare
  v_id text := coalesce(nullif(trim(p_allocation ->> 'id'), ''), 'JEA-' || gen_random_uuid()::text);
  v_key text := nullif(trim(p_allocation ->> 'idempotency_key'), '');
  v_expense public.expenses%rowtype;
  v_job public.jobs%rowtype;
  v_existing public.job_expense_allocations%rowtype;
  v_amount numeric := nullif(p_allocation ->> 'allocated_base_amount', '')::numeric;
  v_total numeric;
  v_saved jsonb;
begin
  perform portal_private.require_active_internal_staff();
  if v_key is not null then
    select to_jsonb(a) into v_saved from public.job_expense_allocations a where a.idempotency_key = v_key;
    if v_saved is not null then return v_saved; end if;
  end if;
  if v_amount is null or v_amount <= 0 then raise exception 'EXPENSE_ALLOCATION_AMOUNT_INVALID'; end if;
  select * into v_expense from public.expenses where id = nullif(p_allocation ->> 'expense_id', '')::uuid for update;
  if not found or v_expense.deleted_at is not null or v_expense.archived_at is not null or v_expense.cancelled_at is not null then
    raise exception 'EXPENSE_SOURCE_INVALID';
  end if;
  if v_expense.category not in ('transporte', 'combustible', 'lavanderia', 'dietas_viajes', 'servicios_profesionales', 'otros') then
    raise exception 'EXPENSE_CATEGORY_NOT_ALLOCATABLE';
  end if;
  if exists (select 1 from public.material_movements mm where mm.expense_id = v_expense.id) then
    raise exception 'EXPENSE_ALREADY_LINKED_TO_INVENTORY';
  end if;
  select * into v_job from public.jobs where id = nullif(p_allocation ->> 'job_id', '')
    and deleted_at is null and archived_at is null and cancelled_at is null for update;
  if not found then raise exception 'EXPENSE_ALLOCATION_JOB_INVALID'; end if;
  select * into v_existing from public.job_expense_allocations where expense_id = v_expense.id and job_id = v_job.id;
  select coalesce(sum(a.allocated_base_amount), 0) into v_total from public.job_expense_allocations a
    where a.expense_id = v_expense.id and (v_existing.id is null or a.id <> v_existing.id);
  if v_total + v_amount > v_expense.subtotal then raise exception 'EXPENSE_ALLOCATION_EXCEEDS_BASE'; end if;
  insert into public.job_expense_allocations
    (id, expense_id, job_id, allocated_base_amount, expense_subtotal_snapshot, expense_category_snapshot, notes, idempotency_key, created_by)
  values
    (coalesce(v_existing.id, v_id), v_expense.id, v_job.id, v_amount, v_expense.subtotal, v_expense.category,
      nullif(trim(p_allocation ->> 'notes'), ''), v_key, auth.uid())
  on conflict (expense_id, job_id) do update set
    allocated_base_amount = excluded.allocated_base_amount,
    expense_subtotal_snapshot = excluded.expense_subtotal_snapshot,
    expense_category_snapshot = excluded.expense_category_snapshot,
    notes = excluded.notes,
    idempotency_key = excluded.idempotency_key,
    updated_at = now();
  select to_jsonb(a) into v_saved from public.job_expense_allocations a where a.expense_id = v_expense.id and a.job_id = v_job.id;
  return v_saved;
end; $$;

create or replace function public.remove_job_expense_allocation(p_allocation_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
begin
  perform portal_private.require_active_internal_staff();
  delete from public.job_expense_allocations where id = p_allocation_id;
  if not found then raise exception 'EXPENSE_ALLOCATION_NOT_FOUND'; end if;
  return jsonb_build_object('id', p_allocation_id, 'removed', true);
end; $$;

create or replace function public.list_job_expense_allocations(p_job_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_result jsonb;
begin
  perform portal_private.require_active_internal_staff();
  select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object(
    'supplier_name', e.supplier_name, 'expense_description', e.description,
    'expense_date', e.expense_date, 'allocation_status',
      case when e.deleted_at is not null or e.archived_at is not null or e.cancelled_at is not null then 'invalid_source' else 'valid' end
  ) order by a.created_at, a.id), '[]'::jsonb) into v_result
  from public.job_expense_allocations a join public.expenses e on e.id = a.expense_id where a.job_id = p_job_id;
  return v_result;
end; $$;

create or replace function public.get_expense_allocation_summary(p_expense_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_subtotal numeric; v_allocated numeric; v_allocations jsonb;
begin
  perform portal_private.require_active_internal_staff();
  select subtotal into v_subtotal from public.expenses where id = p_expense_id;
  if not found then raise exception 'EXPENSE_SOURCE_INVALID'; end if;
  select coalesce(sum(allocated_base_amount) filter (where e.deleted_at is null and e.archived_at is null and e.cancelled_at is null), 0),
    coalesce(jsonb_agg(to_jsonb(a) order by a.created_at, a.id), '[]'::jsonb)
    into v_allocated, v_allocations from public.job_expense_allocations a join public.expenses e on e.id = a.expense_id where a.expense_id = p_expense_id;
  return jsonb_build_object('expense_subtotal', v_subtotal, 'allocated_base', v_allocated,
    'remaining_base', greatest(v_subtotal - v_allocated, 0), 'allocations', v_allocations);
end; $$;

-- Final profitability preserves the N6/N7 fields and adds other direct costs.
create or replace function public.get_job_final_profitability(p_job_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_base jsonb; v_other numeric := 0; v_total numeric := 0; v_revenue numeric := 0; v_allocations integer := 0; v_planned_material numeric := 0; v_planned_cost numeric := 0; v_planned_revenue numeric := 0;
begin
  perform portal_private.require_active_internal_staff();
  v_base := public.get_job_profitability(p_job_id);
  select coalesce(sum(a.allocated_base_amount), 0), count(*) into v_other, v_allocations
  from public.job_expense_allocations a join public.expenses e on e.id = a.expense_id
  where a.job_id = p_job_id and e.deleted_at is null and e.archived_at is null and e.cancelled_at is null;
  v_other := round(v_other, 2);
  v_total := round(coalesce((v_base ->> 'actual_direct_cost')::numeric, 0) + v_other, 2);
  v_revenue := coalesce((v_base ->> 'actual_invoiced_base')::numeric, 0);
  select coalesce(sum(r.planned_quantity * coalesce(r.unit_cost_snapshot, 0)), 0) into v_planned_material from public.job_material_requirements r where r.job_id = p_job_id;
  v_planned_material := round(v_planned_material, 2);
  v_planned_cost := round(coalesce((v_base ->> 'planned_labor_cost')::numeric, 0) + v_planned_material, 2);
  v_planned_revenue := coalesce((v_base ->> 'planned_revenue_base')::numeric, 0);
  return v_base || jsonb_build_object(
    'planned_material_cost', v_planned_material,
    'planned_direct_cost', v_planned_cost,
    'planned_direct_contribution_after_materials', round(v_planned_revenue - v_planned_cost, 2),
    'planned_direct_margin_after_materials_percent', case when v_planned_revenue > 0 then round((v_planned_revenue - v_planned_cost) / v_planned_revenue * 100, 2) else null end,
    'actual_other_direct_cost', v_other,
    'actual_total_direct_cost', v_total,
    'actual_direct_contribution_final', round(v_revenue - v_total, 2),
    'direct_margin_final_percent', case when v_revenue > 0 then round((v_revenue - v_total) / v_revenue * 100, 2) else null end,
    'expense_allocation_count', v_allocations
  );
end; $$;

create or replace function public.list_job_final_profitability(p_from_date date, p_through_date date, p_client_id text default null, p_property_id text default null)
returns jsonb language sql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
  select coalesce(jsonb_agg(public.get_job_final_profitability(j.id) order by j.scheduled_date, j.id), '[]'::jsonb)
  from public.jobs j
  where p_from_date is not null and p_through_date is not null and p_through_date >= p_from_date and p_through_date - p_from_date <= 90
    and j.scheduled_date between p_from_date and p_through_date and j.archived_at is null and j.deleted_at is null and j.cancelled_at is null
    and (p_client_id is null or j.client_id = p_client_id) and (p_property_id is null or j.property_id = p_property_id)
    and portal_private.is_active_internal_staff(auth.uid());
$$;

revoke all on function public.save_job_expense_allocation(jsonb), public.remove_job_expense_allocation(text), public.list_job_expense_allocations(text), public.get_expense_allocation_summary(uuid), public.get_job_final_profitability(text), public.list_job_final_profitability(date, date, text, text) from public, anon;
grant execute on function public.save_job_expense_allocation(jsonb), public.remove_job_expense_allocation(text), public.list_job_expense_allocations(text), public.get_expense_allocation_summary(uuid), public.get_job_final_profitability(text), public.list_job_final_profitability(date, date, text, text) to authenticated;
