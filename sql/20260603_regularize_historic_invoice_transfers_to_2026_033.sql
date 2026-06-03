begin;

alter table public.payments
  add column if not exists origin_type text;

update public.payments
set origin_type = 'manual'
where coalesce(origin_type, '') = '';

alter table public.payments
  alter column origin_type set default 'manual';

with invoice_scope as (
  select
    i.id,
    i.invoice_number,
    i.display_code,
    i.issue_date,
    i.total,
    i.status,
    coalesce(sum(p.amount), 0) as paid_amount
  from public.invoices i
  left join public.payments p
    on p.invoice_id = i.id
  where i.status <> 'cancelled'
    and (
      (i.invoice_number is not null and i.invoice_number <= '2026-033')
      or (i.display_code is not null and i.display_code <= 'INV-0033')
    )
  group by i.id, i.invoice_number, i.display_code, i.issue_date, i.total, i.status
),
regularization_targets as (
  select
    scope.id as invoice_id,
    greatest(coalesce(scope.total, 0) - scope.paid_amount, 0) as remaining_amount
  from invoice_scope scope
  where greatest(coalesce(scope.total, 0) - scope.paid_amount, 0) > 0.009
),
inserted_payments as (
  insert into public.payments (
    id,
    invoice_id,
    payment_date,
    amount,
    payment_method,
    origin_type,
    notes
  )
  select
    'PAYMENT-' || gen_random_uuid()::text,
    target.invoice_id,
    current_date,
    target.remaining_amount,
    'transfer',
    'transfer_regularization',
    'Regularizacion historica masiva por transferencia hasta 2026-033.'
  from regularization_targets target
  returning invoice_id
)
select public.refresh_invoice_payment_status(invoice_id)
from inserted_payments;

commit;
