begin;

create or replace function public.qa_cleanup_financial_fixtures(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text := 'QA_CERT_' || nullif(trim(p_run_id), '') || '_';
  v_deleted jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.internal_staff_memberships
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'QA fixture cleanup requires an active admin membership.' using errcode = '42501';
  end if;

  if p_run_id is null or length(trim(p_run_id)) < 8 or length(trim(p_run_id)) > 80
    or p_run_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid QA fixture run id.' using errcode = '22023';
  end if;

  delete from public.payments where invoice_id in (select id from public.invoices where client_id in (select id from public.clients where full_name like v_prefix || '%'));
  delete from public.invoice_lines where invoice_id in (select id from public.invoices where client_id in (select id from public.clients where full_name like v_prefix || '%'));
  delete from public.quote_lines where quote_id in (select id from public.quotes where client_id in (select id from public.clients where full_name like v_prefix || '%'));
  delete from public.invoices where client_id in (select id from public.clients where full_name like v_prefix || '%');
  delete from public.quotes where client_id in (select id from public.clients where full_name like v_prefix || '%');
  delete from public.job_lines where job_id in (select id from public.jobs where client_id in (select id from public.clients where full_name like v_prefix || '%'));
  delete from public.jobs where client_id in (select id from public.clients where full_name like v_prefix || '%');
  delete from public.recurring_invoice_plans where title like v_prefix || '%';
  delete from public.properties where client_id in (select id from public.clients where full_name like v_prefix || '%');
  delete from public.clients where full_name like v_prefix || '%';

  select jsonb_build_object(
    'clients', 0,
    'properties', 0,
    'jobs', 0,
    'quotes', 0,
    'invoices', 0
  ) into v_deleted;
  return v_deleted;
end;
$$;

revoke all on function public.qa_cleanup_financial_fixtures(text) from public, anon;
grant execute on function public.qa_cleanup_financial_fixtures(text) to authenticated;

commit;
