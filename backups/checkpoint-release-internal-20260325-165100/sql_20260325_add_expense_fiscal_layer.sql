alter table public.expenses
  add column if not exists document_support_status text not null default 'missing',
  add column if not exists fiscal_review_status text not null default 'pending',
  add column if not exists fiscal_risk_level text not null default 'medium',
  add column if not exists manager_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_document_support_status_check'
  ) then
    alter table public.expenses
      add constraint expenses_document_support_status_check
      check (
        document_support_status in ('missing', 'ticket', 'invoice_valid', 'pending_review')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_fiscal_review_status_check'
  ) then
    alter table public.expenses
      add constraint expenses_fiscal_review_status_check
      check (
        fiscal_review_status in ('pending', 'reviewed', 'observed')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_fiscal_risk_level_check'
  ) then
    alter table public.expenses
      add constraint expenses_fiscal_risk_level_check
      check (
        fiscal_risk_level in ('low', 'medium', 'high')
      );
  end if;
end $$;

create index if not exists idx_expenses_document_support_status
  on public.expenses(document_support_status);

create index if not exists idx_expenses_fiscal_review_status
  on public.expenses(fiscal_review_status);

create index if not exists idx_expenses_fiscal_risk_level
  on public.expenses(fiscal_risk_level);
