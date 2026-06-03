alter table public.payments
  add column if not exists origin_type text;

update public.payments
set origin_type = 'manual'
where coalesce(origin_type, '') = '';

alter table public.payments
  alter column origin_type set default 'manual';

create or replace function public.refresh_invoice_payment_status(
  p_invoice_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
  v_status text;
  v_paid numeric;
begin
  perform public.require_authenticated_financial_write();

  select total, status
  into v_total, v_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found or v_status = 'cancelled' then
    return;
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  if coalesce(v_total, 0) > 0 and v_paid >= v_total then
    update public.invoices
    set status = 'paid'
    where id = p_invoice_id
      and status <> 'paid';
  elsif v_status = 'paid' and v_paid < coalesce(v_total, 0) then
    update public.invoices
    set status = 'issued'
    where id = p_invoice_id;
  end if;
end;
$$;

create or replace function public.save_payment_and_refresh_invoice(
  p_payment jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id text := nullif(p_payment ->> 'id', '');
  v_invoice_id text := nullif(p_payment ->> 'invoice_id', '');
  v_previous_invoice_id text;
  v_amount numeric := (p_payment ->> 'amount')::numeric;
  v_payment_method text := nullif(p_payment ->> 'payment_method', '');
  v_origin_type text := coalesce(nullif(p_payment ->> 'origin_type', ''), 'manual');
begin
  perform public.require_authenticated_financial_write();

  if v_payment_id is null then
    raise exception 'El cobro necesita identificador.';
  end if;

  if v_invoice_id is null then
    raise exception 'El cobro necesita una factura vinculada.';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'El importe del cobro debe ser mayor que cero.';
  end if;

  if v_payment_method is not null and v_payment_method not in ('transfer', 'cash', 'bizum', 'card') then
    raise exception 'El metodo de cobro no es valido.';
  end if;

  if v_origin_type not in ('manual', 'transfer_auto') then
    raise exception 'El origen del cobro no es valido.';
  end if;

  select invoice_id
  into v_previous_invoice_id
  from public.payments
  where id = v_payment_id
  for update;

  insert into public.payments (
    id,
    invoice_id,
    payment_date,
    amount,
    payment_method,
    origin_type,
    notes
  )
  values (
    v_payment_id,
    v_invoice_id,
    (p_payment ->> 'payment_date')::date,
    v_amount,
    v_payment_method,
    v_origin_type,
    nullif(p_payment ->> 'notes', '')
  )
  on conflict (id) do update set
    invoice_id = excluded.invoice_id,
    payment_date = excluded.payment_date,
    amount = excluded.amount,
    payment_method = excluded.payment_method,
    origin_type = excluded.origin_type,
    notes = excluded.notes;

  if v_previous_invoice_id is not null and v_previous_invoice_id <> v_invoice_id then
    perform public.refresh_invoice_payment_status(v_previous_invoice_id);
  end if;

  perform public.refresh_invoice_payment_status(v_invoice_id);
end;
$$;

create or replace function public.settle_invoice_by_transfer(
  p_invoice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice record;
  v_paid numeric := 0;
  v_outstanding numeric := 0;
  v_payment_id text;
  v_paid_after numeric := 0;
  v_outstanding_after numeric := 0;
begin
  perform public.require_authenticated_financial_write();

  if nullif(p_invoice_id, '') is null then
    raise exception 'La factura necesita identificador.';
  end if;

  select id, total, status
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'No se encontro la factura indicada.';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception 'No se puede cobrar por transferencia una factura cancelada.';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  v_outstanding := greatest(coalesce(v_invoice.total, 0) - v_paid, 0);

  if v_outstanding <= 0.009 then
    return jsonb_build_object(
      'payment_id', null,
      'invoice_id', p_invoice_id,
      'created_payment', false,
      'outstanding_before', 0,
      'paid_total_after', v_paid,
      'outstanding_after', 0,
      'financial_status', 'paid'
    );
  end if;

  v_payment_id := 'PAYMENT-' || gen_random_uuid()::text;

  insert into public.payments (
    id,
    invoice_id,
    payment_date,
    amount,
    payment_method,
    origin_type,
    notes
  )
  values (
    v_payment_id,
    p_invoice_id,
    current_date,
    v_outstanding,
    'transfer',
    'transfer_auto',
    'Cobro automatico por transferencia desde la factura.'
  );

  perform public.refresh_invoice_payment_status(p_invoice_id);

  select coalesce(sum(amount), 0)
  into v_paid_after
  from public.payments
  where invoice_id = p_invoice_id;

  v_outstanding_after := greatest(coalesce(v_invoice.total, 0) - v_paid_after, 0);

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'created_payment', true,
    'outstanding_before', v_outstanding,
    'paid_total_after', v_paid_after,
    'outstanding_after', v_outstanding_after,
    'financial_status', case
      when v_outstanding_after <= 0.009 then 'paid'
      when v_paid_after > 0.009 then 'partially_paid'
      else 'pending'
    end
  );
end;
$$;

revoke execute on function public.settle_invoice_by_transfer(text) from public, anon;
grant execute on function public.settle_invoice_by_transfer(text) to authenticated;
