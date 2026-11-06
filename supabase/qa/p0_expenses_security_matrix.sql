\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

\if :{?project_ref}
\else
\echo 'project_ref is required'
\quit 3
\endif

\if :{?run_id}
\else
\echo 'run_id is required'
\quit 3
\endif

begin;

select set_config('app.p0.project_ref', :'project_ref', true);
select set_config('app.p0.run_id', :'run_id', true);

do $target_guard$
begin
  if current_setting('app.p0.project_ref') <> 'costa-clean-app' then
    raise exception 'p0_test_requires_local_supabase_project' using errcode = '42501';
  end if;
  if current_setting('app.p0.run_id') !~ '^P0-[A-F0-9]{8}$' then
    raise exception 'synthetic_run_id_rejected' using errcode = '22023';
  end if;
end;
$target_guard$;

create temp table p0_expense_actors (
  actor text primary key,
  user_id uuid not null unique,
  expense_number bigint not null unique
) on commit drop;

insert into p0_expense_actors(actor, user_id, expense_number)
select actors.actor,
       gen_random_uuid(),
       case when hash_value >= 0 then -hash_value - 1 else hash_value end
from (values
  ('anon'), ('owner'), ('admin'), ('finance'), ('operator'), ('readonly'),
  ('suspended_finance'), ('revoked_finance'), ('nonmember'), ('service_role'), ('fixture')
) as actors(actor)
cross join lateral (
  select hashtextextended(current_setting('app.p0.run_id') || ':' || actors.actor, 0) as hash_value
) as synthetic;

-- Suppress auth.users triggers while creating disposable identities. The matrix
-- tests database authorization, not signup hooks, emails, or profile workflows.
set local session_replication_role = replica;
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
select user_id,
       lower(current_setting('app.p0.run_id')) || '-' || actor || '@example.invalid',
       clock_timestamp(), clock_timestamp(), clock_timestamp()
from p0_expense_actors
where actor not in ('anon', 'service_role', 'fixture');
set local session_replication_role = origin;

insert into public.internal_staff_memberships(user_id, role, status, revoked_at)
select user_id,
       case when actor in ('suspended_finance', 'revoked_finance') then 'finance' else actor end,
       case when actor = 'suspended_finance' then 'suspended'
            when actor = 'revoked_finance' then 'revoked'
            else 'active' end,
       case when actor = 'revoked_finance' then clock_timestamp() else null end
from p0_expense_actors
where actor not in ('nonmember', 'anon', 'service_role', 'fixture');

do $expense_number_collision_guard$
begin
  if exists (
    select 1
      from public.expenses as expense
      join p0_expense_actors as actor
        on actor.expense_number = expense.expense_number
  ) then
    raise exception 'Synthetic P0 expense number collision; choose a new run_id.'
      using errcode = '23505';
  end if;
end;
$expense_number_collision_guard$;

create temp table p0_expense_sequence_prestate (
  last_value bigint not null,
  is_called boolean not null
) on commit drop;

insert into p0_expense_sequence_prestate(last_value, is_called)
select last_value, is_called
from public.expenses_expense_number_seq;

insert into public.expenses (
  expense_number, display_code, expense_date, supplier_name, category,
  description, subtotal, tax_amount, total
) overriding system value
select expense_number,
       current_setting('app.p0.run_id') || '-fixture',
       current_date, 'Synthetic P0 supplier', 'otros',
       current_setting('app.p0.run_id') || ' synthetic access fixture', 10, 2.10, 12.10
from p0_expense_actors
where actor = 'fixture';

create or replace function pg_temp.p0_assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'p0_assert_failed:%', label using errcode = 'P0001';
  end if;
end;
$$;

create or replace function pg_temp.p0_expect_denied(sql_text text, label text)
returns void language plpgsql as $$
declare
  actual_state text;
begin
  execute sql_text;
  raise exception 'p0_expected_denial_missing:%', label using errcode = 'P0001';
exception when others then
  get stacked diagnostics actual_state = returned_sqlstate;
  if actual_state <> '42501' then
    raise exception 'p0_expected_42501_%_got_%', label, actual_state using errcode = 'P0001';
  end if;
end;
$$;

do $security_matrix$
declare
  actor record;
  fixture_id uuid;
  visible_count bigint;
  affected_count bigint;
  next_id uuid;
  signature text;
  target_function regprocedure;
  financial_write_helper regprocedure;
  expense_policy_count bigint;
  helper_is_definer boolean;
  helper_owner text;
  helper_settings text[];
  expense_sequence_before bigint;
  expense_sequence_called_before boolean;
  expense_sequence_after bigint;
  expense_sequence_called_after boolean;
  anon_expense_number bigint;
  service_expense_number bigint;
begin
  select id into fixture_id from public.expenses
  where description = current_setting('app.p0.run_id') || ' synthetic access fixture';

  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'SELECT'), 'anon_select_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'INSERT'), 'anon_insert_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'UPDATE'), 'anon_update_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'DELETE'), 'anon_delete_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'TRUNCATE'), 'anon_truncate_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'REFERENCES'), 'anon_references_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'TRIGGER'), 'anon_trigger_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('anon', 'public.expenses', 'MAINTAIN'), 'anon_maintain_grant_revoked');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.expenses', 'DELETE'), 'authenticated_delete_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.expenses', 'TRUNCATE'), 'authenticated_truncate_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.expenses', 'MAINTAIN'), 'authenticated_maintain_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.expenses', 'REFERENCES'), 'authenticated_references_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.expenses', 'TRIGGER'), 'authenticated_trigger_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.internal_staff_memberships', 'SELECT'), 'authenticated_membership_select_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.internal_staff_memberships', 'INSERT'), 'authenticated_membership_insert_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.internal_staff_memberships', 'UPDATE'), 'authenticated_membership_update_not_granted');
  perform pg_temp.p0_assert(not has_table_privilege('authenticated', 'public.internal_staff_memberships', 'DELETE'), 'authenticated_membership_delete_not_granted');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'SELECT'), 'service_role_select_granted');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'INSERT'), 'service_role_insert_granted');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'UPDATE'), 'service_role_update_granted');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'DELETE'), 'service_role_delete_granted');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'TRUNCATE'), 'service_role_truncate_preserved');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'REFERENCES'), 'service_role_references_preserved');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'TRIGGER'), 'service_role_trigger_preserved');
  perform pg_temp.p0_assert(has_table_privilege('service_role', 'public.expenses', 'MAINTAIN'), 'service_role_maintain_preserved');
  perform pg_temp.p0_assert(not has_function_privilege('authenticated', 'app_private.internal_staff_role_can_write_financially(text)', 'EXECUTE'), 'authenticated_internal_predicate_exec_not_granted');
  perform pg_temp.p0_assert(not has_function_privilege('anon', 'app_private.internal_staff_role_can_write_financially(text)', 'EXECUTE'), 'anon_internal_predicate_exec_not_granted');
  select count(*) into expense_policy_count
    from pg_policies
   where schemaname = 'public' and tablename = 'expenses';
  perform pg_temp.p0_assert(expense_policy_count = 3, 'only_three_scoped_expense_policies_remain');
  financial_write_helper := to_regprocedure('public.expense_staff_access(boolean)');
  perform pg_temp.p0_assert(financial_write_helper is not null, 'financial_write_helper_exists');
  select p.prosecdef,
         pg_get_userbyid(p.proowner),
         p.proconfig
    into helper_is_definer, helper_owner, helper_settings
    from pg_proc as p
   where p.oid = financial_write_helper;
  perform pg_temp.p0_assert(helper_is_definer, 'financial_write_helper_security_definer');
  perform pg_temp.p0_assert(helper_owner = 'postgres', 'financial_write_helper_owner_postgres');
  perform pg_temp.p0_assert(coalesce(helper_settings @> array['search_path=""']::text[], false), 'financial_write_helper_empty_search_path');
  perform pg_temp.p0_assert(has_function_privilege('authenticated', financial_write_helper, 'EXECUTE'), 'authenticated_financial_write_helper_exec');
  perform pg_temp.p0_assert(not has_function_privilege('anon', financial_write_helper, 'EXECUTE'), 'anon_financial_write_helper_denied');
  perform pg_temp.p0_assert(not has_function_privilege('service_role', financial_write_helper, 'EXECUTE'), 'service_role_financial_write_helper_denied');

  select last_value, is_called
    into expense_sequence_before, expense_sequence_called_before
    from p0_expense_sequence_prestate;
  select expense_number into anon_expense_number
    from p0_expense_actors as a where a.actor = 'anon';
  select expense_number into service_expense_number
    from p0_expense_actors as a where a.actor = 'service_role';
  foreach signature in array array[
    'public.debug_run_authorized_invoice_batch()',
    'public.run_authorized_invoice_batch()',
    'public.n21_assert_existing_job_quote_compatibility()',
    'public.rls_auto_enable()'
  ] loop
    target_function := to_regprocedure(signature);
    if target_function is not null then
      perform pg_temp.p0_assert(not has_function_privilege('anon', target_function, 'EXECUTE'), signature || '_anon_revoked');
      perform pg_temp.p0_assert(not has_function_privilege('authenticated', target_function, 'EXECUTE'), signature || '_authenticated_revoked');
      perform pg_temp.p0_assert(not has_function_privilege('service_role', target_function, 'EXECUTE'), signature || '_service_role_revoked_by_n56');
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
  perform pg_temp.p0_assert(not public.expense_staff_access(false), 'no_auth_uid_cannot_read');
  perform pg_temp.p0_assert(not public.expense_staff_access(true), 'no_auth_uid_cannot_write');

  execute 'set local role anon';
  perform pg_temp.p0_expect_denied('select count(*) from public.expenses', 'anon_read');
  perform pg_temp.p0_expect_denied(
    format($q$insert into public.expenses (expense_number, display_code, expense_date, supplier_name, category, description) overriding system value values (%L, %L, current_date, 'Synthetic', 'otros', 'anon-denied')$q$,
      anon_expense_number,
      current_setting('app.p0.run_id') || '-anon'),
    'anon_insert'
  );
  perform pg_temp.p0_expect_denied('update public.expenses set notes = ''anon''', 'anon_update');
  perform pg_temp.p0_expect_denied('delete from public.expenses', 'anon_delete');
  execute 'reset role';

  for actor in
    select a.actor, a.user_id, a.expense_number
      from p0_expense_actors as a
     where a.actor in (
       'owner', 'admin', 'finance', 'operator', 'readonly',
       'suspended_finance', 'revoked_finance', 'nonmember'
     )
     order by a.actor
  loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', actor.user_id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', actor.user_id, 'role', 'authenticated')::text, true);
    perform pg_temp.p0_assert(not public.expense_staff_access(null), actor.actor || '_null_operation_denied');
    perform pg_temp.p0_expect_denied(
      format('delete from public.expenses where id = %L::uuid', fixture_id),
      actor.actor || '_delete_not_granted'
    );

    execute format('select count(*) from public.expenses where id = %L::uuid', fixture_id) into visible_count;
    if actor.actor in ('nonmember', 'suspended_finance', 'revoked_finance') then
      perform pg_temp.p0_assert(visible_count = 0, actor.actor || '_cannot_read');
      perform pg_temp.p0_assert(not public.expense_staff_access(false), actor.actor || '_read_predicate_denied');
      perform pg_temp.p0_assert(not public.expense_staff_access(true), actor.actor || '_write_predicate_denied');
      perform pg_temp.p0_expect_denied(
        format($q$insert into public.expenses (expense_number, display_code, expense_date, supplier_name, category, description) overriding system value values (%L, %L, current_date, 'Synthetic', 'otros', %L)$q$,
          actor.expense_number,
          current_setting('app.p0.run_id') || '-' || actor.actor,
          'denied-' || actor.actor),
        actor.actor || '_insert_denied'
      );
      execute format('update public.expenses set notes = %L where id = %L::uuid', 'denied', fixture_id);
      get diagnostics affected_count = row_count;
      perform pg_temp.p0_assert(affected_count = 0, 'nonmember_cannot_update');
    elsif actor.actor in ('operator', 'readonly') then
      perform pg_temp.p0_assert(visible_count = 1, 'active_nonfinancial_staff_can_read');
      perform pg_temp.p0_assert(public.expense_staff_access(false), actor.actor || '_read_predicate_allowed');
      perform pg_temp.p0_expect_denied(
        format($q$insert into public.expenses (expense_number, display_code, expense_date, supplier_name, category, description) overriding system value values (%L, %L, current_date, 'Synthetic', 'otros', %L)$q$,
          actor.expense_number,
          current_setting('app.p0.run_id') || '-' || actor.actor,
          'denied-' || actor.actor),
        actor.actor || '_financial_insert'
      );
      execute format('update public.expenses set notes = %L where id = %L::uuid', 'denied', fixture_id);
      get diagnostics affected_count = row_count;
      perform pg_temp.p0_assert(affected_count = 0, actor.actor || '_financial_update_denied');
      perform pg_temp.p0_assert(not public.expense_staff_access(true), actor.actor || '_predicate_denied');
    else
      perform pg_temp.p0_assert(visible_count = 1, actor.actor || '_can_read');
      perform pg_temp.p0_assert(public.expense_staff_access(false), actor.actor || '_read_predicate_allowed');
      perform pg_temp.p0_assert(public.expense_staff_access(true), actor.actor || '_write_predicate_allowed');
      next_id := gen_random_uuid();
      execute format(
        $q$insert into public.expenses (id, expense_number, display_code, expense_date, supplier_name, category, description, subtotal, tax_amount, total) overriding system value values (%L::uuid, %L, %L, current_date, 'Synthetic', 'otros', %L, 10, 2.10, 12.10)$q$,
        next_id,
        actor.expense_number,
        current_setting('app.p0.run_id') || '-' || actor.actor,
        'allowed-' || actor.actor
      );
      execute format('update public.expenses set notes = %L where id = %L::uuid', 'synthetic-' || actor.actor, fixture_id);
      get diagnostics affected_count = row_count;
      perform pg_temp.p0_assert(affected_count = 1, actor.actor || '_can_update');
    end if;

    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}'::text, true);
  end loop;

  execute 'set local role service_role';
  execute format('select count(*) from public.expenses where id = %L::uuid', fixture_id) into visible_count;
  perform pg_temp.p0_assert(visible_count = 1, 'service_role_can_read');
  next_id := gen_random_uuid();
  execute format(
    $q$insert into public.expenses (id, expense_number, display_code, expense_date, supplier_name, category, description, subtotal, tax_amount, total) overriding system value values (%L::uuid, %L, %L, current_date, 'Synthetic', 'otros', 'service-role-delete', 10, 2.10, 12.10)$q$,
    next_id,
    service_expense_number,
    current_setting('app.p0.run_id') || '-service_role'
  );
  execute format('update public.expenses set notes = %L where id = %L::uuid', 'service-role', fixture_id);
  get diagnostics affected_count = row_count;
  perform pg_temp.p0_assert(affected_count = 1, 'service_role_can_update');
  execute format('delete from public.expenses where id = %L::uuid', next_id);
  get diagnostics affected_count = row_count;
  perform pg_temp.p0_assert(affected_count = 1, 'service_role_can_delete');
  execute 'reset role';

  select last_value, is_called
    into expense_sequence_after, expense_sequence_called_after
    from public.expenses_expense_number_seq;
  perform pg_temp.p0_assert(
    expense_sequence_after = expense_sequence_before
      and expense_sequence_called_after = expense_sequence_called_before,
    'expense_number_sequence_unchanged'
  );
end;
$security_matrix$;

rollback;
