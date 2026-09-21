begin;

revoke all on function public.save_client_recurring_invoice_plan(jsonb) from public;
grant execute on function public.save_client_recurring_invoice_plan(jsonb) to authenticated;

revoke all on function public.generate_invoice_from_recurring_plan(text, text, date) from public;
grant execute on function public.generate_invoice_from_recurring_plan(text, text, date) to authenticated;

revoke all on function public.validate_invoice_relationships() from public;

revoke all on function public.copy_latest_invoice_template_by_tax_id(text, date, text, text) from public;
grant execute on function public.copy_latest_invoice_template_by_tax_id(text, date, text, text) to authenticated;

revoke all on function public.run_monthly_alcapa_gilfit_recurring_invoices() from public;
grant execute on function public.run_monthly_alcapa_gilfit_recurring_invoices() to authenticated;

commit;
