begin;

revoke all on function public.save_client_recurring_invoice_plan(jsonb) from anon;
revoke all on function public.generate_invoice_from_recurring_plan(text, text, date) from anon;
revoke all on function public.validate_invoice_relationships() from anon;

commit;
