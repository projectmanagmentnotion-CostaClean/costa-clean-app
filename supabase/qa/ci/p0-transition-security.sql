\if :{?phase}
\else
\echo 'phase is required'
\quit 3
\endif

\if :{?run_id}
\else
\echo 'run_id is required'
\quit 3
\endif

begin;
select set_config('app.p0.phase', :'phase', true);
select set_config('app.p0.run_id', :'run_id', true);

create temp table p0_transition_actors (
  actor text primary key,
  user_id uuid not null unique,
  expense_number bigint not null unique
) on commit drop;

insert into p0_transition_actors(actor, user_id, expense_number) values
  ('operator', gen_random_uuid(), -910000001),
  ('owner', gen_random_uuid(), -910000002),
  ('admin', gen_random_uuid(), -910000003),
  ('finance', gen_random_uuid(), -910000004),
  ('nonmember', gen_random_uuid(), -910000005);

set local session_replication_role = replica;
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
select user_id,
       lower(current_setting('app.p0.run_id')) || '-' || actor || '@example.invalid',
       clock_timestamp(), clock_timestamp(), clock_timestamp()
  from p0_transition_actors;
set local session_replication_role = origin;

insert into public.internal_staff_memberships(user_id, role, status, revoked_at)
select user_id, actor, 'active', null
  from p0_transition_actors
 where actor <> 'nonmember';

insert into public.expenses (
  expense_number, display_code, expense_date, supplier_name, category, description
) overriding system value
values (
  -910000003,
  current_setting('app.p0.run_id') || '-fixture',
  current_date,
  'Synthetic transition supplier',
  'otros',
  current_setting('app.p0.run_id') || ' transition fixture'
);

create or replace function pg_temp.p0_transition_assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'p0_transition_assert_failed:%', label using errcode = 'P0001';
  end if;
end;
$$;

do $transition_security$
declare
  operator_id uuid;
  operator_number bigint;
  nonmember_id uuid;
  nonmember_number bigint;
  fixture_id uuid;
  affected bigint;
  actual_state text;
  signature text;
  target_function regprocedure;
  function_count integer := 0;
  financial_actor record;
begin
  select user_id, expense_number into operator_id, operator_number
    from p0_transition_actors where actor = 'operator';
  select user_id, expense_number into nonmember_id, nonmember_number
    from p0_transition_actors where actor = 'nonmember';
  select id into fixture_id from public.expenses
   where description = current_setting('app.p0.run_id') || ' transition fixture';

  perform pg_temp.p0_transition_assert(
    not has_table_privilege('anon', 'public.expenses', 'SELECT')
      and not has_table_privilege('anon', 'public.expenses', 'INSERT')
      and not has_table_privilege('anon', 'public.expenses', 'UPDATE')
      and not has_table_privilege('anon', 'public.expenses', 'DELETE'),
    current_setting('app.p0.phase') || '_anon_expense_acl_denied'
  );
  perform pg_temp.p0_transition_assert(
    not has_table_privilege('authenticated', 'public.expenses', 'DELETE')
      and not has_table_privilege('authenticated', 'public.expenses', 'TRUNCATE')
      and not has_table_privilege('authenticated', 'public.expenses', 'REFERENCES')
      and not has_table_privilege('authenticated', 'public.expenses', 'TRIGGER'),
    current_setting('app.p0.phase') || '_authenticated_destructive_acl_denied'
  );
  perform pg_temp.p0_transition_assert(
    has_table_privilege('service_role', 'public.expenses', 'SELECT')
      and has_table_privilege('service_role', 'public.expenses', 'INSERT')
      and has_table_privilege('service_role', 'public.expenses', 'UPDATE')
      and has_table_privilege('service_role', 'public.expenses', 'DELETE'),
    current_setting('app.p0.phase') || '_service_role_expense_acl_preserved'
  );

  foreach signature in array array[
    'public.debug_run_authorized_invoice_batch()',
    'public.run_authorized_invoice_batch()',
    'public.n21_assert_existing_job_quote_compatibility()',
    'public.rls_auto_enable()'
  ] loop
    target_function := to_regprocedure(signature);
    perform pg_temp.p0_transition_assert(target_function is not null, current_setting('app.p0.phase') || '_required_rpc_present');
    perform pg_temp.p0_transition_assert(
      (select prosecdef from pg_proc where oid = target_function::oid),
      current_setting('app.p0.phase') || '_rpc_security_definer'
    );
    perform pg_temp.p0_transition_assert(
      not has_function_privilege('anon', target_function, 'EXECUTE')
        and not has_function_privilege('authenticated', target_function, 'EXECUTE')
        and not has_function_privilege('service_role', target_function, 'EXECUTE'),
      current_setting('app.p0.phase') || '_privileged_rpc_denied'
    );
    function_count := function_count + 1;
  end loop;
  perform pg_temp.p0_transition_assert(function_count = 4, current_setting('app.p0.phase') || '_rpc_count');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', nonmember_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', nonmember_id, 'role', 'authenticated')::text, true);
  execute format('select count(*) from public.expenses where id = %L::uuid', fixture_id) into affected;
  perform pg_temp.p0_transition_assert(affected = 0, current_setting('app.p0.phase') || '_nonmember_read_denied');
  perform pg_temp.p0_transition_assert(not public.expense_staff_access(false), current_setting('app.p0.phase') || '_nonmember_predicate_denied');
  begin
    execute format(
      $q$insert into public.expenses (expense_number, display_code, expense_date, supplier_name, category, description)
         overriding system value values (%L, %L, current_date, 'Synthetic', 'otros', %L)$q$,
      nonmember_number,
      current_setting('app.p0.run_id') || '-nonmember',
      current_setting('app.p0.run_id') || ' denied nonmember insert'
    );
    raise exception 'nonmember_insert_was_not_denied' using errcode = 'P0001';
  exception when insufficient_privilege then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state <> '42501' then raise; end if;
  end;
  execute format('update public.expenses set notes = %L where id = %L::uuid', 'nonmember-denied', fixture_id);
  get diagnostics affected = row_count;
  perform pg_temp.p0_transition_assert(affected = 0, current_setting('app.p0.phase') || '_nonmember_update_denied');
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', operator_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', operator_id, 'role', 'authenticated')::text, true);
  begin
    execute format(
      $q$insert into public.expenses (expense_number, display_code, expense_date, supplier_name, category, description)
         overriding system value values (%L, %L, current_date, 'Synthetic', 'otros', %L)$q$,
      operator_number,
      current_setting('app.p0.run_id') || '-operator',
      current_setting('app.p0.run_id') || ' denied operator insert'
    );
    raise exception 'operator_insert_was_not_denied' using errcode = 'P0001';
  exception when insufficient_privilege then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state <> '42501' then raise; end if;
  end;
  execute format('update public.expenses set notes = %L where id = %L::uuid', 'operator-denied', fixture_id);
  get diagnostics affected = row_count;
  perform pg_temp.p0_transition_assert(affected = 0, current_setting('app.p0.phase') || '_operator_update_denied');
  execute 'reset role';

  for financial_actor in
    select actor, user_id, expense_number
      from p0_transition_actors
     where actor in ('owner', 'admin', 'finance')
     order by actor
  loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', financial_actor.user_id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', financial_actor.user_id, 'role', 'authenticated')::text, true);
    execute format(
      $q$insert into public.expenses (expense_number, display_code, expense_date, supplier_name, category, description)
         overriding system value values (%L, %L, current_date, 'Synthetic', 'otros', %L)$q$,
      financial_actor.expense_number,
      current_setting('app.p0.run_id') || '-' || financial_actor.actor,
      current_setting('app.p0.run_id') || ' allowed ' || financial_actor.actor || ' insert'
    );
    get diagnostics affected = row_count;
    perform pg_temp.p0_transition_assert(affected = 1, current_setting('app.p0.phase') || '_' || financial_actor.actor || '_insert_allowed');
    execute format('update public.expenses set notes = %L where id = %L::uuid', financial_actor.actor || '-allowed', fixture_id);
    get diagnostics affected = row_count;
    perform pg_temp.p0_transition_assert(affected = 1, current_setting('app.p0.phase') || '_' || financial_actor.actor || '_update_allowed');
    execute 'reset role';
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
end;
$transition_security$;

rollback;
