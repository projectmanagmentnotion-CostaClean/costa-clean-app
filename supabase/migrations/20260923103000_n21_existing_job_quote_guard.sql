-- N2.1 corrective migration: close the existing-job/quote compatibility gap.
-- This is additive and does not rewrite the applied N2.1 migration.

create or replace function public.n21_assert_existing_job_quote_compatibility()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_job_quote_id text;
begin
  if new.job_id is null
     or new.quote_id is null
     or new.pricing_metadata -> 'n21_business_graph' is null then
    return new;
  end if;

  select j.quote_id
    into v_job_quote_id
    from public.jobs j
   where j.id = new.job_id;

  if v_job_quote_id is distinct from new.quote_id then
    raise exception 'El servicio no es compatible con el presupuesto.';
  end if;

  return new;
end;
$$;

revoke all on function public.n21_assert_existing_job_quote_compatibility() from public;
grant execute on function public.n21_assert_existing_job_quote_compatibility() to authenticated;

drop trigger if exists trg_n21_existing_job_quote_guard on public.invoices;
create trigger trg_n21_existing_job_quote_guard
before insert or update of job_id, quote_id, pricing_metadata on public.invoices
for each row
execute function public.n21_assert_existing_job_quote_compatibility();
