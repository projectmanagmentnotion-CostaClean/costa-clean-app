alter table public.expenses
  add column if not exists ai_fiscal_classification text,
  add column if not exists ai_deductibility_percentage numeric(5,2),
  add column if not exists ai_vat_deductibility_percentage numeric(5,2),
  add column if not exists ai_estimated_deductible_base numeric(12,2),
  add column if not exists ai_estimated_deductible_vat numeric(12,2),
  add column if not exists ai_fiscal_confidence numeric(5,2),
  add column if not exists ai_fiscal_risk_level text,
  add column if not exists ai_fiscal_reasoning text,
  add column if not exists ai_fiscal_flags jsonb not null default '[]'::jsonb,
  add column if not exists ai_fiscal_model text,
  add column if not exists ai_fiscal_analyzed_at timestamptz,
  add column if not exists ai_fiscal_source_version text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_fiscal_classification_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_fiscal_classification_check
      check (
        ai_fiscal_classification is null or
        ai_fiscal_classification in (
          'probably_deductible',
          'partially_deductible',
          'probably_not_deductible',
          'requires_review'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_fiscal_risk_level_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_fiscal_risk_level_check
      check (
        ai_fiscal_risk_level is null or
        ai_fiscal_risk_level in ('low', 'medium', 'high')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_deductibility_percentage_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_deductibility_percentage_check
      check (
        ai_deductibility_percentage is null or
        (ai_deductibility_percentage >= 0 and ai_deductibility_percentage <= 100)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_vat_deductibility_percentage_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_vat_deductibility_percentage_check
      check (
        ai_vat_deductibility_percentage is null or
        (ai_vat_deductibility_percentage >= 0 and ai_vat_deductibility_percentage <= 100)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_fiscal_confidence_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_fiscal_confidence_check
      check (
        ai_fiscal_confidence is null or
        (ai_fiscal_confidence >= 0 and ai_fiscal_confidence <= 1)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_estimated_amounts_non_negative_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_estimated_amounts_non_negative_check
      check (
        (ai_estimated_deductible_base is null or ai_estimated_deductible_base >= 0) and
        (ai_estimated_deductible_vat is null or ai_estimated_deductible_vat >= 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_ai_fiscal_flags_array_check'
  ) then
    alter table public.expenses
      add constraint expenses_ai_fiscal_flags_array_check
      check (jsonb_typeof(ai_fiscal_flags) = 'array');
  end if;
end $$;

create index if not exists idx_expenses_ai_fiscal_classification
  on public.expenses(ai_fiscal_classification);

create index if not exists idx_expenses_ai_fiscal_risk_level
  on public.expenses(ai_fiscal_risk_level);

create index if not exists idx_expenses_ai_fiscal_analyzed_at
  on public.expenses(ai_fiscal_analyzed_at desc);

create index if not exists idx_expenses_ai_fiscal_flags
  on public.expenses using gin(ai_fiscal_flags);
