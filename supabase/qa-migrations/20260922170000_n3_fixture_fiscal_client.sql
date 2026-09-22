create or replace function public.qa_n3_create_drafts(p_run_id text, p_year integer, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_client_id text;
  v_ids text[];
  v_marker text;
begin
  v_user_id := app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
    or not exists (
      select 1 from public.internal_staff_memberships m
      where m.user_id = v_user_id and m.role in ('owner', 'admin')
        and m.status = 'active' and m.revoked_at is null
    ) then
    raise exception 'N3 fixtures require an active QA internal administrator.' using errcode = '42501';
  end if;
  if p_run_id is null or p_run_id !~ '^[0-9a-f]{32}$'
    or p_year < 2020 or p_year > 2100 or p_count < 1 or p_count > 10 then
    raise exception 'Invalid N3 fixture plan.' using errcode = '22023';
  end if;

  select c.id into v_client_id from public.clients c
  where nullif(trim(c.full_name), '') is not null
    and nullif(trim(c.tax_id), '') is not null
    and nullif(trim(c.billing_address), '') is not null
  order by c.id limit 1;
  if v_client_id is null then
    raise exception 'N3 fixtures need a QA client with complete fiscal fields.' using errcode = '55000';
  end if;
  v_marker := 'QA_N3_' || p_run_id || '|source=n3_numbering_certification';
  if exists (select 1 from public.invoices i where i.id like 'QA_N3_INVOICE_' || p_run_id || '_%') then
    raise exception 'N3 run id already exists.' using errcode = '23505';
  end if;

  with ids as (
    select ('QA_N3_INVOICE_' || p_run_id || '_' || lpad(n::text, 2, '0'))::text as id
    from pg_catalog.generate_series(1, p_count) n
  ), inserted as (
    insert into public.invoices(id, client_id, issue_date, status, subtotal, tax_amount, total, notes, pricing_metadata)
    select ids.id, v_client_id, pg_catalog.make_date(p_year, 1, 15), 'draft', 100, 21, 121,
      v_marker, pg_catalog.jsonb_build_object('source', 'n3_numbering_certification', 'run_id', p_run_id)
    from ids returning id
  )
  select pg_catalog.array_agg(id order by id) into v_ids from inserted;

  return pg_catalog.jsonb_build_object('run_id', p_run_id, 'invoice_ids', v_ids,
    'client_id', v_client_id, 'count', pg_catalog.cardinality(v_ids));
end;
$function$;

alter function public.qa_n3_create_drafts(text, integer, integer) owner to postgres;
revoke all on function public.qa_n3_create_drafts(text, integer, integer) from public, anon, authenticated;
grant execute on function public.qa_n3_create_drafts(text, integer, integer) to authenticated;
