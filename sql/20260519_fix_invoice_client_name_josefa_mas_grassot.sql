begin;

create temp table tmp_josefa_invoice_name_fix on commit drop as
select
  i.id as invoice_id,
  i.invoice_number,
  i.display_code,
  i.client_id,
  c.full_name as current_client_name
from public.invoices i
join public.clients c
  on c.id = i.client_id
where c.full_name = 'JOSEFA LLAS GRANOT';

update public.clients c
set full_name = 'Josefa Mas Grassot'
where c.id in (
  select distinct client_id
  from tmp_josefa_invoice_name_fix
)
and c.full_name = 'JOSEFA LLAS GRANOT';

select
  invoice_id,
  invoice_number,
  display_code,
  client_id,
  current_client_name as previous_client_name
from tmp_josefa_invoice_name_fix
order by invoice_number nulls last, display_code nulls last, invoice_id;

select
  i.id as invoice_id,
  i.invoice_number,
  i.display_code,
  i.client_id,
  c.full_name as corrected_client_name
from public.invoices i
join public.clients c
  on c.id = i.client_id
where i.id in (
  select invoice_id
  from tmp_josefa_invoice_name_fix
)
order by i.invoice_number nulls last, i.display_code nulls last, i.id;

commit;
