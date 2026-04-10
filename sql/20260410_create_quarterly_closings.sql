create table if not exists public.quarterly_closings (
  id uuid primary key default gen_random_uuid(),
  fiscal_year integer not null,
  fiscal_quarter integer not null,
  status text not null default 'issues',
  closed_at timestamptz null,
  notes text,
  snapshot_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quarterly_closings_year_quarter_unique unique (fiscal_year, fiscal_quarter),
  constraint quarterly_closings_quarter_check check (fiscal_quarter in (1, 2, 3, 4)),
  constraint quarterly_closings_status_check check (status in ('prepared', 'issues'))
);

create index if not exists idx_quarterly_closings_year_quarter
  on public.quarterly_closings(fiscal_year desc, fiscal_quarter desc);

create or replace function public.set_updated_at_quarterly_closings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_quarterly_closings on public.quarterly_closings;

create trigger trg_set_updated_at_quarterly_closings
before update on public.quarterly_closings
for each row
execute function public.set_updated_at_quarterly_closings();

alter table public.quarterly_closings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quarterly_closings'
      and policyname = 'Allow authenticated select quarterly closings'
  ) then
    create policy "Allow authenticated select quarterly closings"
      on public.quarterly_closings
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quarterly_closings'
      and policyname = 'Allow authenticated insert quarterly closings'
  ) then
    create policy "Allow authenticated insert quarterly closings"
      on public.quarterly_closings
      for insert
      to authenticated
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quarterly_closings'
      and policyname = 'Allow authenticated update quarterly closings'
  ) then
    create policy "Allow authenticated update quarterly closings"
      on public.quarterly_closings
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

comment on table public.quarterly_closings is 'Snapshots persistidos del cierre trimestral operativo de CostaClean CRM.';
