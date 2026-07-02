begin;

-- Backfill fiscal snapshots directly in the database behind the authenticated
-- financial write boundary. This version first normalizes pricing_metadata so
-- every invoice keeps an object at the root, never an array.

create or replace function public.backfill_invoice_fiscal_snapshots()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_invoices integer := 0;
  v_normalized_ids text[] := '{}'::text[];
  v_repaired_ids text[] := '{}'::text[];
  v_blocked_ids text[] := '{}'::text[];
begin
  perform public.require_authenticated_financial_write();

  select count(*)
  into v_total_invoices
  from public.invoices;

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
  ),
  normalized_scalars as (
    update public.invoices
    set pricing_metadata = '{}'::jsonb,
      updated_at = now()
    where pricing_metadata is null
       or jsonb_typeof(pricing_metadata) <> 'object'
    returning id
  )
  select coalesce(array_agg(id), '{}'::text[])
  into v_normalized_ids
  from (
    select id from normalized_arrays
    union
    select id from normalized_scalars
  ) as normalized_rows;

  with reparable as (
    select
      i.id,
      coalesce(i.pricing_metadata, '{}'::jsonb) as pricing_metadata,
      c.id as client_id,
      nullif(trim(coalesce(c.full_name, '')), '') as full_name,
      nullif(trim(coalesce(c.tax_id, '')), '') as tax_id,
      nullif(trim(coalesce(c.billing_address, '')), '') as billing_address,
      nullif(trim(coalesce(c.email, '')), '') as email
    from public.invoices i
    join public.clients c
      on c.id = i.client_id
    where not (coalesce(i.pricing_metadata, '{}'::jsonb) ? 'client_fiscal_snapshot')
      and nullif(trim(coalesce(c.full_name, '')), '') is not null
      and nullif(trim(coalesce(c.tax_id, '')), '') is not null
      and nullif(trim(coalesce(c.billing_address, '')), '') is not null
  ),
  updated_rows as (
    update public.invoices i
    set
      pricing_metadata = reparable.pricing_metadata
        || jsonb_build_object(
          'client_fiscal_snapshot',
          jsonb_build_object(
            'client_id', reparable.client_id,
            'name', reparable.full_name,
            'fiscal_name', reparable.full_name,
            'tax_id', reparable.tax_id,
            'billing_address', reparable.billing_address,
            'email', reparable.email,
            'captured_at', now(),
            'source', 'client_backfill'
          ),
          'fiscal_backfilled_at', now(),
          'fiscal_backfill_source', 'client'
        ),
      updated_at = now()
    from reparable
    where i.id = reparable.id
    returning i.id
  )
  select coalesce(array_agg(id), '{}'::text[])
  into v_repaired_ids
  from updated_rows;

  select coalesce(array_agg(i.id), '{}'::text[])
  into v_blocked_ids
  from public.invoices i
  left join public.clients c
    on c.id = i.client_id
  where not (coalesce(i.pricing_metadata, '{}'::jsonb) ? 'client_fiscal_snapshot')
    and (
      c.id is null
      or nullif(trim(coalesce(c.full_name, '')), '') is null
      or nullif(trim(coalesce(c.tax_id, '')), '') is null
      or nullif(trim(coalesce(c.billing_address, '')), '') is null
    );

  return jsonb_build_object(
    'total_invoices', v_total_invoices,
    'normalized', coalesce(array_length(v_normalized_ids, 1), 0),
    'repaired', coalesce(array_length(v_repaired_ids, 1), 0),
    'blocked', coalesce(array_length(v_blocked_ids, 1), 0),
    'failed', 0,
    'normalized_invoice_ids', v_normalized_ids,
    'repaired_invoice_ids', v_repaired_ids,
    'blocked_invoice_ids', v_blocked_ids,
    'failed_invoice_ids', '{}'::text[]
  );
end;
$$;

grant execute on function public.backfill_invoice_fiscal_snapshots() to authenticated;

commit;
