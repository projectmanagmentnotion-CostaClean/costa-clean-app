-- Invoice identity is client/lines based; a job enriches the record when one exists.
-- Existing rows are untouched and the invoices_job_id_fkey remains in place.
alter table public.invoices
  alter column job_id drop not null;

comment on column public.invoices.job_id is
  'Optional service/job context for the invoice; the foreign key is preserved when present.';

-- Conceptual rollback (only if the data invariant is restored first):
-- alter table public.invoices alter column job_id set not null;
