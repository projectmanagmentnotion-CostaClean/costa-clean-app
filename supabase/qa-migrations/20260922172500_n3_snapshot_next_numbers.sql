create or replace function public.qa_n3_numbering_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_mapping_hash text;
  v_sequence_last_value bigint;
  v_sequence_is_called boolean;
begin
  v_user_id := app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
    or not exists (
      select 1 from public.internal_staff_memberships m
      where m.user_id = v_user_id and m.role in ('owner', 'admin')
        and m.status = 'active' and m.revoked_at is null
    ) then
    raise exception 'N3 snapshot requires an active QA internal administrator.' using errcode = '42501';
  end if;

  select pg_catalog.md5(coalesce(pg_catalog.string_agg(
    pg_catalog.jsonb_build_array(i.id, i.invoice_number, i.display_code, i.issue_date::text, i.status)::text,
    pg_catalog.chr(10) order by i.id
  ), '')) into v_mapping_hash
  from public.invoices i;
  select last_value, is_called into v_sequence_last_value, v_sequence_is_called
  from public.invoices_invoice_number_seq;

  return pg_catalog.jsonb_build_object(
    'fiscal_mapping_hash', v_mapping_hash,
    'invoice_count', (select count(*) from public.invoices),
    'qa_n3_invoice_count', (select count(*) from public.invoices where id like 'QA_N3_INVOICE_%'),
    'sequence_last_value', v_sequence_last_value,
    'sequence_is_called', v_sequence_is_called,
    'next_sequence_2026', public.find_first_missing_invoice_sequence(2026, null),
    'next_sequence_2027', public.find_first_missing_invoice_sequence(2027, null)
  );
end;
$function$;

alter function public.qa_n3_numbering_snapshot() owner to postgres;
revoke all on function public.qa_n3_numbering_snapshot() from public, anon, authenticated;
grant execute on function public.qa_n3_numbering_snapshot() to authenticated;
