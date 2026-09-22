begin;

-- QA-only certification helpers. Every callable helper verifies a JWT issuer
-- signed by the canonical QA Auth service and an active internal admin.
create or replace function public.qa_financial_fixture_plan(p_run_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_run_id text := nullif(trim(p_run_id), '');
  v_cert_prefix text;
  v_n2_prefix text;
  v_client_ids text[] := array[]::text[];
  v_quote_ids text[] := array[]::text[];
  v_job_ids text[] := array[]::text[];
  v_invoice_ids text[] := array[]::text[];
  v_n2_residue bigint := 0;
  v_missing_tables text[] := array[]::text[];
  v_missing_migrations text[] := array[]::text[];
  v_missing_functions text[] := array[]::text[];
  v_cleanup_present boolean;
  v_rollback_present boolean;
begin
  v_user_id := app_private.require_active_internal_staff();
  if not exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = v_user_id and m.role in ('owner', 'admin')
      and m.status = 'active' and m.revoked_at is null
  ) then
    raise exception 'N2 QA certification requires an active internal administrator.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2 QA helper is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if v_run_id is not null and (length(v_run_id) < 8 or length(v_run_id) > 80 or v_run_id !~ '^[A-Za-z0-9_-]+$') then
    raise exception 'Invalid QA fixture run id.' using errcode = '22023';
  end if;

  v_cert_prefix := case when v_run_id is null then null else 'QA_CERT_' || v_run_id || '_' end;
  v_n2_prefix := case when v_run_id is null then 'QA_N2_CLIENT_' else 'QA_N2_CLIENT_' || v_run_id || '_' end;

  select coalesce(array_agg(c.id), array[]::text[])
  into v_client_ids
  from public.clients c
  where (v_cert_prefix is not null and left(c.full_name, length(v_cert_prefix)) = v_cert_prefix)
     or (
       left(c.full_name, length(v_n2_prefix)) = v_n2_prefix
       and c.email like 'qa_n2+%@qa.invalid'
       and (v_run_id is null or c.email = 'qa_n2+' || v_run_id || '@qa.invalid')
     );

  select coalesce(array_agg(q.id), array[]::text[]) into v_quote_ids
  from public.quotes q where q.client_id = any(v_client_ids);
  select coalesce(array_agg(j.id), array[]::text[]) into v_job_ids
  from public.jobs j where j.client_id = any(v_client_ids);
  select coalesce(array_agg(i.id), array[]::text[]) into v_invoice_ids
  from public.invoices i where i.client_id = any(v_client_ids);

  select
      (select count(*) from public.clients c where left(c.id, 6) = 'QA_N2_' or (left(c.full_name, length('QA_N2_CLIENT_')) = 'QA_N2_CLIENT_' and c.email like 'qa_n2+%@qa.invalid'))
    + (select count(*) from public.properties p where left(p.id, 6) = 'QA_N2_' or p.client_id = any(v_client_ids))
    + (select count(*) from public.quotes q where left(q.id, 6) = 'QA_N2_' or q.client_id = any(v_client_ids))
    + (select count(*) from public.quote_lines l where left(l.id, 6) = 'QA_N2_' or l.quote_id = any(v_quote_ids))
    + (select count(*) from public.jobs j where left(j.id, 6) = 'QA_N2_' or j.client_id = any(v_client_ids))
    + (select count(*) from public.job_lines l where left(l.id, 6) = 'QA_N2_' or l.job_id = any(v_job_ids))
    + (select count(*) from public.invoices i where left(i.id, 6) = 'QA_N2_' or i.client_id = any(v_client_ids))
    + (select count(*) from public.invoice_lines l where left(l.id, 6) = 'QA_N2_' or l.invoice_id = any(v_invoice_ids))
    + (select count(*) from public.payments p where left(p.id, 6) = 'QA_N2_' or p.invoice_id = any(v_invoice_ids))
    + (select count(*) from public.recurring_invoice_plans p where left(p.id, 6) = 'QA_N2_' or p.client_id = any(v_client_ids))
  into v_n2_residue;

  select coalesce(array_agg(required.name order by required.name), array[]::text[])
  into v_missing_tables
  from unnest(array[
    'clients','properties','quotes','quote_lines','jobs','job_lines','invoices',
    'invoice_lines','payments','recurring_invoice_plans','internal_staff_memberships'
  ]) required(name)
  where to_regclass('public.' || required.name) is null;

  select coalesce(array_agg(required.name order by required.name), array[]::text[])
  into v_missing_functions
  from unnest(array[
    'app_private.require_active_internal_staff()','app_private.require_internal_financial_write()',
    'public.save_job_with_lines(jsonb,jsonb)','public.save_invoice_with_lines_v2(jsonb,jsonb)',
    'public.settle_invoice_by_transfer(text)','public.assert_invoice_numbering_regular(integer,text)',
    'public.sync_invoice_numbering()','public.find_first_missing_invoice_sequence(integer,text)'
  ]) required(name)
  where to_regprocedure(required.name) is null;

  if to_regclass('supabase_migrations.schema_migrations') is null then
    v_missing_migrations := array['N1 migration history relation'];
  else
    execute $sql$
      select coalesce(array_agg(required.version order by required.version), array[]::text[])
      from unnest(array[
        '20260922091318','20260922093646','20260922104759',
        '20260922111338','20260922113953','20260922115842'
      ]) required(version)
      where not exists (
        select 1 from supabase_migrations.schema_migrations m
        where m.version = required.version
      )
    $sql$ into v_missing_migrations;
  end if;

  v_cleanup_present := to_regprocedure('public.qa_cleanup_financial_fixtures(text)') is not null;
  v_rollback_present := to_regprocedure('public.qa_n2_financial_rollback_harness(text,text,text)') is not null;

  return jsonb_build_object(
    'authorized_internal_admin', true,
    'qa_auth_issuer_verified', true,
    'run_id', v_run_id,
    'clients', cardinality(v_client_ids),
    'properties', (select count(*) from public.properties p where p.client_id = any(v_client_ids)),
    'quotes', cardinality(v_quote_ids),
    'quote_lines', (select count(*) from public.quote_lines l where l.quote_id = any(v_quote_ids)),
    'jobs', cardinality(v_job_ids),
    'job_lines', (select count(*) from public.job_lines l where l.job_id = any(v_job_ids)),
    'invoices', cardinality(v_invoice_ids),
    'invoice_lines', (select count(*) from public.invoice_lines l where l.invoice_id = any(v_invoice_ids)),
    'payments', (select count(*) from public.payments p where p.invoice_id = any(v_invoice_ids)),
    'recurring_plans', (select count(*) from public.recurring_invoice_plans p where p.client_id = any(v_client_ids)),
    'qa_n2_residue', v_n2_residue,
    'baseline', jsonb_build_object(
      'clients', (select count(*) from public.clients),
      'properties', (select count(*) from public.properties),
      'quotes', (select count(*) from public.quotes),
      'jobs', (select count(*) from public.jobs),
      'invoices', (select count(*) from public.invoices),
      'payments', (select count(*) from public.payments)
    ),
    'invariants', jsonb_build_object(
      'property_client_mismatches', (select count(*) from public.properties p where not exists (select 1 from public.clients c where c.id = p.client_id)),
      'quote_property_client_mismatches', (select count(*) from public.quotes q join public.properties p on p.id = q.property_id where q.client_id is not null and p.client_id <> q.client_id),
      'job_property_client_mismatches', (select count(*) from public.jobs j join public.properties p on p.id = j.property_id where p.client_id <> j.client_id),
      'invoice_property_client_mismatches', (select count(*) from public.invoices i join public.properties p on p.id = i.property_id where p.client_id <> i.client_id),
      'payment_without_valid_invoice', (select count(*) from public.payments p left join public.invoices i on i.id = p.invoice_id where i.id is null),
      'lines_without_valid_parent',
        (select count(*) from public.invoice_lines l left join public.invoices i on i.id = l.invoice_id where i.id is null)
        + (select count(*) from public.job_lines l left join public.jobs j on j.id = l.job_id where j.id is null)
        + (select count(*) from public.quote_lines l left join public.quotes q on q.id = l.quote_id where q.id is null)
    ),
    'missing_tables', to_jsonb(v_missing_tables),
    'missing_functions', to_jsonb(v_missing_functions),
    'missing_n1_migrations', to_jsonb(v_missing_migrations),
    'transaction_supported', current_setting('transaction_isolation', true) is not null,
    'cleanup_rpc_present', v_cleanup_present,
    'rollback_harness_present', v_rollback_present,
    'readiness', cardinality(v_missing_tables) = 0
      and cardinality(v_missing_functions) = 0
      and cardinality(v_missing_migrations) = 0
      and current_setting('transaction_isolation', true) is not null
      and v_cleanup_present
      and v_rollback_present
      and v_n2_residue = 0
  );
end;
$function$;

create or replace function public.qa_cleanup_financial_fixtures(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_run_id text := nullif(trim(p_run_id), '');
  v_cert_prefix text;
  v_n2_prefix text;
  v_client_ids text[] := array[]::text[];
  v_quote_ids text[] := array[]::text[];
  v_job_ids text[] := array[]::text[];
  v_invoice_ids text[] := array[]::text[];
  v_deleted jsonb;
  v_count bigint;
  v_totals jsonb := '{}'::jsonb;
begin
  v_user_id := app_private.require_active_internal_staff();
  if not exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = v_user_id and m.role in ('owner', 'admin')
      and m.status = 'active' and m.revoked_at is null
  ) then
    raise exception 'N2 QA cleanup requires an active internal administrator.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2 QA cleanup is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if v_run_id is null or length(v_run_id) < 8 or length(v_run_id) > 80 or v_run_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid QA fixture run id.' using errcode = '22023';
  end if;

  v_cert_prefix := 'QA_CERT_' || v_run_id || '_';
  v_n2_prefix := 'QA_N2_CLIENT_' || v_run_id || '_';

  select coalesce(array_agg(c.id), array[]::text[])
  into v_client_ids
  from public.clients c
  where left(c.full_name, length(v_cert_prefix)) = v_cert_prefix
     or (
       left(c.full_name, length(v_n2_prefix)) = v_n2_prefix
       and c.email = 'qa_n2+' || v_run_id || '@qa.invalid'
     );

  select coalesce(array_agg(q.id), array[]::text[]) into v_quote_ids
  from public.quotes q where q.client_id = any(v_client_ids);
  select coalesce(array_agg(j.id), array[]::text[]) into v_job_ids
  from public.jobs j where j.client_id = any(v_client_ids);
  select coalesce(array_agg(i.id), array[]::text[]) into v_invoice_ids
  from public.invoices i where i.client_id = any(v_client_ids);

  delete from public.payments where invoice_id = any(v_invoice_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('payments', v_count);
  delete from public.invoice_lines where invoice_id = any(v_invoice_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('invoice_lines', v_count);
  delete from public.invoices where id = any(v_invoice_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('invoices', v_count);
  delete from public.recurring_invoice_plans where client_id = any(v_client_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('recurring_plans', v_count);
  delete from public.job_lines where job_id = any(v_job_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('job_lines', v_count);
  delete from public.jobs where id = any(v_job_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('jobs', v_count);
  delete from public.quote_lines where quote_id = any(v_quote_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('quote_lines', v_count);
  delete from public.quotes where id = any(v_quote_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('quotes', v_count);
  delete from public.properties where client_id = any(v_client_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('properties', v_count);
  delete from public.clients where id = any(v_client_ids);
  get diagnostics v_count = row_count;
  v_totals := v_totals || jsonb_build_object('clients', v_count);

  return jsonb_build_object('cleaned', true, 'run_id', v_run_id, 'deleted', v_totals);
end;
$function$;

create or replace function public.qa_n2_financial_rollback_harness(
  p_client_id text,
  p_property_id text,
  p_run_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_stage text;
  v_job_id text;
  v_invoice_id text;
  v_year integer := extract(year from current_date)::integer;
  v_fiscal_count_before bigint;
  v_fiscal_count_after bigint;
  v_next_fiscal_number_before integer;
  v_next_fiscal_number_after integer;
  v_fiscal_state_before text;
  v_fiscal_state_after text;
  v_settlement_result jsonb;
  v_payment_count_before bigint;
  v_payment_count_after bigint;
  v_cases integer := 0;
  v_duplicate_settlement_rejected boolean := false;
begin
  v_user_id := app_private.require_active_internal_staff();
  if not exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = v_user_id and m.role in ('owner', 'admin')
      and m.status = 'active' and m.revoked_at is null
  ) then
    raise exception 'N2 rollback harness requires an active internal administrator.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2 rollback harness is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if p_run_id is null or length(p_run_id) < 8 or length(p_run_id) > 80 or p_run_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid QA fixture run id.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and left(c.full_name, length('QA_N2_CLIENT_' || p_run_id || '_')) = 'QA_N2_CLIENT_' || p_run_id || '_'
      and c.email = 'qa_n2+' || p_run_id || '@qa.invalid'
  ) then
    raise exception 'Rollback harness requires the exact QA_N2 client fixture.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.properties p
    where p.id = p_property_id and p.client_id = p_client_id
      and left(p.name, length('QA_N2_PROPERTY_' || p_run_id || '_')) = 'QA_N2_PROPERTY_' || p_run_id || '_'
  ) then
    raise exception 'Rollback harness requires the matching QA_N2 property fixture.' using errcode = '42501';
  end if;

  select count(*) into v_fiscal_count_before
  from public.invoices i
  where extract(year from i.issue_date)::integer = v_year
    and public.invoice_status_consumes_fiscal_number(i.status)
    and i.invoice_number is not null;
  select count(*) into v_payment_count_before from public.payments;
  v_next_fiscal_number_before := public.find_first_missing_invoice_sequence(v_year, null);
  select md5(coalesce(jsonb_agg(jsonb_build_array(i.id, i.invoice_number, i.display_code, i.status) order by i.id)::text, '[]'))
  into v_fiscal_state_before
  from public.invoices i
  where extract(year from i.issue_date)::integer = v_year
    and public.invoice_status_consumes_fiscal_number(i.status);

  foreach v_stage in array array['after_job', 'after_invoice', 'after_payment', 'duplicate_settlement']::text[] loop
    v_job_id := 'QA_N2_ROLLBACK_JOB_' || p_run_id || '_' || v_stage;
    v_invoice_id := 'QA_N2_ROLLBACK_INVOICE_' || p_run_id || '_' || v_stage;
    begin
      perform public.save_job_with_lines(
        jsonb_build_object(
          'id', v_job_id, 'client_id', p_client_id, 'property_id', p_property_id,
          'scheduled_date', current_date, 'status', 'scheduled', 'service_type', 'standard_cleaning',
          'notes', 'QA_N2 rollback-only run=' || p_run_id,
          'billing_concept', 'QA_N2 rollback canary', 'billing_quantity', 1,
          'billing_unit', 'servicio', 'billing_unit_price', 100
        ),
        jsonb_build_array(jsonb_build_object(
          'id', v_job_id || '_LINE_1', 'job_id', v_job_id, 'sort_order', 1,
          'concept', 'QA_N2 rollback canary', 'quantity', 1, 'unit', 'servicio',
          'unit_price', 100, 'line_subtotal', 100
        ))
      );
      if v_stage = 'after_job' then
        raise exception 'N2_ROLLBACK_SENTINEL' using errcode = 'P0001';
      end if;

      perform public.save_invoice_with_lines_v2(
        jsonb_build_object(
          'id', v_invoice_id, 'job_id', v_job_id, 'quote_id', null,
          'client_id', p_client_id, 'property_id', p_property_id,
          'issue_date', current_date, 'status', 'issued', 'subtotal', 100,
          'tax_amount', 21, 'total', 121, 'notes', 'QA_N2 rollback-only run=' || p_run_id,
          'pricing_metadata', public.ensure_invoice_pricing_metadata(
            jsonb_build_object('source', 'qa_n2_certification', 'run_id', p_run_id),
            p_client_id, 'client_backfill'
          )
        ),
        jsonb_build_array(jsonb_build_object(
          'id', v_invoice_id || '_LINE_1', 'invoice_id', v_invoice_id, 'sort_order', 1,
          'concept', 'QA_N2 rollback canary', 'quantity', 1, 'unit', 'servicio',
          'unit_price', 100, 'line_subtotal', 100
        ))
      );
      if v_stage = 'after_invoice' then
        raise exception 'N2_ROLLBACK_SENTINEL' using errcode = 'P0001';
      end if;

      perform public.settle_invoice_by_transfer(v_invoice_id);
      if v_stage = 'after_payment' then
        raise exception 'N2_ROLLBACK_SENTINEL' using errcode = 'P0001';
      end if;
      if v_stage = 'duplicate_settlement' then
        v_settlement_result := public.settle_invoice_by_transfer(v_invoice_id);
        if coalesce((v_settlement_result ->> 'created_payment')::boolean, true) then
          raise exception 'N2_DUPLICATE_SETTLEMENT_CREATED_PAYMENT' using errcode = '55000';
        end if;
        v_duplicate_settlement_rejected := true;
        raise exception 'N2_ROLLBACK_SENTINEL' using errcode = 'P0001';
      end if;
    exception when sqlstate 'P0001' then
      if sqlerrm <> 'N2_ROLLBACK_SENTINEL' then raise; end if;
    end;

    if exists (select 1 from public.jobs j where j.id = v_job_id)
      or exists (select 1 from public.job_lines l where l.job_id = v_job_id)
      or exists (select 1 from public.invoices i where i.id = v_invoice_id)
      or exists (select 1 from public.invoice_lines l where l.invoice_id = v_invoice_id)
      or exists (select 1 from public.payments p where p.invoice_id = v_invoice_id) then
      raise exception 'N2 rollback left persistent business rows at stage %.', v_stage using errcode = '55000';
    end if;
    v_cases := v_cases + 1;
  end loop;

  select count(*) into v_fiscal_count_after
  from public.invoices i
  where extract(year from i.issue_date)::integer = v_year
    and public.invoice_status_consumes_fiscal_number(i.status)
    and i.invoice_number is not null;
  select count(*) into v_payment_count_after from public.payments;
  v_next_fiscal_number_after := public.find_first_missing_invoice_sequence(v_year, null);
  select md5(coalesce(jsonb_agg(jsonb_build_array(i.id, i.invoice_number, i.display_code, i.status) order by i.id)::text, '[]'))
  into v_fiscal_state_after
  from public.invoices i
  where extract(year from i.issue_date)::integer = v_year
    and public.invoice_status_consumes_fiscal_number(i.status);
  if v_fiscal_count_after <> v_fiscal_count_before
    or v_payment_count_after <> v_payment_count_before
    or v_next_fiscal_number_after <> v_next_fiscal_number_before
    or v_fiscal_state_after <> v_fiscal_state_before then
    raise exception 'N2 rollback changed invoice numbering state or payment row counts.' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'passed', v_cases = 4 and v_duplicate_settlement_rejected,
    'stages', jsonb_build_array('after_job', 'after_invoice', 'after_payment', 'duplicate_settlement'),
    'rolled_back_jobs', 4,
    'rolled_back_issued_invoices', 3,
    'rolled_back_settlements', 2,
    'duplicate_settlement_idempotent', v_duplicate_settlement_rejected,
    'fiscal_numbering_rows_unchanged', true,
    'fiscal_number_mapping_unchanged', true,
    'next_fiscal_number_unchanged', true,
    'payment_rows_unchanged', true
  );
end;
$function$;

alter function public.qa_financial_fixture_plan(text) owner to postgres;
alter function public.qa_cleanup_financial_fixtures(text) owner to postgres;
alter function public.qa_n2_financial_rollback_harness(text,text,text) owner to postgres;
revoke all on function public.qa_financial_fixture_plan(text) from public, anon, authenticated;
revoke all on function public.qa_cleanup_financial_fixtures(text) from public, anon, authenticated;
revoke all on function public.qa_n2_financial_rollback_harness(text,text,text) from public, anon, authenticated;
grant execute on function public.qa_financial_fixture_plan(text) to authenticated;
grant execute on function public.qa_cleanup_financial_fixtures(text) to authenticated;
grant execute on function public.qa_n2_financial_rollback_harness(text,text,text) to authenticated;

comment on function public.qa_financial_fixture_plan(text) is
  'Read-only QA_N2 / QA_CERT fixture plan. Requires canonical QA issuer and active internal admin.';
comment on function public.qa_cleanup_financial_fixtures(text) is
  'QA-only exact-prefix cleanup for governed QA_CERT and QA_N2 fixture runs; admin-only.';
comment on function public.qa_n2_financial_rollback_harness(text,text,text) is
  'QA-only allowlisted rollback scenarios using canonical job, invoice, and settlement RPCs; all business writes are rolled back.';

commit;
