begin;

-- QA-only support for exact QA_N4_FUNC_<32 lowercase hex> runs.
-- Never apply this file as a product or Production migration.

create or replace function public.qa_n4_func_teardown_plan(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run_id text := lower(nullif(trim(p_run_id), ''));
  v_token text;
  v_plan_ids text[] := '{}'::text[];
  v_client_ids text[] := '{}'::text[];
  v_property_ids text[] := '{}'::text[];
  v_synthetic_client_ids text[] := '{}'::text[];
  v_synthetic_property_ids text[] := '{}'::text[];
  v_job_ids text[] := '{}'::text[];
  v_untracked bigint := 0;
  v_real_matches bigint := 0;
  v_external_refs bigint := 0;
  v_financial_refs bigint := 0;
begin
  perform app_private.require_active_internal_staff();
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N4 fixture teardown is restricted to the canonical QA Auth issuer.' using errcode = '42501';
  end if;
  if v_run_id is null or v_run_id !~ '^[0-9a-f]{32}$' then
    raise exception 'N4 fixture teardown requires one exact 32-hex run id.' using errcode = '22023';
  end if;

  v_token := 'QA_N4_FUNC_' || v_run_id;

  select coalesce(array_agg(p.id order by p.id), '{}'::text[])
    into v_plan_ids
  from public.recurring_service_plans p
  where p.id like 'PLAN-' || v_token || '\_%' escape '\'
    and (
      coalesce(p.notes, '') = v_token
      or coalesce(p.notes, '') like v_token || '|%'
      or coalesce(p.internal_notes, '') = v_token
      or coalesce(p.internal_notes, '') like v_token || '|%'
    );

  select coalesce(array_agg(distinct p.client_id order by p.client_id), '{}'::text[])
    into v_client_ids
  from public.recurring_service_plans p
  where p.id = any(v_plan_ids);

  select coalesce(array_agg(distinct p.property_id order by p.property_id), '{}'::text[])
    into v_property_ids
  from public.recurring_service_plans p
  where p.id = any(v_plan_ids);

  select coalesce(array_agg(c.id order by c.id), '{}'::text[])
    into v_synthetic_client_ids
  from public.clients c
  where c.full_name = 'CLIENT-' || v_token || '-ROOT'
    and c.email = v_run_id || '@qa.invalid';

  select coalesce(array_agg(p.id order by p.id), '{}'::text[])
    into v_synthetic_property_ids
  from public.properties p
  where p.name = 'PROPERTY-' || v_token || '-ROOT'
    and p.notes = v_token;

  v_client_ids := array(
    select distinct id from unnest(v_client_ids || v_synthetic_client_ids) as u(id) order by id
  );
  v_property_ids := array(
    select distinct id from unnest(v_property_ids || v_synthetic_property_ids) as u(id) order by id
  );

  select coalesce(array_agg(j.id order by j.id), '{}'::text[])
    into v_job_ids
  from public.jobs j
  where j.recurring_service_plan_id = any(v_plan_ids)
    and j.recurring_occurrence_date is not null
    and j.source_metadata ->> 'source' = 'recurring_service'
    and j.source_metadata ->> 'recurring_service_plan_id' = j.recurring_service_plan_id;

  -- Any plan-shaped row without exact provenance is untracked and blocks cleanup.
  select v_untracked + count(*) into v_untracked
  from public.recurring_service_plans p
  where p.id like 'PLAN-' || v_token || '\_%' escape '\'
    and not p.id = any(v_plan_ids);

  -- Every occurrence for an exact plan must point to an exact generated job or be null.
  select v_untracked + count(*) into v_untracked
  from public.recurring_service_occurrences o
  where o.recurring_service_plan_id = any(v_plan_ids)
    and o.job_id is not null
    and not o.job_id = any(v_job_ids);

  -- Generated jobs must retain the exact recurring provenance.
  select v_untracked + count(*) into v_untracked
  from public.jobs j
  where j.recurring_service_plan_id = any(v_plan_ids)
    and not (
      j.recurring_occurrence_date is not null
      and j.source_metadata ->> 'source' = 'recurring_service'
      and j.source_metadata ->> 'recurring_service_plan_id' = j.recurring_service_plan_id
    );

  -- Never delete a generated job referenced by an invoice or service request.
  select count(*) into v_external_refs
  from public.invoices i
  where i.job_id = any(v_job_ids);
  select v_external_refs + count(*) into v_external_refs
  from public.client_service_requests r
  where r.approved_job_id = any(v_job_ids);

  -- N4 must have no financial side effects. Any invoice/payment relation blocks cleanup.
  select count(*) into v_financial_refs
  from public.invoices i
  where i.job_id = any(v_job_ids)
     or i.client_id = any(v_synthetic_client_ids)
     or i.property_id = any(v_synthetic_property_ids);
  select v_financial_refs + count(*) into v_financial_refs
  from public.payments pay
  join public.invoices i on i.id = pay.invoice_id
  where i.client_id = any(v_synthetic_client_ids)
     or i.property_id = any(v_synthetic_property_ids);

  -- Synthetic roots are removable only when the run owns all of their children.
  select v_untracked + count(*) into v_untracked
  from public.properties p
  where p.client_id = any(v_synthetic_client_ids)
    and not p.id = any(v_synthetic_property_ids);
  select v_untracked + count(*) into v_untracked
  from public.jobs j
  where j.client_id = any(v_synthetic_client_ids)
    and not j.id = any(v_job_ids);
  select v_untracked + count(*) into v_untracked
  from public.quotes q
  where q.client_id = any(v_synthetic_client_ids);
  select v_untracked + count(*) into v_untracked
  from public.recurring_invoice_plans r
  where r.client_id = any(v_synthetic_client_ids);
  select v_untracked + count(*) into v_untracked
  from public.client_service_requests r
  where r.client_id = any(v_synthetic_client_ids)
    and not r.approved_job_id = any(v_job_ids);

  -- An exact synthetic root with unexpected identity is a real-record match.
  select v_real_matches + count(*) into v_real_matches
  from public.clients c
  where c.id = any(v_synthetic_client_ids)
    and (c.full_name <> 'CLIENT-' || v_token || '-ROOT' or c.email <> v_run_id || '@qa.invalid');
  select v_real_matches + count(*) into v_real_matches
  from public.properties p
  where p.id = any(v_synthetic_property_ids)
    and (p.name <> 'PROPERTY-' || v_token || '-ROOT' or p.notes <> v_token);

  return jsonb_build_object(
    'run_id', v_run_id,
    'namespace', v_token,
    'clients', cardinality(v_client_ids),
    'client_ids', to_jsonb(v_client_ids),
    'properties', cardinality(v_property_ids),
    'property_ids', to_jsonb(v_property_ids),
    'plans', cardinality(v_plan_ids),
    'plan_ids', to_jsonb(v_plan_ids),
    'slots', (select count(*) from public.recurring_service_plan_slots where recurring_service_plan_id = any(v_plan_ids)),
    'occurrences', (select count(*) from public.recurring_service_occurrences where recurring_service_plan_id = any(v_plan_ids)),
    'jobs', cardinality(v_job_ids),
    'job_ids', to_jsonb(v_job_ids),
    'job_lines', (select count(*) from public.job_lines where job_id = any(v_job_ids)),
    'untracked_relations', v_untracked,
    'real_record_matches', v_real_matches,
    'generated_job_external_references', v_external_refs,
    'financial_references', v_financial_refs,
    'external_qa_roots_preserved', true,
    'safe_to_clean', v_untracked = 0 and v_real_matches = 0 and v_external_refs = 0 and v_financial_refs = 0
  );
end;
$function$;

create or replace function public.qa_n4_func_teardown(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run_id text := lower(nullif(trim(p_run_id), ''));
  v_token text;
  v_plan jsonb;
  v_plan_ids text[] := '{}'::text[];
  v_client_ids text[] := '{}'::text[];
  v_property_ids text[] := '{}'::text[];
  v_synthetic_client_ids text[] := '{}'::text[];
  v_synthetic_property_ids text[] := '{}'::text[];
  v_job_ids text[] := '{}'::text[];
  v_deleted jsonb := '{}'::jsonb;
  v_count bigint;
begin
  perform app_private.require_active_internal_staff();
  v_plan := public.qa_n4_func_teardown_plan(v_run_id);
  if coalesce((v_plan ->> 'safe_to_clean')::boolean, false) is not true then
    raise exception 'N4 teardown refused: untracked relations, external references, or financial side effects detected.' using errcode = '55000';
  end if;

  v_token := 'QA_N4_FUNC_' || v_run_id;
  select coalesce(array_agg(value), '{}'::text[]) into v_plan_ids
    from jsonb_array_elements_text(v_plan -> 'plan_ids') as x(value);
  select coalesce(array_agg(value), '{}'::text[]) into v_client_ids
    from jsonb_array_elements_text(v_plan -> 'client_ids') as x(value);
  select coalesce(array_agg(value), '{}'::text[]) into v_property_ids
    from jsonb_array_elements_text(v_plan -> 'property_ids') as x(value);
  select coalesce(array_agg(value), '{}'::text[]) into v_job_ids
    from jsonb_array_elements_text(v_plan -> 'job_ids') as x(value);
  select coalesce(array_agg(c.id), '{}'::text[]) into v_synthetic_client_ids
    from public.clients c
   where c.full_name = 'CLIENT-' || v_token || '-ROOT'
     and c.email = v_run_id || '@qa.invalid';
  select coalesce(array_agg(p.id), '{}'::text[]) into v_synthetic_property_ids
    from public.properties p
   where p.name = 'PROPERTY-' || v_token || '-ROOT'
     and p.notes = v_token;

  delete from public.job_lines where job_id = any(v_job_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('job_lines', v_count);

  delete from public.recurring_service_occurrences where recurring_service_plan_id = any(v_plan_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('occurrences', v_count);

  delete from public.jobs where id = any(v_job_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('jobs', v_count);

  delete from public.recurring_service_plan_slots where recurring_service_plan_id = any(v_plan_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('slots', v_count);

  delete from public.recurring_service_plans where id = any(v_plan_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('plans', v_count);

  delete from public.properties where id = any(v_synthetic_property_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('properties', v_count);

  delete from public.clients where id = any(v_synthetic_client_ids);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('clients', v_count);

  return jsonb_build_object('run_id', v_run_id, 'deleted', v_deleted, 'plan', v_plan);
end;
$function$;

alter function public.qa_n4_func_teardown_plan(text) owner to postgres;
alter function public.qa_n4_func_teardown(text) owner to postgres;
revoke all on function public.qa_n4_func_teardown_plan(text) from public, anon, authenticated;
revoke all on function public.qa_n4_func_teardown(text) from public, anon, authenticated;
grant execute on function public.qa_n4_func_teardown_plan(text) to authenticated;
grant execute on function public.qa_n4_func_teardown(text) to authenticated;

comment on function public.qa_n4_func_teardown_plan(text) is
  'QA-only read-only exact planner for one QA_N4_FUNC run; fails closed on external or financial relations.';
comment on function public.qa_n4_func_teardown(text) is
  'QA-only exact N4 teardown. Never use for Production or real QA data.';

commit;
