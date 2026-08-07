begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

do $$
declare
  v_run_fixture_prefix constant text := 'CP3B3-PORTAL-AUTH-20260807-';
  v_user_a_id constant uuid := '93b1f5f1-ca54-4b5d-8209-a883788c8352';
  v_user_b_id constant uuid := '50466c12-4ce5-4351-9050-e23f475b6cfe';
  v_client_a_id constant text := 'CP3B3-PORTAL-AUTH-20260807-CLIENT-A';
  v_client_b_id constant text := 'CP3B3-PORTAL-AUTH-20260807-CLIENT-B';
  v_property_a_id constant text := 'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A';
  v_property_b_id constant text := 'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B';
  v_job_a_past_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST';
  v_job_a_future_1_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1';
  v_job_a_future_2_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2';
  v_job_b_future_id constant text := 'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE';
  v_count integer;
begin
  if not exists (
    select 1
    from public.clients
    where id in (v_client_a_id, v_client_b_id)
  ) then
    raise exception 'client_fixtures_missing' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.properties
    where id in (v_property_a_id, v_property_b_id)
  ) then
    raise exception 'property_fixtures_missing' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.jobs
    where id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id)
  ) then
    raise exception 'job_fixtures_missing' using errcode = 'P0002';
  end if;

  select count(*) into v_count
  from public.clients
  where id like v_run_fixture_prefix || '%';
  if v_count <> 2 then
    raise exception 'client_run_fixture_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.properties
  where id like v_run_fixture_prefix || '%';
  if v_count <> 2 then
    raise exception 'property_run_fixture_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.jobs
  where id like v_run_fixture_prefix || '%';
  if v_count <> 4 then
    raise exception 'job_run_fixture_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.client_portal_memberships
  where client_id in (v_client_a_id, v_client_b_id);
  if v_count <> 2 then
    raise exception 'membership_run_fixture_count_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.job_lines
  where job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);
  if v_count <> 0 then
    raise exception 'unexpected_job_lines_block_cleanup' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.client_service_requests
  where requested_by in (v_user_a_id, v_user_b_id)
     or client_id in (v_client_a_id, v_client_b_id);
  if v_count <> 0 then
    raise exception 'unexpected_service_requests_block_cleanup' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.quotes
  where client_id in (v_client_a_id, v_client_b_id)
     or property_id in (v_property_a_id, v_property_b_id);
  if v_count <> 0 then
    raise exception 'unexpected_quotes_block_cleanup' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.invoices
  where client_id in (v_client_a_id, v_client_b_id)
     or property_id in (v_property_a_id, v_property_b_id)
     or job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);
  if v_count <> 0 then
    raise exception 'unexpected_invoices_block_cleanup' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.payments as p
  join public.invoices as i on i.id = p.invoice_id
  where i.client_id in (v_client_a_id, v_client_b_id)
     or i.property_id in (v_property_a_id, v_property_b_id)
     or i.job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);
  if v_count <> 0 then
    raise exception 'unexpected_payments_block_cleanup' using errcode = 'P0001';
  end if;

  delete from public.job_lines
  where job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);

  delete from public.payments
  where invoice_id in (
    select id
    from public.invoices
    where client_id in (v_client_a_id, v_client_b_id)
       or property_id in (v_property_a_id, v_property_b_id)
       or job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id)
  );

  delete from public.invoices
  where client_id in (v_client_a_id, v_client_b_id)
     or property_id in (v_property_a_id, v_property_b_id)
     or job_id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);

  delete from public.quotes
  where client_id in (v_client_a_id, v_client_b_id)
     or property_id in (v_property_a_id, v_property_b_id);

  delete from public.client_service_requests
  where requested_by in (v_user_a_id, v_user_b_id)
     or client_id in (v_client_a_id, v_client_b_id);

  delete from public.client_portal_memberships
  where user_id in (v_user_a_id, v_user_b_id)
     or client_id in (v_client_a_id, v_client_b_id);

  delete from public.jobs
  where id in (v_job_a_past_id, v_job_a_future_1_id, v_job_a_future_2_id, v_job_b_future_id);

  delete from public.properties
  where id in (v_property_a_id, v_property_b_id)
     or client_id in (v_client_a_id, v_client_b_id);

  delete from public.clients
  where id in (v_client_a_id, v_client_b_id);
end;
$$;

commit;

select jsonb_build_object(
  'status', 'CP3B3_FIXTURE_CLEANUP_COMMITTED',
  'clients', (
    select count(*)
    from public.clients
    where id like 'CP3B3-PORTAL-AUTH-20260807-%'
  ),
  'memberships', (
    select count(*)
    from public.client_portal_memberships
    where client_id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
  ),
  'properties', (
    select count(*)
    from public.properties
    where id like 'CP3B3-PORTAL-AUTH-20260807-%'
  ),
  'jobs', (
    select count(*)
    from public.jobs
    where id like 'CP3B3-PORTAL-AUTH-20260807-%'
  ),
  'service_requests', (
    select count(*)
    from public.client_service_requests
    where requested_by in (
      '93b1f5f1-ca54-4b5d-8209-a883788c8352'::uuid,
      '50466c12-4ce5-4351-9050-e23f475b6cfe'::uuid
    )
       or client_id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
  ),
  'quotes', (
    select count(*)
    from public.quotes
    where client_id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
       or property_id in (
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A',
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
    )
  ),
  'invoices', (
    select count(*)
    from public.invoices
    where client_id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
       or property_id in (
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A',
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
    )
       or job_id in (
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2',
      'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE'
    )
  ),
  'payments', (
    select count(*)
    from public.payments as p
    join public.invoices as i on i.id = p.invoice_id
    where i.client_id in (
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-A',
      'CP3B3-PORTAL-AUTH-20260807-CLIENT-B'
    )
       or i.property_id in (
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-A',
      'CP3B3-PORTAL-AUTH-20260807-PROPERTY-B'
    )
       or i.job_id in (
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2',
      'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE'
    )
  ),
  'job_lines', (
    select count(*)
    from public.job_lines
    where job_id in (
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-PAST',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-1',
      'CP3B3-PORTAL-AUTH-20260807-JOB-A-FUTURE-2',
      'CP3B3-PORTAL-AUTH-20260807-JOB-B-FUTURE'
    )
  )
)::text as cp3b3_portal_auth_cleanup_20260807;
