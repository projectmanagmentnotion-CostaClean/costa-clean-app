create table if not exists public.invoice_lines (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  sort_order integer not null default 1,
  concept text not null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'servicio',
  unit_price numeric(12,2) not null default 0,
  line_subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_lines_quantity_positive_check check (quantity > 0),
  constraint invoice_lines_unit_price_non_negative_check check (unit_price >= 0),
  constraint invoice_lines_line_subtotal_non_negative_check check (line_subtotal >= 0),
  constraint invoice_lines_sort_order_positive_check check (sort_order > 0)
);

create index if not exists invoice_lines_invoice_id_sort_order_idx
  on public.invoice_lines (invoice_id, sort_order);
