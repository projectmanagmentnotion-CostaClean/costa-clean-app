begin;

lock table public.invoices in row exclusive mode;

do $$
declare
  v_43_exists boolean;
  v_44_exists boolean;
  v_48_id text;
  v_49_id text;
  v_48_status text;
  v_49_status text;
  v_48_pricing_metadata jsonb;
  v_49_pricing_metadata jsonb;
begin
  select exists (
    select 1
    from public.invoices
    where display_code = 'INV-0043'
       or invoice_number = '2026-043'
       or pricing_metadata ->> 'invoice_number' = '2026-043'
       or pricing_metadata ->> 'document_number' = '2026-043'
  ) into v_43_exists;

  select exists (
    select 1
    from public.invoices
    where display_code = 'INV-0044'
       or invoice_number = '2026-044'
       or pricing_metadata ->> 'invoice_number' = '2026-044'
       or pricing_metadata ->> 'document_number' = '2026-044'
  ) into v_44_exists;

  if v_43_exists or v_44_exists then
    raise exception 'No se puede regularizar: INV-0043/0044 o 2026-043/044 ya existen.';
  end if;

  select id, status, coalesce(pricing_metadata, '{}'::jsonb)
  into v_48_id, v_48_status, v_48_pricing_metadata
  from public.invoices
  where display_code = 'INV-0048'
     or invoice_number = '2026-048'
  limit 1;

  select id, status, coalesce(pricing_metadata, '{}'::jsonb)
  into v_49_id, v_49_status, v_49_pricing_metadata
  from public.invoices
  where display_code = 'INV-0049'
     or invoice_number = '2026-049'
  limit 1;

  if v_48_id is null or v_49_id is null then
    raise exception 'No se puede regularizar: no se encontraron INV-0048 e INV-0049.';
  end if;

  if exists (
    select 1
    from public.invoices
    where id in (v_48_id, v_49_id)
      and deleted_at is not null
  ) then
    raise exception 'No se puede regularizar: alguna de las facturas objetivo esta en papelera.';
  end if;

  if exists (
    select 1
    from public.invoices
    where id in (v_48_id, v_49_id)
      and (
        pricing_metadata ? 'sent_at'
        or pricing_metadata ? 'exported_at'
        or pricing_metadata ? 'pdf_url'
        or pricing_metadata ? 'document_locked_at'
        or pricing_metadata ? 'delivered_at'
      )
  ) then
    raise exception 'No se puede regularizar: alguna factura objetivo tiene metadata de envio/exportacion/documento final.';
  end if;

  update public.invoices
  set
    display_code = 'INV-0043',
    invoice_number = '2026-043',
    pricing_metadata = jsonb_strip_nulls(
      coalesce(pricing_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'invoice_number', '2026-043',
        'document_number', '2026-043',
        'renumbered_from_display_code', 'INV-0048',
        'renumbered_from_invoice_number', '2026-048',
        'renumbered_at', now(),
        'renumbered_reason', 'Factura creada pero no enviada; regularizacion de secuencia antes de entrega'
      )
    ),
    updated_at = now()
  where id = v_48_id;

  update public.invoices
  set
    display_code = 'INV-0044',
    invoice_number = '2026-044',
    pricing_metadata = jsonb_strip_nulls(
      coalesce(pricing_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'invoice_number', '2026-044',
        'document_number', '2026-044',
        'renumbered_from_display_code', 'INV-0049',
        'renumbered_from_invoice_number', '2026-049',
        'renumbered_at', now(),
        'renumbered_reason', 'Factura creada pero no enviada; regularizacion de secuencia antes de entrega'
      )
    ),
    updated_at = now()
  where id = v_49_id;
end $$;

select
  id,
  display_code,
  invoice_number,
  status,
  issue_date,
  pricing_metadata ->> 'invoice_number' as metadata_invoice_number,
  pricing_metadata ->> 'document_number' as metadata_document_number,
  pricing_metadata ->> 'renumbered_from_display_code' as renumbered_from_display_code,
  pricing_metadata ->> 'renumbered_from_invoice_number' as renumbered_from_invoice_number
from public.invoices
where display_code in ('INV-0043', 'INV-0044', 'INV-0048', 'INV-0049')
   or invoice_number in ('2026-043', '2026-044', '2026-048', '2026-049')
order by display_code nulls last, invoice_number nulls last;

commit;
