begin;

do $$
declare
  v_49_exists boolean := false;
  v_49_already_regularized boolean := false;
  v_54_id text := null;
begin
  select exists (
    select 1
    from public.invoices
    where display_code = 'INV-0049'
      and invoice_number = '2026-049'
      and coalesce(pricing_metadata, '{}'::jsonb) ->> 'renumbered_from_invoice_number' = '2026-054'
      and coalesce(pricing_metadata, '{}'::jsonb) ->> 'renumbered_from_display_code' = 'INV-0054'
  )
  into v_49_already_regularized;

  if v_49_already_regularized then
    return;
  end if;

  select exists (
    select 1
    from public.invoices
    where display_code = 'INV-0049'
       or invoice_number = '2026-049'
       or coalesce(pricing_metadata, '{}'::jsonb) ->> 'invoice_number' = '2026-049'
       or coalesce(pricing_metadata, '{}'::jsonb) ->> 'document_number' = '2026-049'
  )
  into v_49_exists;

  if v_49_exists then
    raise exception 'No se puede regularizar: INV-0049 / 2026-049 ya existe.';
  end if;

  select id
  into v_54_id
  from public.invoices
  where display_code = 'INV-0054'
     or invoice_number = '2026-054'
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_54_id is null then
    raise exception 'No se puede regularizar: no existe INV-0054 / 2026-054.';
  end if;

  if exists (
    select 1
    from public.invoices
    where id = v_54_id
      and (
        deleted_at is not null
        or archived_at is not null
        or cancelled_at is not null
      )
  ) then
    raise exception 'No se puede regularizar: la factura 0054 esta archivada, eliminada o cancelada.';
  end if;

  if exists (
    select 1
    from public.invoices
    where id = v_54_id
      and (
        coalesce(pricing_metadata, '{}'::jsonb) ? 'sent_at'
        or coalesce(pricing_metadata, '{}'::jsonb) ? 'exported_at'
        or coalesce(pricing_metadata, '{}'::jsonb) ? 'pdf_url'
        or coalesce(pricing_metadata, '{}'::jsonb) ? 'document_url'
        or coalesce(pricing_metadata, '{}'::jsonb) ->> 'delivery_status' in ('sent', 'delivered', 'exported')
      )
  ) then
    raise exception 'No se puede regularizar: la factura 0054 parece enviada/exportada.';
  end if;

  perform set_config('app.invoice_number_override', 'true', true);

  update public.invoices i
  set
    display_code = 'INV-0049',
    invoice_number = '2026-049',
    pricing_metadata =
      (
        case
          when jsonb_typeof(coalesce(i.pricing_metadata, '{}'::jsonb)) = 'object'
            then coalesce(i.pricing_metadata, '{}'::jsonb)
          else '{}'::jsonb
        end
      )
      || jsonb_build_object(
        'invoice_number', '2026-049',
        'document_number', '2026-049',
        'renumbered_from_display_code', 'INV-0054',
        'renumbered_from_invoice_number', '2026-054',
        'renumbered_at', now(),
        'renumbered_reason', 'Factura creada por numeracion legacy aceptada por la DB; regularizacion antes de entrega'
      )
      || case
        when not (
          (
            case
              when jsonb_typeof(coalesce(i.pricing_metadata, '{}'::jsonb)) = 'object'
                then coalesce(i.pricing_metadata, '{}'::jsonb)
              else '{}'::jsonb
            end
          ) ? 'client_fiscal_snapshot'
        )
        and c.id is not null
        and nullif(trim(coalesce(c.full_name, '')), '') is not null
        and nullif(trim(coalesce(c.tax_id, '')), '') is not null
        and nullif(trim(coalesce(c.billing_address, '')), '') is not null
        then jsonb_build_object(
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
        )
        else '{}'::jsonb
      end,
    updated_at = now()
  from public.clients c
  where i.id = v_54_id
    and c.id = i.client_id;

  if not exists (
    select 1
    from public.invoices
    where id = v_54_id
      and display_code = 'INV-0049'
      and invoice_number = '2026-049'
  ) then
    raise exception 'No se pudo confirmar la regularizacion de INV-0054 / 2026-054 a INV-0049 / 2026-049.';
  end if;
end $$;

commit;
