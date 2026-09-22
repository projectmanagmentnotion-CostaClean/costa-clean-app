begin;

create or replace function app_private.is_n11_hygiene_fixture_id(p_entity_id text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p_entity_id is not null
     and pg_catalog.left(p_entity_id, pg_catalog.length('QA_HYGIENE_N11_')) = 'QA_HYGIENE_N11_'
$function$;
alter function app_private.is_n11_hygiene_fixture_id(text) owner to postgres;
revoke all on function app_private.is_n11_hygiene_fixture_id(text) from public, anon, authenticated, service_role;

create table app_private.data_hygiene_runs (
  plan_id uuid primary key,
  plan_hash text not null check (plan_hash ~ '^[a-f0-9]{64}$'),
  performed_by uuid not null references auth.users(id) on delete restrict,
  performed_at timestamptz not null default clock_timestamp(),
  relink_count integer not null default 0 check (relink_count >= 0),
  archive_count integer not null default 0 check (archive_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  result text not null check (result in ('applied', 'already_applied'))
);

create table app_private.data_hygiene_actions (
  plan_id uuid not null references app_private.data_hygiene_runs(plan_id) on delete restrict,
  action_id text not null,
  entity_type text not null check (entity_type = 'quote'),
  entity_id text not null check (app_private.is_n11_hygiene_fixture_id(entity_id)),
  action_type text not null check (action_type in ('RELINK_RELATION', 'ARCHIVE_STALE_RECORD', 'MANUAL_REVIEW_REQUIRED')),
  old_state jsonb not null,
  new_state jsonb not null,
  classification text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  performed_by uuid not null references auth.users(id) on delete restrict,
  performed_at timestamptz not null default clock_timestamp(),
  result text not null check (result in ('applied', 'manual_review_required')),
  primary key (plan_id, action_id)
);

alter table app_private.data_hygiene_runs enable row level security;
alter table app_private.data_hygiene_runs force row level security;
alter table app_private.data_hygiene_actions enable row level security;
alter table app_private.data_hygiene_actions force row level security;
revoke all on table app_private.data_hygiene_runs from public, anon, authenticated, service_role;
revoke all on table app_private.data_hygiene_actions from public, anon, authenticated, service_role;

create or replace function app_private.require_qa_environment()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_issuer text := auth.jwt() ->> 'iss';
begin
  if v_issuer is distinct from 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'This operation is available only in the CostaClean QA project.' using errcode = '42501';
  end if;
end;
$function$;

create or replace function app_private.build_data_hygiene_n11_plan()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan_id uuid := pg_catalog.gen_random_uuid();
  v_generated_at timestamptz := clock_timestamp();
  v_actions jsonb := '[]'::jsonb;
  v_quote record;
  v_expected jsonb;
begin
  for v_quote in
    select q.id, q.client_id, q.property_id, q.status, q.archived_at, q.deleted_at, q.updated_at,
           p.client_id as canonical_client_id
      from public.quotes as q
      join public.properties as p on p.id = q.property_id
     where pg_catalog.left(q.id, pg_catalog.length('QA_HYGIENE_N11_RELINK_')) = 'QA_HYGIENE_N11_RELINK_'
       and q.status = 'draft'
       and q.archived_at is null
       and q.deleted_at is null
       and q.client_id is distinct from p.client_id
       and not exists (select 1 from public.jobs as j where j.quote_id = q.id)
       and not exists (select 1 from public.invoices as i where i.quote_id = q.id)
       and not exists (select 1 from public.client_service_requests as r where r.quote_id = q.id)
       and not exists (select 1 from public.recurring_invoice_plans as plan where plan.quote_id = q.id)
     order by q.id
  loop
    v_expected := pg_catalog.jsonb_build_object(
      'client_id', v_quote.client_id,
      'property_id', v_quote.property_id,
      'status', v_quote.status,
      'archived_at', v_quote.archived_at,
      'deleted_at', v_quote.deleted_at,
      'updated_at', v_quote.updated_at
    );
    v_actions := v_actions || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'action_id', 'relink_quote:' || v_quote.id,
      'entity_type', 'quote',
      'entity_id', v_quote.id,
      'action_type', 'RELINK_RELATION',
      'expected_current_state', v_expected,
      'target_state', pg_catalog.jsonb_build_object('client_id', v_quote.canonical_client_id),
      'classification', 'DETERMINISTIC_PROPERTY_CLIENT_MISMATCH',
      'reason', 'Draft quote client differs from the client that owns its referenced property.',
      'evidence', pg_catalog.jsonb_build_object('property_client_id', v_quote.canonical_client_id)
    ));
  end loop;

  for v_quote in
    select q.id, q.client_id, q.property_id, q.status, q.archived_at, q.deleted_at, q.updated_at
      from public.quotes as q
     where pg_catalog.left(q.id, pg_catalog.length('QA_HYGIENE_N11_ARCHIVE_')) = 'QA_HYGIENE_N11_ARCHIVE_'
       and q.status = 'draft'
       and q.archived_at is null
       and q.deleted_at is null
       and not exists (select 1 from public.jobs as j where j.quote_id = q.id)
       and not exists (select 1 from public.invoices as i where i.quote_id = q.id)
       and not exists (select 1 from public.client_service_requests as r where r.quote_id = q.id)
       and not exists (select 1 from public.recurring_invoice_plans as plan where plan.quote_id = q.id)
     order by q.id
  loop
    v_expected := pg_catalog.jsonb_build_object(
      'client_id', v_quote.client_id,
      'property_id', v_quote.property_id,
      'status', v_quote.status,
      'archived_at', v_quote.archived_at,
      'deleted_at', v_quote.deleted_at,
      'updated_at', v_quote.updated_at
    );
    v_actions := v_actions || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'action_id', 'archive_quote:' || v_quote.id,
      'entity_type', 'quote',
      'entity_id', v_quote.id,
      'action_type', 'ARCHIVE_STALE_RECORD',
      'expected_current_state', v_expected,
      'target_state', pg_catalog.jsonb_build_object('archived_at', v_generated_at),
      'classification', 'SYNTHETIC_STALE_NON_FISCAL_DRAFT',
      'reason', 'Synthetic draft quote has no downstream operational or invoice dependency.',
      'evidence', pg_catalog.jsonb_build_object(
        'downstream_jobs', 0, 'downstream_invoices', 0,
        'downstream_service_requests', 0, 'recurring_plans', 0,
        'status', v_quote.status
      )
    ));
  end loop;

  for v_quote in
    select q.id, q.client_id, q.property_id, q.status, q.archived_at, q.deleted_at, q.updated_at
      from public.quotes as q
     where pg_catalog.left(q.id, pg_catalog.length('QA_HYGIENE_N11_AMBIGUOUS_')) = 'QA_HYGIENE_N11_AMBIGUOUS_'
       and q.status = 'draft'
       and q.archived_at is null
       and q.deleted_at is null
     order by q.id
  loop
    v_expected := pg_catalog.jsonb_build_object(
      'client_id', v_quote.client_id,
      'property_id', v_quote.property_id,
      'status', v_quote.status,
      'archived_at', v_quote.archived_at,
      'deleted_at', v_quote.deleted_at,
      'updated_at', v_quote.updated_at
    );
    v_actions := v_actions || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'action_id', 'review_quote:' || v_quote.id,
      'entity_type', 'quote',
      'entity_id', v_quote.id,
      'action_type', 'MANUAL_REVIEW_REQUIRED',
      'expected_current_state', v_expected,
      'target_state', v_expected,
      'classification', 'INSUFFICIENT_CANONICAL_RELATION_EVIDENCE',
      'reason', 'No deterministic property-client evidence authorizes an automatic relation change.',
      'evidence', pg_catalog.jsonb_build_object('property_id_present', v_quote.property_id is not null)
    ));
  end loop;

  return pg_catalog.jsonb_build_object(
    'plan_id', v_plan_id,
    'generated_at', v_generated_at,
    'source', 'data_hygiene_n11',
    'actions', v_actions
  );
end;
$function$;

create or replace function public.data_hygiene_n11_dry_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan jsonb;
  v_hash text;
begin
  perform app_private.require_active_internal_staff();
  perform app_private.require_qa_environment();
  v_plan := app_private.build_data_hygiene_n11_plan();
  v_hash := pg_catalog.encode(extensions.digest(v_plan::text, 'sha256'), 'hex');
  return pg_catalog.jsonb_build_object('plan', v_plan, 'plan_hash', v_hash);
end;
$function$;

create or replace function public.data_hygiene_n11_apply_qa(p_plan jsonb, p_plan_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_hash text;
  v_plan_id uuid;
  v_generated_at timestamptz;
  v_action jsonb;
  v_action_id text;
  v_entity_id text;
  v_action_type text;
  v_expected jsonb;
  v_target jsonb;
  v_current jsonb;
  v_new jsonb;
  v_canonical_client_id text;
  v_existing_hash text;
  v_relinks integer := 0;
  v_archives integer := 0;
  v_reviews integer := 0;
  v_inserted_plan_id uuid;
begin
  v_actor := app_private.require_internal_staff_write();
  perform app_private.require_qa_environment();

  if p_plan is null
     or pg_catalog.jsonb_typeof(p_plan) <> 'object'
     or p_plan ->> 'source' is distinct from 'data_hygiene_n11'
     or pg_catalog.jsonb_typeof(p_plan -> 'actions') <> 'array'
     or (select count(*) from pg_catalog.jsonb_object_keys(p_plan) as plan_key) <> 4
     or pg_catalog.jsonb_array_length(p_plan -> 'actions') > 100 then
    raise exception 'Invalid data hygiene plan contract.' using errcode = '22023';
  end if;

  begin
    v_plan_id := (p_plan ->> 'plan_id')::uuid;
    v_generated_at := (p_plan ->> 'generated_at')::timestamptz;
  exception when others then
    raise exception 'Invalid plan identifier or generation timestamp.' using errcode = '22023';
  end;
  if v_plan_id is null or v_generated_at is null then
    raise exception 'Plan identifier and generation timestamp are required.' using errcode = '22023';
  end if;

  v_hash := pg_catalog.encode(extensions.digest(p_plan::text, 'sha256'), 'hex');
  if p_plan_hash is distinct from v_hash then
    raise exception 'Plan hash does not match canonical plan content.' using errcode = '22023';
  end if;

  select run.plan_hash into v_existing_hash
    from app_private.data_hygiene_runs as run
   where run.plan_id = v_plan_id;
  if found then
    if v_existing_hash is distinct from v_hash then
      raise exception 'Plan identifier was previously used with different content.' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'status', 'already_applied', 'plan_id', v_plan_id,
      'relinks', 0, 'archives', 0, 'manual_reviews', 0
    );
  end if;

  insert into app_private.data_hygiene_runs(plan_id, plan_hash, performed_by, result)
  values (v_plan_id, v_hash, v_actor, 'applied')
  on conflict (plan_id) do nothing
  returning plan_id into v_inserted_plan_id;
  if v_inserted_plan_id is null then
    select run.plan_hash into v_existing_hash
      from app_private.data_hygiene_runs as run
     where run.plan_id = v_plan_id;
    if v_existing_hash = v_hash then
      return pg_catalog.jsonb_build_object(
        'status', 'already_applied', 'plan_id', v_plan_id,
        'relinks', 0, 'archives', 0, 'manual_reviews', 0
      );
    end if;
    raise exception 'Plan identifier was concurrently claimed by different content.' using errcode = '22023';
  end if;

  for v_action in select value from pg_catalog.jsonb_array_elements(p_plan -> 'actions') as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_action) <> 'object'
       or (select count(*) from pg_catalog.jsonb_object_keys(v_action) as action_key) <> 9
       or not (v_action ?& array['action_id','entity_type','entity_id','action_type','expected_current_state','target_state','classification','reason','evidence']) then
      raise exception 'Plan action fields do not match the allowlisted contract.' using errcode = '22023';
    end if;

    v_action_id := v_action ->> 'action_id';
    v_entity_id := v_action ->> 'entity_id';
    v_action_type := v_action ->> 'action_type';
    v_expected := v_action -> 'expected_current_state';
    v_target := v_action -> 'target_state';

    if v_action ->> 'entity_type' is distinct from 'quote'
       or v_entity_id is null
       or not app_private.is_n11_hygiene_fixture_id(v_entity_id)
       or v_action_id is null
       or v_action_type is null
       or v_action_type not in ('RELINK_RELATION','ARCHIVE_STALE_RECORD','MANUAL_REVIEW_REQUIRED')
       or pg_catalog.jsonb_typeof(v_expected) <> 'object'
       or pg_catalog.jsonb_typeof(v_target) <> 'object'
       or pg_catalog.jsonb_typeof(v_action -> 'evidence') <> 'object' then
      raise exception 'Plan action exceeds the quote-only QA allowlist.' using errcode = '22023';
    end if;

    select pg_catalog.jsonb_build_object(
      'client_id', q.client_id,
      'property_id', q.property_id,
      'status', q.status,
      'archived_at', q.archived_at,
      'deleted_at', q.deleted_at,
      'updated_at', q.updated_at
    )
      into v_current
      from public.quotes as q
     where q.id = v_entity_id
       and app_private.is_n11_hygiene_fixture_id(q.id)
     for update;
    if not found or v_current is distinct from v_expected then
      raise exception 'Plan target is missing or its current state is stale.' using errcode = '40001';
    end if;

    if v_action_type = 'RELINK_RELATION' then
      select p.client_id into v_canonical_client_id
        from public.quotes as q
        join public.properties as p on p.id = q.property_id
       where q.id = v_entity_id;
      if pg_catalog.left(v_entity_id, pg_catalog.length('QA_HYGIENE_N11_RELINK_')) <> 'QA_HYGIENE_N11_RELINK_'
         or v_action_id is distinct from 'relink_quote:' || v_entity_id
         or v_current ->> 'status' <> 'draft'
         or v_current -> 'archived_at' <> 'null'::jsonb
         or v_current -> 'deleted_at' <> 'null'::jsonb
         or v_canonical_client_id is null
         or v_canonical_client_id is not distinct from v_current ->> 'client_id'
         or v_target is distinct from pg_catalog.jsonb_build_object('client_id', v_canonical_client_id)
         or v_action ->> 'classification' is distinct from 'DETERMINISTIC_PROPERTY_CLIENT_MISMATCH'
         or v_action ->> 'reason' is distinct from 'Draft quote client differs from the client that owns its referenced property.'
         or v_action -> 'evidence' is distinct from pg_catalog.jsonb_build_object('property_client_id', v_canonical_client_id)
         or exists (select 1 from public.jobs as j where j.quote_id = v_entity_id)
         or exists (select 1 from public.invoices as i where i.quote_id = v_entity_id)
         or exists (select 1 from public.client_service_requests as r where r.quote_id = v_entity_id)
         or exists (select 1 from public.recurring_invoice_plans as plan where plan.quote_id = v_entity_id) then
        raise exception 'Relink action failed deterministic relation-safety checks.' using errcode = '22023';
      end if;
      update public.quotes
         set client_id = v_canonical_client_id,
             updated_at = clock_timestamp()
       where id = v_entity_id;
      v_relinks := v_relinks + 1;
      v_new := pg_catalog.jsonb_build_object('client_id', v_canonical_client_id);

    elsif v_action_type = 'ARCHIVE_STALE_RECORD' then
      if pg_catalog.left(v_entity_id, pg_catalog.length('QA_HYGIENE_N11_ARCHIVE_')) <> 'QA_HYGIENE_N11_ARCHIVE_'
         or v_action_id is distinct from 'archive_quote:' || v_entity_id
         or v_current ->> 'status' <> 'draft'
         or v_current -> 'archived_at' <> 'null'::jsonb
         or v_current -> 'deleted_at' <> 'null'::jsonb
         or v_target is distinct from pg_catalog.jsonb_build_object('archived_at', v_generated_at)
         or v_action ->> 'classification' is distinct from 'SYNTHETIC_STALE_NON_FISCAL_DRAFT'
         or v_action ->> 'reason' is distinct from 'Synthetic draft quote has no downstream operational or invoice dependency.'
         or v_action -> 'evidence' is distinct from pg_catalog.jsonb_build_object(
           'downstream_jobs', 0, 'downstream_invoices', 0,
           'downstream_service_requests', 0, 'recurring_plans', 0,
           'status', v_current ->> 'status'
         )
         or exists (select 1 from public.jobs as j where j.quote_id = v_entity_id)
         or exists (select 1 from public.invoices as i where i.quote_id = v_entity_id)
         or exists (select 1 from public.client_service_requests as r where r.quote_id = v_entity_id)
         or exists (select 1 from public.recurring_invoice_plans as plan where plan.quote_id = v_entity_id) then
        raise exception 'Archive action failed non-fiscal draft safety checks.' using errcode = '22023';
      end if;
      update public.quotes
         set archived_at = v_generated_at,
             updated_at = clock_timestamp()
       where id = v_entity_id;
      v_archives := v_archives + 1;
      v_new := pg_catalog.jsonb_build_object('archived_at', v_generated_at);

    else
      if pg_catalog.left(v_entity_id, pg_catalog.length('QA_HYGIENE_N11_AMBIGUOUS_')) <> 'QA_HYGIENE_N11_AMBIGUOUS_'
         or v_action_id is distinct from 'review_quote:' || v_entity_id
         or v_current ->> 'status' <> 'draft'
         or v_current -> 'property_id' <> 'null'::jsonb
         or v_current -> 'archived_at' <> 'null'::jsonb
         or v_current -> 'deleted_at' <> 'null'::jsonb
         or v_target is distinct from v_expected
         or v_action ->> 'classification' is distinct from 'INSUFFICIENT_CANONICAL_RELATION_EVIDENCE' then
        raise exception 'Manual-review action must not mutate state.' using errcode = '22023';
      end if;
      v_reviews := v_reviews + 1;
      v_new := v_current;
    end if;

    insert into app_private.data_hygiene_actions(
      plan_id, action_id, entity_type, entity_id, action_type,
      old_state, new_state, classification, reason, evidence,
      performed_by, result
    ) values (
      v_plan_id, v_action_id, 'quote', v_entity_id, v_action_type,
      v_current, v_new, v_action ->> 'classification', v_action ->> 'reason', v_action -> 'evidence',
      v_actor, case when v_action_type = 'MANUAL_REVIEW_REQUIRED' then 'manual_review_required' else 'applied' end
    );
  end loop;

  update app_private.data_hygiene_runs
     set relink_count = v_relinks,
         archive_count = v_archives,
         review_count = v_reviews
   where plan_id = v_plan_id;

  return pg_catalog.jsonb_build_object(
    'status', 'applied', 'plan_id', v_plan_id,
    'relinks', v_relinks, 'archives', v_archives, 'manual_reviews', v_reviews
  );
end;
$function$;

alter function app_private.require_qa_environment() owner to postgres;
alter function app_private.build_data_hygiene_n11_plan() owner to postgres;
alter function public.data_hygiene_n11_dry_run() owner to postgres;
alter function public.data_hygiene_n11_apply_qa(jsonb, text) owner to postgres;

revoke all on function app_private.require_qa_environment() from public, anon, authenticated, service_role;
revoke all on function app_private.build_data_hygiene_n11_plan() from public, anon, authenticated, service_role;
revoke all on function public.data_hygiene_n11_dry_run() from public, anon, authenticated, service_role;
revoke all on function public.data_hygiene_n11_apply_qa(jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.data_hygiene_n11_dry_run() to authenticated;
grant execute on function public.data_hygiene_n11_apply_qa(jsonb, text) to authenticated;

commit;
