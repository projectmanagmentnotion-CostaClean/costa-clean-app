create table if not exists public.annual_closings (
  id uuid primary key default gen_random_uuid(),
  fiscal_year integer not null unique,
  status text not null default 'issues',
  closed_at timestamptz null,
  notes text,
  snapshot_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint annual_closings_status_check check (status in ('prepared', 'issues'))
);

create index if not exists idx_annual_closings_year
  on public.annual_closings(fiscal_year desc);

create or replace function public.set_updated_at_annual_closings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_annual_closings on public.annual_closings;

create trigger trg_set_updated_at_annual_closings
before update on public.annual_closings
for each row
execute function public.set_updated_at_annual_closings();

alter table public.annual_closings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'annual_closings'
      and policyname = 'Allow authenticated select annual closings'
  ) then
    create policy "Allow authenticated select annual closings"
      on public.annual_closings
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
      and tablename = 'annual_closings'
      and policyname = 'Allow authenticated insert annual closings'
  ) then
    create policy "Allow authenticated insert annual closings"
      on public.annual_closings
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
      and tablename = 'annual_closings'
      and policyname = 'Allow authenticated update annual closings'
  ) then
    create policy "Allow authenticated update annual closings"
      on public.annual_closings
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

comment on table public.annual_closings is 'Snapshots persistidos del cierre anual operativo de CostaClean CRM.';
