-- N9 forward correction: separate per-worker aggregation from JSON aggregation.
-- This migration is source-only until a separately authorized QA RC2 apply.

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

revoke all on function public.get_team_workload_forecast(date) from public, anon;
grant execute on function public.get_team_workload_forecast(date) to authenticated;
