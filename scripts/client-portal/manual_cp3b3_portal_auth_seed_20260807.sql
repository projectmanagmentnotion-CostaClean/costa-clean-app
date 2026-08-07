begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

do $$
declare
  v_run_id constant text := 'CP3B3-PORTAL-AUTH-20260807';
  v_run_fixture_prefix constant text := 'CP3B3-PORTAL-AUTH-20260807-';
  v_user_a_id constant uuid := '93b1f5f1-ca54-4b5d-8209-a883788c8352';
  v_user_b_id constant uuid := '50466c12-4ce5-4351-9050-e23f475b6cfe';
  v_user_a_email constant text := 'qa.client.cp3b3.73125246@qa.invalid';
  v_user_b_email constant text := 'qa.client.cp3b3.b9a2330a@qa.invalid';
  v_client_a_id constant text := 'CP3B3-PORTAL-AUTH-20260807-CLIENT-A';
  v_client_b_id constant text := 'CP3B3-PORTAL-AUTH-20260807-CLIENT-B';
  v_property_a_id constant text := 'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A';
  v_property_b_id constant text := 'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B';
  v_job_a_past_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST';
  v_job_a_future_1_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1';
  v_job_a_future_2_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2';
  v_job_b_future_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE';
  v_seed_started_at timestamptz := clock_timestamp();
  v_count integer;
  v_client_a_display_code text;
  v_client_b_display_code text;
  v_property_a_display_code text;
  v_property_b_display_code text;
  v_job_a_past_reference text;
  v_job_a_future_1_reference text;
  v_job_a_future_2_reference text;
  v_job_b_future_reference text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name in ('id', 'email', 'email_confirmed_at')
    group by table_name
    having count(*) = 3
  ) then
    raise exception 'auth_users_structure_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_portal_memberships'
      and column_name in ('id', 'user_id', 'client_id', 'role', 'status', 'created_at', 'updated_at', 'revoked_at')
    group by table_name
    having count(*) = 8
  ) then
    raise exception 'membership_structure_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name in ('id', 'full_name', 'email', 'status', 'display_code', 'created_at', 'updated_at')
    group by table_name
    having count(*) = 7
  ) then
    raise exception 'clients_structure_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'properties'
      and column_name in ('id', 'client_id', 'name', 'property_type', 'address', 'city', 'postal_code', 'status', 'display_code', 'created_at', 'updated_at')
    group by table_name
    having count(*) = 11
  ) then
    raise exception 'properties_structure_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name in (
        'id', 'client_id', 'property_id', 'scheduled_date', 'status', 'service_type',
        'billing_quantity', 'billing_unit', 'display_code', 'public_reference', 'created_at', 'updated_at'
      )
    group by table_name
    having count(*) = 12
  ) then
    raise exception 'jobs_structure_missing' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from auth.users as u
    where u.id = v_user_a_id
      and u.email = v_user_a_email
      and u.email_confirmed_at is not null
  ) then
    raise exception 'user_a_missing_or_unverified' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from auth.users as u
    where u.id = v_user_b_id
      and u.email = v_user_b_email
      and u.email_confirmed_at is not null
  ) then
    raise exception 'user_b_missing_or_unverified' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.client_portal_memberships as m
    where m.client_id in (v_client_a_id, v_client_b_id)
  ) then
    raise exception 'existing_memberships_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.clients
    where id in (v_client_a_id, v_client_b_id)
  ) then
    raise exception 'existing_client_fixture_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.properties
    where id in (v_property_a_id, v_property_b_id)
  ) then
    raise exception 'existing_property_fixture_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.jobs
    where id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id)
  ) then
    raise exception 'existing_job_fixture_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.clients
    where id like v_run_fixture_prefix || '%'
  ) or exists (
    select 1
    from public.properties
    where id like v_run_fixture_prefix || '%'
  ) or exists (
    select 1
    from public.jobs
    where id like v_run_fixture_prefix || '%'
  ) or exists (
    select 1
    from public.client_portal_memberships
    where client_id in (v_client_a_id, v_client_b_id)
  ) or exists (
    select 1
    from public.client_service_requests
    where client_id in (v_client_a_id, v_client_b_id)
  ) or exists (
    select 1
    from public.quotes
    where client_id in (v_client_a_id, v_client_b_id)
  ) or exists (
    select 1
    from public.invoices
    where client_id in (v_client_a_id, v_client_b_id)
  ) or exists (
    select 1
    from public.payments as p
    join public.invoices as i on i.id = p.invoice_id
    where i.client_id in (v_client_a_id, v_client_b_id)
  ) or exists (
    select 1
    from public.job_lines as jl
    join public.jobs as j on j.id = jl.job_id
    where j.client_id in (v_client_a_id, v_client_b_id)
  ) then
    raise exception 'run_fixture_residue_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.client_service_requests
    where requested_by in (v_user_a_id, v_user_b_id)
       or client_id in (v_client_a_id, v_client_b_id)
  ) then
    raise exception 'unexpected_existing_service_request_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.quotes
    where client_id in (v_client_a_id, v_client_b_id)
       or property_id in (v_property_a_id, v_property_b_id)
  ) then
    raise exception 'unexpected_existing_quote_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.invoices
    where client_id in (v_client_a_id, v_client_b_id)
       or property_id in (v_property_a_id, v_property_b_id)
       or job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id)
  ) then
    raise exception 'unexpected_existing_invoice_present' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.payments as p
    join public.invoices as i on i.id = p.invoice_id
    where i.client_id in (v_client_a_id, v_client_b_id)
       or i.property_id in (v_property_a_id, v_property_b_id)
       or i.job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id)
  ) then
    raise exception 'unexpected_existing_payment_present' using errcode = 'P0001';
  end if;

  insert into public.clients (
    id,
    full_name,
    email,
    status
  ) values (
    v_client_a_id,
    'QA CP3B3 Client A',
    v_user_a_email,
    'active'
  ) returning display_code into v_client_a_display_code;

  insert into public.clients (
    id,
    full_name,
    email,
    status
  ) values (
    v_client_b_id,
    'QA CP3B3 Client B',
    v_user_b_email,
    'active'
  ) returning display_code into v_client_b_display_code;

  insert into public.properties (
    id,
    client_id,
    name,
    property_type,
    address,
    city,
    postal_code,
    status
  ) values (
    v_property_a_id,
    v_client_a_id,
    'QA CP3B3 Property A',
    'apartment',
    'Synthetic CP3B3 Address A',
    'Barcelona',
    '08001',
    'active'
  ) returning display_code into v_property_a_display_code;

  insert into public.properties (
    id,
    client_id,
    name,
    property_type,
    address,
    city,
    postal_code,
    status
  ) values (
    v_property_b_id,
    v_client_b_id,
    'QA CP3B3 Property B',
    'apartment',
    'Synthetic CP3B3 Address B',
    'Barcelona',
    '08002',
    'active'
  ) returning display_code into v_property_b_display_code;

  insert into public.client_portal_memberships (
    id,
    user_id,
    client_id,
    role,
    status
  ) values (
    gen_random_uuid(),
    v_user_a_id,
    v_client_a_id,
    'client_admin',
    'active'
  );

  insert into public.client_portal_memberships (
    id,
    user_id,
    client_id,
    role,
    status
  ) values (
    gen_random_uuid(),
    v_user_b_id,
    v_client_b_id,
    'client_admin',
    'active'
  );

  insert into public.jobs (
    id,
    client_id,
    property_id,
    scheduled_date,
    status,
    service_type,
    notes
  ) values (
    v_job_a_past_id,
    v_client_a_id,
    v_property_a_id,
    current_date - 7,
    'completed',
    'regular_cleaning',
    'Synthetic CP3B3 service A past'
  ) returning public_reference into v_job_a_past_reference;

  insert into public.jobs (
    id,
    client_id,
    property_id,
    scheduled_date,
    status,
    service_type,
    notes
  ) values (
    v_job_a_future_1_id,
    v_client_a_id,
    v_property_a_id,
    current_date + 1,
    'scheduled',
    'regular_cleaning',
    'Synthetic CP3B3 service A future 1'
  ) returning public_reference into v_job_a_future_1_reference;

  insert into public.jobs (
    id,
    client_id,
    property_id,
    scheduled_date,
    status,
    service_type,
    notes
  ) values (
    v_job_a_future_2_id,
    v_client_a_id,
    v_property_a_id,
    current_date + 8,
    'scheduled',
    'deep_cleaning',
    'Synthetic CP3B3 service A future 2'
  ) returning public_reference into v_job_a_future_2_reference;

  insert into public.jobs (
    id,
    client_id,
    property_id,
    scheduled_date,
    status,
    service_type,
    notes
  ) values (
    v_job_b_future_id,
    v_client_b_id,
    v_property_b_id,
    current_date + 3,
    'scheduled',
    'regular_cleaning',
    'Synthetic CP3B3 service B future'
  ) returning public_reference into v_job_b_future_reference;

  if v_client_a_display_code is null or v_client_a_display_code !~ '^CLI-[0-9]{4}$' then
    raise exception 'client_a_display_code_invalid' using errcode = 'P0001';
  end if;

  if v_client_b_display_code is null or v_client_b_display_code !~ '^CLI-[0-9]{4}$' then
    raise exception 'client_b_display_code_invalid' using errcode = 'P0001';
  end if;

  if v_property_a_display_code is null or v_property_a_display_code !~ '^PRO-[0-9]{4}$' then
    raise exception 'property_a_display_code_invalid' using errcode = 'P0001';
  end if;

  if v_property_b_display_code is null or v_property_b_display_code !~ '^PRO-[0-9]{4}$' then
    raise exception 'property_b_display_code_invalid' using errcode = 'P0001';
  end if;

  if v_job_a_past_reference is null
    or v_job_a_future_1_reference is null
    or v_job_a_future_2_reference is null
    or v_job_b_future_reference is null
  then
    raise exception 'job_public_reference_missing' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from (
      values
        (v_job_a_past_reference),
        (v_job_a_future_1_reference),
        (v_job_a_future_2_reference),
        (v_job_b_future_reference)
    ) as refs(reference)
    where reference !~ '^CC-SV-[0-9A-F]{24}$'
  ) then
    raise exception 'job_public_reference_invalid' using errcode = 'P0001';
  end if;

  select count(distinct reference) into v_count
  from (
    values
      (v_job_a_past_reference),
      (v_job_a_future_1_reference),
      (v_job_a_future_2_reference),
      (v_job_b_future_reference)
  ) as refs(reference);
  if v_count <> 4 then
    raise exception 'job_public_reference_collision' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from auth.users
  where id in (v_user_a_id, v_user_b_id)
    and email_confirmed_at is not null;
  if v_count <> 2 then
    raise exception 'auth_user_verification_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.clients
  where id in (v_client_a_id, v_client_b_id)
    and status = 'active';
  if v_count <> 2 then
    raise exception 'client_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.client_portal_memberships
  where user_id in (v_user_a_id, v_user_b_id)
    and client_id in (v_client_a_id, v_client_b_id)
    and role = 'client_admin'
    and status = 'active'
    and revoked_at is null;
  if v_count <> 2 then
    raise exception 'membership_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.properties
  where id in (v_property_a_id, v_property_b_id)
    and client_id in (v_client_a_id, v_client_b_id)
    and status = 'active'
    and archived_at is null
    and deleted_at is null;
  if v_count <> 2 then
    raise exception 'property_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.jobs
  where id in (
    v_job_a_past_id,
    v_job_a_future_1_id,
    v_job_a_future_2_id,
    v_job_b_future_id
  )
    and client_id in (v_client_a_id, v_client_b_id)
    and property_id in (v_property_a_id, v_property_b_id)
    and status in ('completed', 'scheduled')
    and service_type in ('regular_cleaning', 'deep_cleaning')
    and archived_at is null
    and deleted_at is null;
  if v_count <> 4 then
    raise exception 'job_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.job_lines
  where job_id in (
    v_job_a_past_id,
    v_job_a_future_1_id,
    v_job_a_future_2_id,
    v_job_b_future_id
  );
  if v_count <> 0 then
    raise exception 'unexpected_job_lines_present' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.client_service_requests
  where requested_by in (v_user_a_id, v_user_b_id)
     or client_id in (v_client_a_id, v_client_b_id);
  if v_count <> 0 then
    raise exception 'unexpected_service_requests_present' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.quotes
  where client_id in (v_client_a_id, v_client_b_id)
     or property_id in (v_property_a_id, v_property_b_id);
  if v_count <> 0 then
    raise exception 'unexpected_quotes_present' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.invoices
  where client_id in (v_client_a_id, v_client_b_id)
     or property_id in (v_property_a_id, v_property_b_id)
     or job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);
  if v_count <> 0 then
    raise exception 'unexpected_invoices_present' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.payments as p
  join public.invoices as i on i.id = p.invoice_id
  where i.client_id in (v_client_a_id, v_client_b_id)
     or i.property_id in (v_property_a_id, v_property_b_id)
     or i.job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);
  if v_count <> 0 then
    raise exception 'unexpected_payments_present' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from auth.users
  where id in (v_user_a_id, v_user_b_id)
    and created_at >= v_seed_started_at;
  if v_count <> 0 then
    raise exception 'auth_users_must_not_be_created_by_seed' using errcode = 'P0001';
  end if;
end;
$$;

commit;

select jsonb_build_object(
  'status', 'CP3B3_FIXTURE_SEED_COMMITTED',
  'clients', 2,
  'memberships', 2,
  'properties', 2,
  'jobs', 4,
  'service_requests', 0,
  'user_a_ready', true,
  'user_b_ready', true,
  'client_a_reference', (
    select display_code from public.clients where id = 'CP3B3-PORTAL-AUTH-20260807-CLIENT-A'
  ),
  'client_b_reference', (
    select display_code from public.clients where id = 'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
  ),
  'property_a_reference', (
    select display_code from public.properties where id = 'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A'
  ),
  'property_b_reference', (
    select display_code from public.properties where id = 'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
  ),
  'service_a_past_reference', (
    select public_reference from public.jobs where id = 'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST'
  ),
  'service_a_future_1_reference', (
    select public_reference from public.jobs where id = 'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1'
  ),
  'service_a_future_2_reference', (
    select public_reference from public.jobs where id = 'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2'
  ),
  'service_b_future_reference', (
    select public_reference from public.jobs where id = 'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE'
  )
)::text as cp3b3_portal_auth_seed_20260807;
