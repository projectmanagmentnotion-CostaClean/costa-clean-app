create or replace function public.portal_list_invoices(p_client_id text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, portal_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'invoiceNumber', i.invoice_number,
    'issueDate', i.issue_date,
    'status', i.status,
    'subtotal', i.subtotal,
    'taxAmount', i.tax_amount,
    'total', i.total,
    'paidAmount', coalesce(i.paid_amount, 0),
    'outstandingAmount', greatest(i.total - coalesce(i.paid_amount, 0), 0),
    'documentAvailable', (d.id is not null),
    'documentId', d.id
  ) order by i.issue_date desc), '[]'::jsonb)
  from (
    select inv.*, (
      select coalesce(sum(pay.amount), 0)
      from public.payments as pay
      where pay.invoice_id = inv.id
        and pay.deleted_at is null
        and pay.cancelled_at is null
    ) as paid_amount
    from public.invoices as inv
    where inv.client_id = portal_private.current_portal_client_id(p_client_id)
      and inv.deleted_at is null
      and inv.archived_at is null
    order by inv.issue_date desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) as i
  left join lateral (
    select document.id
    from public.invoice_document_records as document
    where document.invoice_id = i.id
      and document.status = 'ready'
    order by document.created_at desc, document.id desc
    limit 1
  ) as d on true;
$$;
