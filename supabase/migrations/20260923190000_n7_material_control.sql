-- N7 operational material ledger. Source-only; do not apply remotely without authorization.

create table if not exists public.materials (
  id text primary key,
  display_code text,
  name text not null check (char_length(trim(name)) between 1 and 160),
  category text,
  unit text not null check (unit in ('unit', 'bottle', 'liter', 'milliliter', 'kilogram', 'gram', 'box', 'pack', 'roll')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  default_unit_cost numeric check (default_unit_cost is null or default_unit_cost >= 0),
  minimum_stock numeric check (minimum_stock is null or minimum_stock >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.material_movements (
  id text primary key,
  material_id text not null references public.materials(id),
  movement_type text not null check (movement_type in ('stock_in', 'consumption', 'adjustment_in', 'adjustment_out', 'return_in')),
  quantity numeric not null check (quantity > 0),
  unit_cost_snapshot numeric check (unit_cost_snapshot is null or unit_cost_snapshot >= 0),
  occurred_at timestamptz not null default now(),
  job_id text references public.jobs(id),
  client_id text references public.clients(id),
  property_id text references public.properties(id),
  expense_id uuid references public.expenses(id),
  notes text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.materials enable row level security;
alter table public.materials force row level security;
alter table public.material_movements enable row level security;
alter table public.material_movements force row level security;
drop policy if exists n7_materials_internal_read on public.materials;
create policy n7_materials_internal_read on public.materials for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
drop policy if exists n7_material_movements_internal_read on public.material_movements;
create policy n7_material_movements_internal_read on public.material_movements for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
revoke all on table public.materials, public.material_movements from public, anon, authenticated;
grant select on table public.materials, public.material_movements to authenticated;

create or replace function public.material_signed_effect(p_type text, p_quantity numeric)
returns numeric language sql immutable as $$ select case when p_type in ('consumption', 'adjustment_out') then -p_quantity else p_quantity end $$;

create or replace function public.list_materials()
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_result jsonb;
begin
  perform portal_private.require_active_internal_staff();
  select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('current_stock', coalesce(s.current_stock, 0)) order by m.name), '[]'::jsonb) into v_result
  from public.materials m left join lateral (select sum(public.material_signed_effect(mm.movement_type, mm.quantity)) current_stock from public.material_movements mm where mm.material_id = m.id) s on true;
  return v_result;
end; $$;

create or replace function public.save_material(p_material jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_id text := nullif(trim(p_material ->> 'id'), ''); v_saved jsonb;
begin
  perform portal_private.require_active_internal_staff();
  if v_id is null or nullif(trim(p_material ->> 'name'), '') is null then raise exception 'material_required'; end if;
  if nullif(p_material ->> 'default_unit_cost', '')::numeric < 0 then raise exception 'material_cost_invalid'; end if;
  if nullif(p_material ->> 'minimum_stock', '')::numeric < 0 then raise exception 'material_minimum_stock_invalid'; end if;
  insert into public.materials (id, display_code, name, category, unit, status, default_unit_cost, minimum_stock, notes, archived_at, updated_at)
  values (v_id, nullif(trim(p_material ->> 'display_code'), ''), trim(p_material ->> 'name'), nullif(trim(p_material ->> 'category'), ''), p_material ->> 'unit', coalesce(nullif(p_material ->> 'status', ''), 'active'), nullif(p_material ->> 'default_unit_cost', '')::numeric, nullif(p_material ->> 'minimum_stock', '')::numeric, nullif(trim(p_material ->> 'notes'), ''), case when p_material ->> 'status' = 'inactive' then coalesce((p_material ->> 'archived_at')::timestamptz, now()) else null end, now())
  on conflict (id) do update set display_code = excluded.display_code, name = excluded.name, category = excluded.category, unit = excluded.unit, status = excluded.status, default_unit_cost = excluded.default_unit_cost, minimum_stock = excluded.minimum_stock, notes = excluded.notes, archived_at = excluded.archived_at, updated_at = now();
  select to_jsonb(m) || jsonb_build_object('current_stock', coalesce((select sum(public.material_signed_effect(mm.movement_type, mm.quantity)) from public.material_movements mm where mm.material_id = m.id), 0)) into v_saved from public.materials m where m.id = v_id;
  return v_saved;
end; $$;

create or replace function public.record_material_movement(p_movement jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare
  v_id text := coalesce(nullif(p_movement ->> 'id', ''), 'MM-' || gen_random_uuid()::text);
  v_key text := nullif(p_movement ->> 'idempotency_key', '');
  v_material public.materials%rowtype;
  v_job public.jobs%rowtype;
  v_type text := nullif(p_movement ->> 'movement_type', '');
  v_quantity numeric := (p_movement ->> 'quantity')::numeric;
  v_cost numeric;
  v_stock numeric;
  v_saved jsonb;
begin
  perform portal_private.require_active_internal_staff();
  if v_key is not null then select to_jsonb(mm) || jsonb_build_object('current_stock', coalesce((select sum(public.material_signed_effect(x.movement_type, x.quantity)) from public.material_movements x where x.material_id = mm.material_id), 0)) into v_saved from public.material_movements mm where mm.idempotency_key = v_key; if v_saved is not null then return v_saved; end if; end if;
  select * into v_material from public.materials where id = p_movement ->> 'material_id' for update;
  if not found or v_material.status <> 'active' or v_material.archived_at is not null then raise exception 'material_inactive_or_not_found'; end if;
  if v_type not in ('stock_in', 'consumption', 'adjustment_in', 'adjustment_out', 'return_in') or v_quantity is null or v_quantity <= 0 then raise exception 'material_movement_invalid'; end if;
  if nullif(p_movement ->> 'unit_cost_snapshot', '')::numeric < 0 then raise exception 'material_cost_invalid'; end if;
  if (p_movement ->> 'expense_id') is not null and v_type <> 'stock_in' then raise exception 'material_expense_link_invalid'; end if;
  if nullif(p_movement ->> 'job_id', '') is not null then
    select * into v_job from public.jobs where id = p_movement ->> 'job_id' and archived_at is null and deleted_at is null and cancelled_at is null;
    if not found then raise exception 'material_job_invalid'; end if;
    if nullif(p_movement ->> 'client_id', '') is not null and p_movement ->> 'client_id' <> v_job.client_id then raise exception 'material_client_job_mismatch'; end if;
    if nullif(p_movement ->> 'property_id', '') is not null and p_movement ->> 'property_id' <> v_job.property_id then raise exception 'material_property_job_mismatch'; end if;
  end if;
  v_cost := coalesce(nullif(p_movement ->> 'unit_cost_snapshot', '')::numeric, v_material.default_unit_cost);
  if v_type in ('consumption', 'adjustment_out') then
    select coalesce(sum(public.material_signed_effect(mm.movement_type, mm.quantity)), 0) into v_stock from public.material_movements mm where mm.material_id = v_material.id;
    if v_stock < v_quantity then raise exception 'MATERIAL_INSUFFICIENT_STOCK'; end if;
  end if;
  insert into public.material_movements (id, material_id, movement_type, quantity, unit_cost_snapshot, occurred_at, job_id, client_id, property_id, expense_id, notes, idempotency_key, created_by)
  values (v_id, v_material.id, v_type, v_quantity, v_cost, coalesce((p_movement ->> 'occurred_at')::timestamptz, now()), nullif(p_movement ->> 'job_id', ''), case when v_job.id is null then null else v_job.client_id end, case when v_job.id is null then null else v_job.property_id end, nullif(p_movement ->> 'expense_id', '')::uuid, nullif(trim(p_movement ->> 'notes'), ''), v_key, auth.uid());
  select to_jsonb(mm) || jsonb_build_object('current_stock', coalesce((select sum(public.material_signed_effect(x.movement_type, x.quantity)) from public.material_movements x where x.material_id = mm.material_id), 0)) into v_saved from public.material_movements mm where mm.id = v_id;
  return v_saved;
end; $$;

revoke all on function public.material_signed_effect(text, numeric) from public, anon, authenticated;
revoke all on function public.list_materials() from public, anon;
revoke all on function public.save_material(jsonb) from public, anon;
revoke all on function public.record_material_movement(jsonb) from public, anon;
grant execute on function public.list_materials() to authenticated;
grant execute on function public.save_material(jsonb) to authenticated;
grant execute on function public.record_material_movement(jsonb) to authenticated;

-- Extend the N6 read model only after the material ledger exists.
create or replace function public.get_job_profitability(p_job_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare
  v_job public.jobs%rowtype; v_client_name text; v_property_name text;
  v_planned_revenue numeric := 0; v_planned_minutes integer := 0; v_planned_labor numeric := 0;
  v_actual_revenue numeric := 0; v_draft_revenue numeric := 0; v_invoice_total numeric := 0; v_collected numeric := 0;
  v_actual_minutes integer := 0; v_actual_labor numeric := 0; v_material_cost numeric := 0; v_material_count integer := 0;
  v_assigned_workers integer := 0; v_time_entries integer := 0; v_invoice_count integer := 0;
  v_planned_contribution numeric; v_actual_contribution numeric; v_direct_cost numeric; v_margin numeric; v_margin_after_materials numeric; v_status text;
begin
  perform portal_private.require_active_internal_staff();
  select * into v_job from public.jobs where id = p_job_id;
  if not found then raise exception 'profitability_job_not_found'; end if;
  select c.full_name, p.name into v_client_name, v_property_name from public.jobs j left join public.clients c on c.id = j.client_id left join public.properties p on p.id = j.property_id where j.id = p_job_id;
  select case when count(*) > 0 then coalesce(sum(line_subtotal), 0) else coalesce(v_job.billing_quantity, 0) * coalesce(v_job.billing_unit_price, 0) end into v_planned_revenue from public.job_lines where job_id = p_job_id;
  select count(*) filter (where status <> 'cancelled'), coalesce(sum(planned_minutes) filter (where status <> 'cancelled'), 0), coalesce(sum(coalesce(planned_minutes, 0) / 60.0 * coalesce(hourly_cost_snapshot, 0)) filter (where status <> 'cancelled'), 0) into v_assigned_workers, v_planned_minutes, v_planned_labor from public.job_team_assignments where job_id = p_job_id;
  select coalesce(sum(minutes), 0), coalesce(sum(minutes / 60.0 * coalesce(hourly_cost_snapshot, 0)), 0), count(*) into v_actual_minutes, v_actual_labor, v_time_entries from public.job_time_entries where job_id = p_job_id;
  select coalesce(sum(subtotal), 0), coalesce(sum(total), 0), count(*) into v_actual_revenue, v_invoice_total, v_invoice_count from public.invoices where job_id = p_job_id and status in ('issued', 'paid') and deleted_at is null and archived_at is null and cancelled_at is null;
  select coalesce(sum(subtotal), 0) into v_draft_revenue from public.invoices where job_id = p_job_id and status = 'draft' and deleted_at is null and archived_at is null and cancelled_at is null;
  select coalesce(sum(pay.amount), 0) into v_collected from public.payments pay join public.invoices i on i.id = pay.invoice_id where i.job_id = p_job_id and i.status in ('issued', 'paid') and i.deleted_at is null and i.archived_at is null and i.cancelled_at is null and pay.deleted_at is null and pay.archived_at is null and pay.cancelled_at is null;
  select coalesce(sum(quantity * coalesce(unit_cost_snapshot, 0)) filter (where movement_type = 'consumption'), 0), count(*) filter (where movement_type = 'consumption') into v_material_cost, v_material_count from public.material_movements where job_id = p_job_id;
  v_planned_revenue := round(v_planned_revenue, 2); v_planned_labor := round(v_planned_labor, 2); v_actual_revenue := round(v_actual_revenue, 2); v_draft_revenue := round(v_draft_revenue, 2); v_invoice_total := round(v_invoice_total, 2); v_collected := round(v_collected, 2); v_actual_labor := round(v_actual_labor, 2); v_material_cost := round(v_material_cost, 2);
  v_planned_contribution := round(v_planned_revenue - v_planned_labor, 2); v_actual_contribution := round(v_actual_revenue - v_actual_labor, 2); v_direct_cost := round(v_actual_labor + v_material_cost, 2); v_margin := case when v_actual_revenue > 0 then round(v_actual_contribution / v_actual_revenue * 100, 2) else null end; v_margin_after_materials := case when v_actual_revenue > 0 then round((v_actual_revenue - v_direct_cost) / v_actual_revenue * 100, 2) else null end; v_status := case when v_actual_revenue > 0 and v_actual_minutes > 0 then 'COMPLETE' when v_actual_minutes > 0 then 'PARTIAL_NO_INVOICE' when v_actual_revenue > 0 then 'PARTIAL_NO_TIME' when v_planned_revenue > 0 or v_planned_minutes > 0 then 'PLANNED_ONLY' else 'EMPTY' end;
  return jsonb_build_object('job_id', p_job_id, 'client_name', v_client_name, 'property_name', v_property_name, 'planned_revenue_base', v_planned_revenue, 'planned_minutes', v_planned_minutes, 'planned_labor_cost', v_planned_labor, 'planned_direct_contribution', v_planned_contribution, 'actual_invoiced_base', v_actual_revenue, 'draft_invoice_base', v_draft_revenue, 'invoice_total_with_vat', v_invoice_total, 'collected_amount', v_collected, 'outstanding_amount', greatest(v_invoice_total - v_collected, 0), 'actual_minutes', v_actual_minutes, 'actual_labor_cost', v_actual_labor, 'actual_material_cost', v_material_cost, 'actual_direct_cost', v_direct_cost, 'actual_direct_contribution', v_actual_contribution, 'actual_direct_contribution_after_materials', round(v_actual_revenue - v_direct_cost, 2), 'direct_margin_percent', v_margin, 'direct_margin_after_materials_percent', v_margin_after_materials, 'revenue_variance', round(v_actual_revenue - v_planned_revenue, 2), 'labor_variance', round(v_actual_labor - v_planned_labor, 2), 'margin_variance', round(v_actual_contribution - v_planned_contribution, 2), 'assigned_worker_count', v_assigned_workers, 'time_entry_count', v_time_entries, 'material_movement_count', v_material_count, 'invoice_count', v_invoice_count, 'completeness_status', v_status);
end; $$;

revoke all on function public.get_job_profitability(text) from public, anon;
grant execute on function public.get_job_profitability(text) to authenticated;
