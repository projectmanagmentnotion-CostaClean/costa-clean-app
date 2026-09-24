-- N2: one authenticated transactional boundary for job -> invoice -> optional payment.
-- This migration is prepared locally only; deployment is a separate authorization gate.

create table if not exists public.financial_operation_idempotency (
  idempotency_key text primary key check (char_length(idempotency_key) between 8 and 160),
  request_fingerprint text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.financial_operation_idempotency enable row level security;

create or replace function public.create_atomic_financial_operation(
  p_job jsonb,
  p_job_lines jsonb,
  p_invoice jsonb,
  p_invoice_lines jsonb,
  p_payment jsonb default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := nullif(trim(p_idempotency_key), '');
  v_fingerprint text;
  v_existing public.financial_operation_idempotency%rowtype;
  v_inserted_key text;
  v_job_id text := nullif(p_job ->> 'id', '');
  v_invoice_id text := nullif(p_invoice ->> 'id', '');
  v_client_id text := nullif(p_invoice ->> 'client_id', '');
  v_property_id text := nullif(p_invoice ->> 'property_id', '');
  v_quote_id text := nullif(p_invoice ->> 'quote_id', '');
  v_payment_id text := nullif(p_payment ->> 'id', '');
  v_payment_invoice_id text := nullif(p_payment ->> 'invoice_id', '');
  v_subtotal numeric;
  v_tax numeric := coalesce((p_invoice ->> 'tax_amount')::numeric, 0);
  v_total numeric := (p_invoice ->> 'total')::numeric;
  v_payment_amount numeric;
  v_result jsonb;
begin
  perform public.require_authenticated_financial_write();

  if v_key is null then
    raise exception 'idempotency_key_required';
  end if;
  if v_job_id is null or v_invoice_id is null or v_client_id is null then
    raise exception 'job_invoice_client_required';
  end if;
  if jsonb_typeof(p_job_lines) <> 'array' or jsonb_array_length(p_job_lines) = 0 then
    raise exception 'job_lines_required';
  end if;
  if jsonb_typeof(p_invoice_lines) <> 'array' or jsonb_array_length(p_invoice_lines) = 0 then
    raise exception 'invoice_lines_required';
  end if;

  if not exists (select 1 from public.clients where id = v_client_id) then
    raise exception 'client_not_found';
  end if;
  if v_property_id is not null and not exists (
    select 1 from public.properties where id = v_property_id and client_id = v_client_id
  ) then
    raise exception 'property_client_mismatch';
  end if;
  if v_quote_id is not null and not exists (
    select 1 from public.quotes where id = v_quote_id and client_id = v_client_id
  ) then
    raise exception 'quote_client_mismatch';
  end if;
  if nullif(p_job ->> 'client_id', '') is distinct from v_client_id
     or nullif(p_job ->> 'property_id', '') is distinct from v_property_id
     or nullif(p_job ->> 'quote_id', '') is distinct from v_quote_id then
    raise exception 'job_relationship_mismatch';
  end if;
  if nullif(p_invoice ->> 'job_id', '') is not null
     and nullif(p_invoice ->> 'job_id', '') <> v_job_id then
    raise exception 'invoice_job_mismatch';
  end if;
  if p_payment is not null and jsonb_typeof(p_payment) <> 'object' then
    raise exception 'payment_payload_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_invoice_lines) as line(quantity numeric, unit_price numeric, line_subtotal numeric, concept text)
    where nullif(trim(coalesce(line.concept, '')), '') is null
       or line.quantity is null or line.quantity <= 0
       or line.unit_price is null or line.unit_price < 0
       or line.line_subtotal is null
       or abs(line.line_subtotal - (line.quantity * line.unit_price)) > 0.01
  ) then
    raise exception 'invoice_line_totals_invalid';
  end if;

  select coalesce(sum(line.quantity * line.unit_price), 0)
  into v_subtotal
  from jsonb_to_recordset(p_invoice_lines) as line(quantity numeric, unit_price numeric);

  if (p_invoice ->> 'subtotal')::numeric is null
     or abs((p_invoice ->> 'subtotal')::numeric - v_subtotal) > 0.01
     or v_total is null
     or abs(v_total - (v_subtotal + v_tax)) > 0.01 then
    raise exception 'invoice_totals_invalid';
  end if;

  if p_payment is not null then
    if v_payment_id is null or v_payment_invoice_id is distinct from v_invoice_id then
      raise exception 'payment_invoice_mismatch';
    end if;
    v_payment_amount := (p_payment ->> 'amount')::numeric;
    if v_payment_amount is null or v_payment_amount <= 0 or v_payment_amount > v_total + 0.01 then
      raise exception 'payment_amount_invalid';
    end if;
  end if;

  v_fingerprint := md5(concat(p_job::text, '|', p_job_lines::text, '|', p_invoice::text, '|', p_invoice_lines::text, '|', coalesce(p_payment::text, 'null')));
  insert into public.financial_operation_idempotency (idempotency_key, request_fingerprint)
  values (v_key, v_fingerprint)
  on conflict (idempotency_key) do nothing
  returning idempotency_key into v_inserted_key;

  if v_inserted_key is null then
    select * into v_existing
    from public.financial_operation_idempotency
    where idempotency_key = v_key
    for update;
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency_conflict';
    end if;
    if v_existing.result is not null then
      return v_existing.result;
    end if;
  end if;

  perform public.save_job_with_lines(p_job || jsonb_build_object('id', v_job_id, 'client_id', v_client_id, 'property_id', v_property_id, 'quote_id', v_quote_id), p_job_lines);
  perform public.save_invoice_with_lines_v2(
    p_invoice || jsonb_build_object('id', v_invoice_id, 'job_id', v_job_id, 'client_id', v_client_id, 'property_id', v_property_id, 'quote_id', v_quote_id),
    p_invoice_lines
  );
  if p_payment is not null then
    perform public.save_payment_and_refresh_invoice(p_payment);
  end if;

  select jsonb_build_object(
    'idempotency_key', v_key,
    'job_id', v_job_id,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'payment_created', p_payment is not null,
    'financial_status', i.status
  )
  into v_result
  from public.invoices i
  where i.id = v_invoice_id;

  if v_result is null then
    raise exception 'atomic_financial_operation_readback_failed';
  end if;

  update public.financial_operation_idempotency
  set result = v_result
  where idempotency_key = v_key;
  return v_result;
end;
$$;

revoke all on function public.create_atomic_financial_operation(jsonb, jsonb, jsonb, jsonb, jsonb, text) from public;
grant execute on function public.create_atomic_financial_operation(jsonb, jsonb, jsonb, jsonb, jsonb, text) to authenticated;
