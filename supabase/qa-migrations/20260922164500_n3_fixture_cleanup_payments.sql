create or replace function public.qa_n3_cleanup(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_marker text;
  v_ids text[];
  v_lines integer;
  v_payments integer;
  v_invoices integer;
begin
  v_user_id := app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
    or not exists (
      select 1 from public.internal_staff_memberships m
      where m.user_id = v_user_id and m.role in ('owner', 'admin')
        and m.status = 'active' and m.revoked_at is null
    ) then
    raise exception 'N3 cleanup requires an active QA internal administrator.' using errcode = '42501';
  end if;
  if p_run_id is null or p_run_id !~ '^[0-9a-f]{32}$' then
    raise exception 'Invalid N3 cleanup run id.' using errcode = '22023';
  end if;

  v_marker := 'QA_N3_' || p_run_id || '|source=n3_numbering_certification';
  if exists (select 1 from public.invoices i where i.id like 'QA_N3_INVOICE_' || p_run_id || '_%' and i.notes is distinct from v_marker) then
    raise exception 'N3 cleanup rejected a fixture with mismatched provenance.' using errcode = '42501';
  end if;
  select coalesce(pg_catalog.array_agg(i.id), array[]::text[]) into v_ids
  from public.invoices i where i.id like 'QA_N3_INVOICE_' || p_run_id || '_%' and i.notes = v_marker;

  perform pg_catalog.set_config('app.qa_n3_fixture_teardown', 'true', true);
  delete from public.payments p where p.invoice_id = any(v_ids);
  get diagnostics v_payments = row_count;
  delete from public.invoice_lines l where l.invoice_id = any(v_ids);
  get diagnostics v_lines = row_count;
  delete from public.invoices i where i.id = any(v_ids);
  get diagnostics v_invoices = row_count;

  return pg_catalog.jsonb_build_object('run_id', p_run_id, 'payments', v_payments,
    'invoice_lines', v_lines, 'invoices', v_invoices,
    'qa_n3_residue', (select count(*) from public.invoices i where i.id like 'QA_N3_INVOICE_' || p_run_id || '_%'));
end;
$function$;

alter function public.qa_n3_cleanup(text) owner to postgres;
revoke all on function public.qa_n3_cleanup(text) from public, anon, authenticated;
grant execute on function public.qa_n3_cleanup(text) to authenticated;
