begin;

-- Production repair executed for the numbering gap after 2026-026 / INV-0026.
-- Affected rows were created with 2026-031..2026-037 / INV-0031..INV-0037
-- and must become 2026-027..2026-033 / INV-0027..INV-0033 without changing ids.

update public.invoices
set invoice_number = '2026-027',
    display_code = 'INV-0027'
where id = 'INVOICE-84e480c5-71e8-4418-9955-821e8640154f'
  and invoice_number = '2026-031'
  and display_code = 'INV-0031';

update public.invoices
set invoice_number = '2026-028',
    display_code = 'INV-0028'
where id = 'INVOICE-178ef439-3e02-4972-bf1e-ee11bba85be0'
  and invoice_number = '2026-032'
  and display_code = 'INV-0032';

update public.invoices
set invoice_number = '2026-029',
    display_code = 'INV-0029'
where id = 'INVOICE-21f7ccf8-6b33-4b2c-ac93-bf5a11658807'
  and invoice_number = '2026-033'
  and display_code = 'INV-0033';

update public.invoices
set invoice_number = '2026-030',
    display_code = 'INV-0030'
where id = 'INVOICE-61e7b3cf-fdfd-4458-9208-e40584e72aa1'
  and invoice_number = '2026-034'
  and display_code = 'INV-0034';

update public.invoices
set invoice_number = '2026-031',
    display_code = 'INV-0031'
where id = 'INVOICE-b3d96d02-0986-4aa2-ac30-579342f8d115'
  and invoice_number = '2026-035'
  and display_code = 'INV-0035';

update public.invoices
set invoice_number = '2026-032',
    display_code = 'INV-0032'
where id = 'INVOICE-169e02f1-18c8-46e6-a163-7d174b87a05f'
  and invoice_number = '2026-036'
  and display_code = 'INV-0036';

update public.invoices
set invoice_number = '2026-033',
    display_code = 'INV-0033'
where id = 'INVOICE-eb2664af-7837-4877-be77-101ce1f22573'
  and invoice_number = '2026-037'
  and display_code = 'INV-0037';

select setval('public.invoices_invoice_number_seq'::regclass, 33, true);
select setval('public.invoices_display_code_seq'::regclass, 33, true);

commit;
