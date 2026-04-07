alter table public.jobs
  add column if not exists billing_concept text,
  add column if not exists billing_quantity numeric(12,2) not null default 1,
  add column if not exists billing_unit text not null default 'servicio',
  add column if not exists billing_unit_price numeric(12,2);

alter table public.jobs
  alter column billing_unit set default 'servicio';

update public.jobs
set billing_concept = service_type
where billing_concept is null or btrim(billing_concept) = '';

update public.jobs
set billing_quantity = 1
where billing_quantity is null;

update public.jobs
set billing_unit = 'servicio'
where billing_unit is null or btrim(billing_unit) = '' or billing_unit = 'service';

alter table public.jobs
  alter column billing_quantity set not null,
  alter column billing_unit set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_billing_quantity_positive_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_billing_quantity_positive_check
      check (billing_quantity > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_billing_unit_price_non_negative_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_billing_unit_price_non_negative_check
      check (billing_unit_price is null or billing_unit_price >= 0);
  end if;
end $$;
