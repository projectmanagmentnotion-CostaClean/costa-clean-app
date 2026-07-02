begin;

-- Normalize invoice fiscal metadata into root JSON objects and regularize
-- INV-0050 / 2026-050 down to INV-0045 / 2026-045 only when it is still safe.

with extracted as (
  select
    i.id,
    (
      select elem
      from jsonb_array_elements(i.pricing_metadata) with ordinality as arr(elem, ord)
      where jsonb_typeof(elem) = 'object'
        and elem ? 'client_fiscal_snapshot'
      order by ord desc
      limit 1
    ) as latest_snapshot_wrapper
  from public.invoices i
  where jsonb_typeof(i.pricing_metadata) = 'array'
),
normalized_arrays as (
  update public.invoices i
  set pricing_metadata =
    case
      when extracted.latest_snapshot_wrapper is not null then extracted.latest_snapshot_wrapper
      else '{}'::jsonb
    end,
    updated_at = now()
  from extracted
  where i.id = extracted.id
  returning i.id
)
select count(*) from normalized_arrays;

update public.invoices
set pricing_metadata = '{}'::jsonb,
  updated_at = now()
where pricing_metadata is null
   or jsonb_typeof(pricing_metadata) <> 'object';

update public.invoices i
set pricing_metadata =
  coalesce(i.pricing_metadata, '{}'::jsonb)
  || jsonb_build_object(
    'client_fiscal_snapshot',
    jsonb_build_object(
      'client_id', c.id,
      'name', c.full_name,
      'fiscal_name', c.full_name,
      'tax_id', c.tax_id,
      'billing_address', c.billing_address,
      'email', c.email,
      'captured_at', now(),
      'source', 'client_backfill'
    ),
    'fiscal_backfilled_at', now(),
    'fiscal_backfill_source', 'client'
  ),
  updated_at = now()
from public.clients c
where c.id = i.client_id
  and not (coalesce(i.pricing_metadata, '{}'::jsonb) ? 'client_fiscal_snapshot')
  and nullif(trim(coalesce(c.full_name, '')), '') is not null
  and nullif(trim(coalesce(c.tax_id, '')), '') is not null
  and nullif(trim(coalesce(c.billing_address, '')), '') is not null;

do $$
declare
  v_target_id text := null;
  v_target_already_regularized boolean := false;
begin
  select exists (
    select 1
    from public.invoices
    where coalesce(pricing_metadata, '{}'::jsonb) ->> 'renumbered_from_invoice_number' = '2026-050'
      and invoice_number = '2026-045'
      and display_code = 'INV-0045'
  )
  into v_target_already_regularized;

  if v_target_already_regularized then
    return;
  end if;

  if exists (
    select 1
    from public.invoices
    where (display_code = 'INV-0045' or invoice_number = '2026-045')
      and not (
        coalesce(pricing_metadata, '{}'::jsonb) ->> 'renumbered_from_invoice_number' = '2026-050'
      )
  ) then
    raise exception 'No se puede regularizar: INV-0045 / 2026-045 ya existe.';
  end if;

  select id
  into v_target_id
  from public.invoices
  where display_code = 'INV-0050'
     or invoice_number = '2026-050'
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_target_id is null then
    raise exception 'No se puede regularizar: no existe INV-0050 / 2026-050.';
  end if;

  if exists (
    select 1
    from public.invoices
    where id = v_target_id
      and (
        deleted_at is not null
        or archived_at is not null
        or cancelled_at is not null
      )
  ) then
    raise exception 'No se puede regularizar: la factura 0050 esta archivada, eliminada o cancelada.';
  end if;

  if exists (
    select 1
    from public.invoices
    where id = v_target_id
      and (
        coalesce(pricing_metadata, '{}'::jsonb) ? 'sent_at'
        or coalesce(pricing_metadata, '{}'::jsonb) ? 'exported_at'
        or coalesce(pricing_metadata, '{}'::jsonb) ? 'pdf_url'
        or coalesce(pricing_metadata, '{}'::jsonb) ? 'document_url'
        or coalesce(pricing_metadata, '{}'::jsonb) ->> 'delivery_status' in ('sent', 'delivered', 'exported')
      )
  ) then
    raise exception 'No se puede regularizar: la factura 0050 parece enviada/exportada.';
  end if;

  update public.invoices
  set
    display_code = 'INV-0045',
    invoice_number = '2026-045',
    pricing_metadata = coalesce(pricing_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'invoice_number', '2026-045',
        'document_number', '2026-045',
        'renumbered_from_display_code', 'INV-0050',
        'renumbered_from_invoice_number', '2026-050',
        'renumbered_at', now(),
        'renumbered_reason', 'Factura creada pero no enviada; regularizacion de salto fiscal antes de entrega'
      ),
    updated_at = now()
  where id = v_target_id;
end $$;

commit;
