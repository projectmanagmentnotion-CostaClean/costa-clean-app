-- N6 direct operational profitability. Source-only; do not apply remotely without authorization.
-- Revenue is invoice subtotal (VAT excluded); labor uses N5 snapshots only.

create or replace function public.get_job_profitability(p_job_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare
  v_job public.jobs%rowtype;
  v_client_name text;
  v_property_name text;
  v_planned_revenue numeric := 0;
  v_planned_minutes integer := 0;
  v_planned_labor numeric := 0;
  v_actual_revenue numeric := 0;
  v_draft_revenue numeric := 0;
  v_invoice_total numeric := 0;
  v_collected numeric := 0;
  v_actual_minutes integer := 0;
  v_actual_labor numeric := 0;
  v_assigned_workers integer := 0;
  v_time_entries integer := 0;
  v_invoice_count integer := 0;
  v_planned_contribution numeric;
  v_actual_contribution numeric;
  v_margin numeric;
  v_status text;
begin
  perform portal_private.require_active_internal_staff();
  select * into v_job from public.jobs where id = p_job_id;
  if not found then raise exception 'profitability_job_not_found'; end if;
  select c.full_name, p.name into v_client_name, v_property_name
    from public.jobs j
    left join public.clients c on c.id = j.client_id
    left join public.properties p on p.id = j.property_id
    where j.id = p_job_id;

  select case when count(*) > 0 then coalesce(sum(line_subtotal), 0) else coalesce(v_job.billing_quantity, 0) * coalesce(v_job.billing_unit_price, 0) end
    into v_planned_revenue from public.job_lines where job_id = p_job_id;
  select count(*) filter (where status <> 'cancelled'), coalesce(sum(planned_minutes) filter (where status <> 'cancelled'), 0), coalesce(sum(coalesce(planned_minutes, 0) / 60.0 * coalesce(hourly_cost_snapshot, 0)) filter (where status <> 'cancelled'), 0)
    into v_assigned_workers, v_planned_minutes, v_planned_labor from public.job_team_assignments where job_id = p_job_id;
  select coalesce(sum(minutes), 0), coalesce(sum(minutes / 60.0 * coalesce(hourly_cost_snapshot, 0)), 0), count(*)
    into v_actual_minutes, v_actual_labor, v_time_entries from public.job_time_entries where job_id = p_job_id;
  select coalesce(sum(subtotal), 0), coalesce(sum(total), 0), count(*)
    into v_actual_revenue, v_invoice_total, v_invoice_count
    from public.invoices where job_id = p_job_id and status in ('issued', 'paid') and deleted_at is null and archived_at is null and cancelled_at is null;
  select coalesce(sum(subtotal), 0) into v_draft_revenue
    from public.invoices where job_id = p_job_id and status = 'draft' and deleted_at is null and archived_at is null and cancelled_at is null;
  select coalesce(sum(pay.amount), 0) into v_collected
    from public.payments pay join public.invoices i on i.id = pay.invoice_id
    where i.job_id = p_job_id and i.status in ('issued', 'paid') and i.deleted_at is null and i.archived_at is null and i.cancelled_at is null and pay.deleted_at is null and pay.archived_at is null and pay.cancelled_at is null;

  v_planned_revenue := round(v_planned_revenue, 2);
  v_planned_labor := round(v_planned_labor, 2);
  v_actual_revenue := round(v_actual_revenue, 2);
  v_draft_revenue := round(v_draft_revenue, 2);
  v_invoice_total := round(v_invoice_total, 2);
  v_collected := round(v_collected, 2);
  v_actual_labor := round(v_actual_labor, 2);
  v_planned_contribution := round(v_planned_revenue - v_planned_labor, 2);
  v_actual_contribution := round(v_actual_revenue - v_actual_labor, 2);
  v_margin := case when v_actual_revenue > 0 then round(v_actual_contribution / v_actual_revenue * 100, 2) else null end;
  v_status := case when v_actual_revenue > 0 and v_actual_minutes > 0 then 'COMPLETE' when v_actual_minutes > 0 then 'PARTIAL_NO_INVOICE' when v_actual_revenue > 0 then 'PARTIAL_NO_TIME' when v_planned_revenue > 0 or v_planned_minutes > 0 then 'PLANNED_ONLY' else 'EMPTY' end;

  return jsonb_build_object(
    'job_id', p_job_id, 'client_name', v_client_name, 'property_name', v_property_name,
    'planned_revenue_base', v_planned_revenue, 'planned_minutes', v_planned_minutes, 'planned_labor_cost', v_planned_labor, 'planned_direct_contribution', v_planned_contribution,
    'actual_invoiced_base', v_actual_revenue, 'draft_invoice_base', v_draft_revenue, 'invoice_total_with_vat', v_invoice_total, 'collected_amount', v_collected, 'outstanding_amount', greatest(v_invoice_total - v_collected, 0),
    'actual_minutes', v_actual_minutes, 'actual_labor_cost', v_actual_labor, 'actual_direct_contribution', v_actual_contribution, 'direct_margin_percent', v_margin,
    'revenue_variance', round(v_actual_revenue - v_planned_revenue, 2), 'labor_variance', round(v_actual_labor - v_planned_labor, 2), 'margin_variance', round(v_actual_contribution - v_planned_contribution, 2),
    'assigned_worker_count', v_assigned_workers, 'time_entry_count', v_time_entries, 'invoice_count', v_invoice_count, 'completeness_status', v_status
  );
end; $$;

create or replace function public.list_job_profitability(p_from_date date, p_through_date date, p_client_id text default null, p_property_id text default null)
returns setof jsonb language sql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
  select public.get_job_profitability(j.id)
  from public.jobs j
  where p_from_date is not null and p_through_date is not null and p_through_date >= p_from_date and p_through_date - p_from_date <= 90
    and j.scheduled_date between p_from_date and p_through_date
    and j.archived_at is null and j.deleted_at is null and j.cancelled_at is null
    and (p_client_id is null or j.client_id = p_client_id)
    and (p_property_id is null or j.property_id = p_property_id)
  order by j.scheduled_date, j.id;
$$;

revoke all on function public.get_job_profitability(text) from public, anon;
revoke all on function public.list_job_profitability(date, date, text, text) from public, anon;
grant execute on function public.get_job_profitability(text) to authenticated;
grant execute on function public.list_job_profitability(date, date, text, text) to authenticated;
