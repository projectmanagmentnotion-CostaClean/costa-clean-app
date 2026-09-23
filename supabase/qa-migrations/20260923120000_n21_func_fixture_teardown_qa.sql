begin;

-- QA-only support for the certified N2.1 synthetic namespace. This is not a
-- product migration and must never be applied with `supabase db push`.
create or replace function public.prevent_fiscal_invoice_hard_delete()
returns trigger
language plpgsql
as $function$
declare
  v_run_id text := current_setting('app.qa_n21_fixture_run_id', true);
begin
  if old.status in ('issued', 'paid') or old.invoice_number is not null or old.display_code is not null then
    if current_setting('app.qa_n3_fixture_teardown', true) = 'true'
      and coalesce(auth.jwt() ->> 'iss', '') = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
      and old.id like 'QA_N3_INVOICE_%'
      and coalesce(old.notes, '') ~ '^QA_N3_[0-9a-f]{32}\|source=n3_numbering_certification$' then
      return old;
    end if;
    if coalesce(auth.jwt() ->> 'iss', '') = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
      and old.id like 'QA_N2_INVOICE_%'
      and coalesce(old.notes, '') ~ '^QA_N2_CONC_[0-9a-f]{32}\|source=n2_concurrency_certification$' then
      return old;
    end if;
    if current_setting('app.qa_n21_fixture_teardown', true) = 'true'
      and coalesce(auth.jwt() ->> 'iss', '') = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
      and v_run_id ~ '^[0-9a-f]{32}$'
      and old.id ~ ('^INVOICE-QA_N2_FUNC_' || v_run_id || '_[A-Za-z0-9_-]+$')
      and coalesce(old.notes, '') ~ ('^QA_N2_FUNC_' || v_run_id || '_')
      and coalesce(old.pricing_metadata #>> '{n21_business_graph,operation_key}', '') like '%QA_N2_FUNC_' || v_run_id || '%'
      then
      return old;
    end if;
    raise exception 'Las facturas con numeracion fiscal no se pueden eliminar; deben conservar su trazabilidad.' using errcode = '55000';
  end if;
  return old;
end;
$function$;

alter function public.prevent_fiscal_invoice_hard_delete() owner to postgres;

create or replace function public.qa_n21_func_teardown_plan(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run_id text := lower(nullif(trim(p_run_id), ''));
  v_token text;
  v_client_ids text[] := array[]::text[];
  v_property_ids text[] := array[]::text[];
  v_quote_ids text[] := array[]::text[];
  v_job_ids text[] := array[]::text[];
  v_invoice_ids text[] := array[]::text[];
  v_untracked bigint := 0;
  v_real_matches bigint := 0;
  v_fiscal bigint := 0;
  v_result jsonb;
begin
  perform app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2.1 fixture teardown is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if v_run_id is null or v_run_id !~ '^[0-9a-f]{32}$' then
    raise exception 'N2.1 fixture teardown requires one exact 32-hex run id.' using errcode = '22023';
  end if;
  v_token := 'QA_N2_FUNC_' || v_run_id;

  select coalesce(array_agg(c.id), array[]::text[])
    into v_client_ids
  from public.clients c
  where c.full_name like v_token || '\_%' escape '\'
    and c.email ~ ('^' || v_run_id || '.*@qa\.invalid$');

  select coalesce(array_agg(p.id), array[]::text[])
    into v_property_ids
  from public.properties p
  where p.client_id = any(v_client_ids);

  select coalesce(array_agg(q.id), array[]::text[])
    into v_quote_ids
  from public.quotes q
  where q.client_id = any(v_client_ids);

  select coalesce(array_agg(j.id), array[]::text[])
    into v_job_ids
  from public.jobs j
  where j.client_id = any(v_client_ids);

  select coalesce(array_agg(i.id), array[]::text[])
    into v_invoice_ids
  from public.invoices i
  where i.client_id = any(v_client_ids);

  -- A synthetic client may not have an untracked child or a cross-client
  -- relation. The planner fails closed before any cleanup can begin.
  select count(*) into v_untracked
  from public.properties p
  where p.client_id = any(v_client_ids)
    and p.name not like v_token || '\_%' escape '\';
  select v_untracked + count(*) into v_untracked
  from public.quotes q
  where q.client_id = any(v_client_ids)
    and q.id not like 'QUOTE-' || v_token || '\_%' escape '\';
  select v_untracked + count(*) into v_untracked
  from public.jobs j
  where j.client_id = any(v_client_ids)
    and not (
      j.id like 'JOB-' || v_token || '\_%' escape '\'
      or j.source_metadata ->> 'source_invoice_id' like 'INVOICE-' || v_token || '\_%' escape '\'
    );
  select v_untracked + count(*) into v_untracked
  from public.invoices i
  where i.client_id = any(v_client_ids)
    and not (
      i.id like 'INVOICE-' || v_token || '\_%' escape '\'
      and i.notes like v_token || '\_%' escape '\'
      and coalesce(i.pricing_metadata #>> '{n21_business_graph,operation_key}', '') like '%' || v_token || '%'
    );
  select v_untracked + count(*) into v_untracked
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  where i.id like 'INVOICE-' || v_token || '\_%' escape '\'
    and (c.id is null or c.id <> all(v_client_ids));
  select v_untracked + count(*) into v_untracked
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  where j.id like 'JOB-' || v_token || '\_%' escape '\'
    and (c.id is null or c.id <> all(v_client_ids));

  select count(*) into v_real_matches
  from public.clients c
  where c.id = any(v_client_ids)
    and (c.full_name not like v_token || '\_%' escape '\' or c.email not like v_run_id || '%@qa.invalid');
  select v_real_matches + count(*) into v_real_matches
  from public.invoices i
  where i.id like 'INVOICE-' || v_token || '\_%' escape '\'
    and i.client_id <> all(v_client_ids);
  select count(*) into v_fiscal
  from public.invoices i
  where i.id = any(v_invoice_ids)
    and (i.status in ('issued', 'paid') or i.invoice_number is not null or i.display_code is not null);

  v_result := jsonb_build_object(
    'run_id', v_run_id,
    'namespace', v_token,
    'clients', cardinality(v_client_ids),
    'properties', (select count(*) from public.properties where id = any(v_property_ids)),
    'quotes', (select count(*) from public.quotes where id = any(v_quote_ids)),
    'quote_lines', (select count(*) from public.quote_lines where quote_id = any(v_quote_ids)),
    'jobs', (select count(*) from public.jobs where id = any(v_job_ids)),
    'job_lines', (select count(*) from public.job_lines where job_id = any(v_job_ids)),
    'invoices', cardinality(v_invoice_ids),
    'invoice_lines', (select count(*) from public.invoice_lines where invoice_id = any(v_invoice_ids)),
    'payments', (select count(*) from public.payments where invoice_id = any(v_invoice_ids)),
    'invoice_documents', (select count(*) from public.invoice_document_records where invoice_id = any(v_invoice_ids)),
    'audit_events', (select count(*) from public.audit_events where entity_id = any(v_invoice_ids) or entity_id = any(v_job_ids) or entity_id = any(v_quote_ids) or entity_id = any(v_client_ids) or entity_id = any(v_property_ids)),
    'invoice_business_operations', (select count(*) from public.invoice_business_operations where operation_key like '%' || v_token || '%' or payload::text like '%' || v_token || '%'),
    'invoice_settlement_operations', (select count(*) from public.invoice_settlement_operations where operation_key like '%' || v_token || '%' or payload::text like '%' || v_token || '%'),
    'recurring_plans', (select count(*) from public.recurring_invoice_plans where client_id = any(v_client_ids)),
    'fiscal_invoices', v_fiscal,
    'real_record_matches_for_teardown', v_real_matches,
    'untracked_relations', v_untracked,
    'safe_to_cleanup', v_untracked = 0 and v_real_matches = 0
  );
  return v_result;
end;
$function$;

create or replace function public.qa_n21_func_teardown(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run_id text := lower(nullif(trim(p_run_id), ''));
  v_plan jsonb;
  v_token text;
  v_client_ids text[] := array[]::text[];
  v_property_ids text[] := array[]::text[];
  v_quote_ids text[] := array[]::text[];
  v_job_ids text[] := array[]::text[];
  v_invoice_ids text[] := array[]::text[];
  v_operation_keys text[] := array[]::text[];
  v_deleted jsonb := '{}'::jsonb;
  v_count bigint;
begin
  perform app_private.require_active_internal_staff();
  v_plan := public.qa_n21_func_teardown_plan(v_run_id);
  if coalesce((v_plan ->> 'safe_to_cleanup')::boolean, false) is not true then
    raise exception 'N2.1 teardown refused: untracked relations or real records detected.' using errcode = '55000';
  end if;
  v_token := 'QA_N2_FUNC_' || v_run_id;
  perform set_config('app.qa_n21_fixture_teardown', 'true', true);
  perform set_config('app.qa_n21_fixture_run_id', v_run_id, true);

  select coalesce(array_agg(c.id), array[]::text[]) into v_client_ids
    from public.clients c where c.full_name like v_token || '\_%' escape '\' and c.email ~ ('^' || v_run_id || '.*@qa\.invalid$');
  select coalesce(array_agg(p.id), array[]::text[]) into v_property_ids from public.properties p where p.client_id = any(v_client_ids);
  select coalesce(array_agg(q.id), array[]::text[]) into v_quote_ids from public.quotes q where q.client_id = any(v_client_ids);
  select coalesce(array_agg(j.id), array[]::text[]) into v_job_ids from public.jobs j where j.client_id = any(v_client_ids);
  select coalesce(array_agg(i.id), array[]::text[]) into v_invoice_ids from public.invoices i where i.client_id = any(v_client_ids);
  select coalesce(array_agg(operation_key), array[]::text[]) into v_operation_keys from public.invoice_business_operations where operation_key like '%' || v_token || '%' or payload::text like '%' || v_token || '%';

  delete from public.audit_events where entity_id = any(v_invoice_ids) or entity_id = any(v_job_ids) or entity_id = any(v_quote_ids) or entity_id = any(v_client_ids) or entity_id = any(v_property_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('audit_events', v_count);
  delete from public.invoice_document_records where invoice_id = any(v_invoice_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('invoice_documents', v_count);
  delete from public.payments where invoice_id = any(v_invoice_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('payments', v_count);
  delete from public.invoice_lines where invoice_id = any(v_invoice_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('invoice_lines', v_count);
  delete from public.invoices where id = any(v_invoice_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('invoices', v_count);
  delete from public.job_lines where job_id = any(v_job_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('job_lines', v_count);
  delete from public.jobs where id = any(v_job_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('jobs', v_count);
  delete from public.quote_lines where quote_id = any(v_quote_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('quote_lines', v_count);
  delete from public.quotes where id = any(v_quote_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('quotes', v_count);
  delete from public.recurring_invoice_plans where client_id = any(v_client_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('recurring_plans', v_count);
  delete from public.properties where id = any(v_property_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('properties', v_count);
  delete from public.clients where id = any(v_client_ids);
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('clients', v_count);
  delete from public.invoice_settlement_operations where operation_key like '%' || v_token || '%' or payload::text like '%' || v_token || '%';
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('invoice_settlement_operations', v_count);
  delete from public.invoice_business_operations where operation_key like '%' || v_token || '%' or payload::text like '%' || v_token || '%';
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('invoice_business_operations', v_count);
  return jsonb_build_object('run_id', v_run_id, 'deleted', v_deleted, 'plan', v_plan);
end;
$function$;

alter function public.qa_n21_func_teardown_plan(text) owner to postgres;
alter function public.qa_n21_func_teardown(text) owner to postgres;
revoke all on function public.qa_n21_func_teardown_plan(text) from public, anon, authenticated;
revoke all on function public.qa_n21_func_teardown(text) from public, anon, authenticated;
grant execute on function public.qa_n21_func_teardown_plan(text) to authenticated;
grant execute on function public.qa_n21_func_teardown(text) to authenticated;

comment on function public.qa_n21_func_teardown_plan(text) is
  'QA-only read-only exact planner for one 32-hex QA_N2_FUNC run; fails closed on untracked relations.';
comment on function public.qa_n21_func_teardown(text) is
  'QA-only exact N2.1 synthetic teardown. Never use for Production or real QA data.';

commit;
