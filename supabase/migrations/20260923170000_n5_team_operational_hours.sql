-- N5 team and operational hours. Source-only; do not apply remotely without authorization.

create table if not exists public.team_members (
  id text primary key,
  display_code text,
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'inactive')),
  default_hourly_cost numeric check (default_hourly_cost is null or default_hourly_cost >= 0),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.job_team_assignments (
  id text primary key,
  job_id text not null references public.jobs(id),
  team_member_id text not null references public.team_members(id),
  planned_minutes integer check (planned_minutes is null or planned_minutes > 0),
  hourly_cost_snapshot numeric check (hourly_cost_snapshot is null or hourly_cost_snapshot >= 0),
  status text not null default 'assigned' check (status in ('assigned', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, team_member_id)
);

create table if not exists public.job_time_entries (
  id text primary key,
  job_id text not null references public.jobs(id),
  team_member_id text not null references public.team_members(id),
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  hourly_cost_snapshot numeric check (hourly_cost_snapshot is null or hourly_cost_snapshot >= 0),
  source text not null default 'manual' check (source = 'manual'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, team_member_id, work_date)
);

alter table public.team_members enable row level security;
alter table public.team_members force row level security;
alter table public.job_team_assignments enable row level security;
alter table public.job_team_assignments force row level security;
alter table public.job_time_entries enable row level security;
alter table public.job_time_entries force row level security;

drop policy if exists n5_team_members_internal_read on public.team_members;
create policy n5_team_members_internal_read on public.team_members
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
drop policy if exists n5_job_team_assignments_internal_read on public.job_team_assignments;
create policy n5_job_team_assignments_internal_read on public.job_team_assignments
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));
drop policy if exists n5_job_time_entries_internal_read on public.job_time_entries;
create policy n5_job_time_entries_internal_read on public.job_time_entries
  for select to authenticated using (portal_private.is_active_internal_staff(auth.uid()));

revoke all on table public.team_members from public, anon, authenticated;
revoke all on table public.job_team_assignments from public, anon, authenticated;
revoke all on table public.job_time_entries from public, anon, authenticated;
grant select on table public.team_members, public.job_team_assignments, public.job_time_entries to authenticated;

create or replace function public.save_team_member(p_member jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_id text := nullif(trim(p_member ->> 'id'), ''); v_saved jsonb;
begin
  perform portal_private.require_active_internal_staff();
  if v_id is null or nullif(trim(p_member ->> 'full_name'), '') is null then raise exception 'team_member_required'; end if;
  if nullif(p_member ->> 'default_hourly_cost', '')::numeric < 0 then raise exception 'team_member_hourly_cost_invalid'; end if;
  insert into public.team_members (id, display_code, full_name, status, default_hourly_cost, phone, notes, archived_at, updated_at)
  values (v_id, nullif(trim(p_member ->> 'display_code'), ''), trim(p_member ->> 'full_name'), coalesce(nullif(p_member ->> 'status', ''), 'active'), nullif(p_member ->> 'default_hourly_cost', '')::numeric, nullif(trim(p_member ->> 'phone'), ''), nullif(trim(p_member ->> 'notes'), ''), case when p_member ->> 'status' = 'inactive' then coalesce((p_member ->> 'archived_at')::timestamptz, now()) else null end, now())
  on conflict (id) do update set display_code = excluded.display_code, full_name = excluded.full_name, status = excluded.status, default_hourly_cost = excluded.default_hourly_cost, phone = excluded.phone, notes = excluded.notes, archived_at = excluded.archived_at, updated_at = now();
  select to_jsonb(t) into v_saved from public.team_members t where t.id = v_id;
  return v_saved;
end; $$;

create or replace function public.save_job_team_assignments(p_job_id text, p_assignments jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_assignment jsonb; v_member_id text; v_count integer := 0; v_result jsonb;
begin
  perform portal_private.require_active_internal_staff();
  if not exists (select 1 from public.jobs where id = p_job_id and archived_at is null and deleted_at is null) then raise exception 'team_job_invalid'; end if;
  if jsonb_typeof(p_assignments) <> 'array' then raise exception 'team_assignments_invalid'; end if;
  if exists (select 1 from jsonb_array_elements(p_assignments) a group by a ->> 'team_member_id' having count(*) > 1) then raise exception 'team_assignment_duplicate_worker'; end if;
  for v_assignment in select * from jsonb_array_elements(p_assignments) loop
    v_member_id := nullif(v_assignment ->> 'team_member_id', '');
    if v_member_id is null or not exists (select 1 from public.team_members where id = v_member_id and status = 'active' and archived_at is null) then raise exception 'team_worker_invalid'; end if;
    if nullif(v_assignment ->> 'planned_minutes', '')::integer <= 0 then raise exception 'team_planned_minutes_invalid'; end if;
    if nullif(v_assignment ->> 'hourly_cost_snapshot', '')::numeric < 0 then raise exception 'team_hourly_cost_invalid'; end if;
    v_count := v_count + 1;
  end loop;
  delete from public.job_team_assignments where job_id = p_job_id;
  insert into public.job_team_assignments (id, job_id, team_member_id, planned_minutes, hourly_cost_snapshot, status, notes, updated_at)
  select coalesce(nullif(a ->> 'id', ''), 'JTA-' || gen_random_uuid()::text), p_job_id, a ->> 'team_member_id', nullif(a ->> 'planned_minutes', '')::integer, coalesce(nullif(a ->> 'hourly_cost_snapshot', '')::numeric, t.default_hourly_cost), coalesce(nullif(a ->> 'status', ''), 'assigned'), nullif(a ->> 'notes', ''), now()
  from jsonb_array_elements(p_assignments) a join public.team_members t on t.id = a ->> 'team_member_id';
  select jsonb_agg(to_jsonb(a) order by a.created_at) into v_result from public.job_team_assignments a where a.job_id = p_job_id;
  return jsonb_build_object('job_id', p_job_id, 'assignment_count', v_count, 'assignments', coalesce(v_result, '[]'::jsonb));
end; $$;

create or replace function public.save_job_time_entry(p_entry jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, portal_private, pg_temp as $$
declare v_job_id text := nullif(p_entry ->> 'job_id', ''); v_member_id text := nullif(p_entry ->> 'team_member_id', ''); v_date date := (p_entry ->> 'work_date')::date; v_minutes integer := (p_entry ->> 'minutes')::integer; v_snapshot numeric; v_saved jsonb;
begin
  perform portal_private.require_active_internal_staff();
  if not exists (select 1 from public.jobs where id = v_job_id and archived_at is null and deleted_at is null) then raise exception 'team_job_invalid'; end if;
  if not exists (select 1 from public.job_team_assignments where job_id = v_job_id and team_member_id = v_member_id and status <> 'cancelled') then raise exception 'team_time_worker_not_assigned'; end if;
  if v_minutes is null or v_minutes <= 0 or v_minutes > 1440 then raise exception 'team_time_minutes_invalid'; end if;
  if nullif(p_entry ->> 'hourly_cost_snapshot', '')::numeric < 0 then raise exception 'team_hourly_cost_invalid'; end if;
  select coalesce(nullif(p_entry ->> 'hourly_cost_snapshot', '')::numeric, a.hourly_cost_snapshot, t.default_hourly_cost) into v_snapshot from public.job_team_assignments a join public.team_members t on t.id = a.team_member_id where a.job_id = v_job_id and a.team_member_id = v_member_id;
  insert into public.job_time_entries (id, job_id, team_member_id, work_date, minutes, hourly_cost_snapshot, notes, updated_at)
  values (coalesce(nullif(p_entry ->> 'id', ''), 'JTE-' || gen_random_uuid()::text), v_job_id, v_member_id, v_date, v_minutes, v_snapshot, nullif(trim(p_entry ->> 'notes'), ''), now())
  on conflict (job_id, team_member_id, work_date) do update set minutes = excluded.minutes, hourly_cost_snapshot = coalesce(job_time_entries.hourly_cost_snapshot, excluded.hourly_cost_snapshot), notes = excluded.notes, updated_at = now();
  select to_jsonb(e) into v_saved from public.job_time_entries e where e.job_id = v_job_id and e.team_member_id = v_member_id and e.work_date = v_date;
  return v_saved;
end; $$;

revoke all on function public.save_team_member(jsonb) from public, anon;
revoke all on function public.save_job_team_assignments(text, jsonb) from public, anon;
revoke all on function public.save_job_time_entry(jsonb) from public, anon;
grant execute on function public.save_team_member(jsonb) to authenticated;
grant execute on function public.save_job_team_assignments(text, jsonb) to authenticated;
grant execute on function public.save_job_time_entry(jsonb) to authenticated;
