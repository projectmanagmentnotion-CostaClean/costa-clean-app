create or replace function public.qa_n3_assert_fiscal_protections(p_run_id text, p_invoice_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.invoices%rowtype;
  v_renumber_blocked boolean := false;
  v_year_change_blocked boolean := false;
  v_delete_blocked boolean := false;
begin
  v_user_id := app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
    or not exists (
      select 1 from public.internal_staff_memberships m
      where m.user_id = v_user_id and m.role in ('owner', 'admin')
        and m.status = 'active' and m.revoked_at is null
    ) then
    raise exception 'N3 protection probe requires an active QA internal administrator.' using errcode = '42501';
  end if;
  if p_run_id is null or p_run_id !~ '^[0-9a-f]{32}$'
    or p_invoice_id not like 'QA_N3_INVOICE_' || p_run_id || '_%' then
    raise exception 'Invalid N3 protection-probe fixture identity.' using errcode = '22023';
  end if;
  select * into v_row from public.invoices i
  where i.id = p_invoice_id and i.notes = 'QA_N3_' || p_run_id || '|source=n3_numbering_certification';
  if not found or v_row.status not in ('issued', 'paid', 'cancelled')
    or v_row.invoice_number is null or v_row.display_code is null then
    raise exception 'N3 protection probe requires an issued, numbered fixture.' using errcode = '55000';
  end if;

  begin
    update public.invoices set invoice_number = v_row.invoice_number || '-MUTATED' where id = p_invoice_id;
  exception when sqlstate '55000' then v_renumber_blocked := true;
  end;
  begin
    update public.invoices set issue_date = (v_row.issue_date + interval '1 year')::date where id = p_invoice_id;
  exception when sqlstate '55000' then v_year_change_blocked := true;
  end;
  begin
    delete from public.invoices where id = p_invoice_id;
  exception when sqlstate '55000' then v_delete_blocked := true;
  end;

  if not v_renumber_blocked or not v_year_change_blocked or not v_delete_blocked then
    raise exception 'N3 fiscal immutability guard did not block every protected mutation.' using errcode = '55000';
  end if;
  return pg_catalog.jsonb_build_object('renumber_blocked', v_renumber_blocked,
    'year_change_blocked', v_year_change_blocked, 'delete_blocked', v_delete_blocked);
end;
$function$;

alter function public.qa_n3_assert_fiscal_protections(text, text) owner to postgres;
revoke all on function public.qa_n3_assert_fiscal_protections(text, text) from public, anon, authenticated;
grant execute on function public.qa_n3_assert_fiscal_protections(text, text) to authenticated;
