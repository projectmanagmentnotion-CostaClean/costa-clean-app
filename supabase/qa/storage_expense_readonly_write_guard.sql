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
select set_config('app.storage_guard.project_ref', :'project_ref', true);
select set_config('app.storage_guard.run_id', :'run_id', true);

do $target_guard$
begin
  if current_setting('app.storage_guard.project_ref') <> 'kpvvydthlxupjjqqdpxy' then
    raise exception 'storage_guard_requires_costa_clean_qa' using errcode = '42501';
  end if;
  if current_setting('app.storage_guard.run_id') !~ '^STORAGE-[A-F0-9]{8}$' then
    raise exception 'synthetic_storage_run_id_rejected' using errcode = '22023';
  end if;
end;
$target_guard$;

create temp table storage_guard_actors (
  actor text primary key,
  user_id uuid not null unique,
  capture_session_id uuid not null unique
) on commit drop;

insert into storage_guard_actors(actor, user_id, capture_session_id)
select actor, gen_random_uuid(), gen_random_uuid()
from (values ('owner'), ('admin'), ('operator'), ('finance'), ('readonly'), ('nonmember')) as actors(actor);

set local session_replication_role = replica;
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
select user_id,
       lower(current_setting('app.storage_guard.run_id')) || '-' || actor || '@example.invalid',
       clock_timestamp(), clock_timestamp(), clock_timestamp()
from storage_guard_actors;
set local session_replication_role = origin;

insert into public.internal_staff_memberships(user_id, role, status, revoked_at)
select user_id, actor, 'active', null
from storage_guard_actors
where actor <> 'nonmember';

insert into public.expense_capture_sessions(id, created_by, source, idempotency_key)
select capture_session_id, user_id, 'upload',
       lower(current_setting('app.storage_guard.run_id')) || '-' || actor
from storage_guard_actors;

create temp table storage_guard_fixture (
  object_id uuid primary key,
  actor text not null,
  kind text not null,
  path text not null unique
) on commit drop;

insert into storage_guard_fixture(object_id, actor, kind, path)
select gen_random_uuid(), a.actor, 'expense',
       'expenses/' || gen_random_uuid()::text || '/' || lower(current_setting('app.storage_guard.run_id')) || '-' || a.actor || '.png'
from storage_guard_actors as a
union all
select gen_random_uuid(), a.actor, 'capture',
       'captures/' || a.capture_session_id::text || '/' || lower(current_setting('app.storage_guard.run_id')) || '-seed.png'
from storage_guard_actors as a
union all
select gen_random_uuid(), a.actor, 'client_media',
       'clients/' || lower(current_setting('app.storage_guard.run_id')) || '/' || gen_random_uuid()::text || '.png'
from storage_guard_actors as a;

grant select on storage_guard_actors, storage_guard_fixture to authenticated, anon;

-- Metadata-only synthetic fixtures; no Storage API or object bytes are created.
insert into storage.objects (id, bucket_id, name, metadata)
select object_id,
       case when kind = 'client_media' then 'client-profile-media' else 'expense-receipts' end,
       path, '{"mimetype":"image/png","size":1}'::jsonb
from storage_guard_fixture;

create or replace function pg_temp.storage_guard_assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'storage_guard_assert_failed:%', label using errcode = 'P0001';
  end if;
end;
$$;

create or replace function pg_temp.storage_guard_expect_denied(sql_text text, label text)
returns void language plpgsql as $$
declare
  actual_state text;
begin
  execute sql_text;
  raise exception 'storage_guard_expected_denial_missing:%', label using errcode = 'P0001';
exception when others then
  get stacked diagnostics actual_state = returned_sqlstate;
  if actual_state <> '42501' then
    raise exception 'storage_guard_expected_42501_%_got_%', label, actual_state using errcode = 'P0001';
  end if;
end;
$$;

do $policy_guard$
declare
  write_policy_count integer;
  unguarded_policy_count integer;
begin
  select count(*) into write_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'Internal staff upload expense receipts',
      'Internal staff update expense receipts',
      'Internal staff delete expense receipts',
      'Internal staff upload client profile media',
      'Internal staff update client profile media',
      'Internal staff delete client profile media',
      'n51_capture_insert', 'n51_capture_update', 'n51_capture_delete'
    )
    and cmd in ('INSERT', 'UPDATE', 'DELETE');
  perform pg_temp.storage_guard_assert(write_policy_count = 9, 'nine_storage_write_policies_present');

  select count(*) into unguarded_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'Internal staff upload expense receipts',
      'Internal staff update expense receipts',
      'Internal staff delete expense receipts',
      'Internal staff upload client profile media',
      'Internal staff update client profile media',
      'Internal staff delete client profile media',
      'n51_capture_insert', 'n51_capture_update', 'n51_capture_delete'
    )
    and (coalesce(qual, '') || coalesce(with_check, '')) not like '%is_current_internal_staff_writer%';
  perform pg_temp.storage_guard_assert(unguarded_policy_count = 0, 'all_expense_write_policies_check_writer_role');

  perform pg_temp.storage_guard_assert(
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Internal staff read expense receipts' and cmd = 'SELECT'),
    'expense_receipt_select_policy_preserved'
  );
  perform pg_temp.storage_guard_assert(
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Internal staff read client profile media' and cmd = 'SELECT'),
    'client_profile_media_select_policy_preserved'
  );
  perform pg_temp.storage_guard_assert(
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'n51_capture_select' and cmd = 'SELECT'),
    'capture_select_policy_preserved'
  );
  perform pg_temp.storage_guard_assert(
    has_function_privilege('authenticated', 'app_private.is_current_internal_staff_writer()', 'EXECUTE'),
    'authenticated_has_execute_on_current_actor_guard'
  );
  perform pg_temp.storage_guard_assert(
    not has_function_privilege('anon', 'app_private.is_current_internal_staff_writer()', 'EXECUTE'),
    'anon_cannot_execute_current_actor_guard'
  );
end;
$policy_guard$;

do $role_matrix$
declare
  actor record;
  object_row record;
  foreign_capture record;
  affected_count bigint;
  visible_count bigint;
  run_id text := current_setting('app.storage_guard.run_id');
  target_bucket text;
  new_path text;
begin
  for actor in
    select a.actor, a.user_id
    from storage_guard_actors as a
    order by a.actor
  loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', actor.user_id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', actor.user_id, 'role', 'authenticated')::text, true);

    -- Capture documents are private to the session owner, even between active
    -- internal staff. Test the Storage metadata boundary with another actor's
    -- synthetic object before exercising each actor's own fixtures.
    for foreign_capture in
      select f.object_id, f.actor
      from storage_guard_fixture as f
      where f.kind = 'capture'
        and f.actor <> actor.actor
    loop
      execute format('select count(*) from storage.objects where id = %L::uuid', foreign_capture.object_id)
        into visible_count;
      perform pg_temp.storage_guard_assert(
        visible_count = 0,
        actor.actor || '_cannot_read_capture_from_' || foreign_capture.actor
      );
    end loop;

    if actor.actor in ('owner', 'admin', 'operator', 'finance') then
      for object_row in select f.object_id, f.kind, f.path from storage_guard_fixture as f where f.actor = actor.actor loop
        execute format('select count(*) from storage.objects where id = %L::uuid', object_row.object_id) into visible_count;
        perform pg_temp.storage_guard_assert(visible_count = 1, actor.actor || '_' || object_row.kind || '_select_allowed');

        if object_row.kind = 'expense' then
          target_bucket := 'expense-receipts';
          new_path := regexp_replace(object_row.path, '[.]png$', '-new.png');
        elsif object_row.kind = 'capture' then
          target_bucket := 'expense-receipts';
          new_path := regexp_replace(object_row.path, 'seed[.]png$', 'new.png');
        else
          target_bucket := 'client-profile-media';
          new_path := regexp_replace(object_row.path, '[^/]+[.]png$', gen_random_uuid()::text || '.png');
        end if;

        execute format(
          'insert into storage.objects (bucket_id,name,metadata) values (%L,%L,%L::jsonb)',
          target_bucket, new_path,
          '{"mimetype":"image/png","size":1}'
        );
        get diagnostics affected_count = row_count;
        perform pg_temp.storage_guard_assert(affected_count = 1, actor.actor || '_' || object_row.kind || '_insert_allowed');

        execute format('update storage.objects set metadata = %L::jsonb where id = %L::uuid',
          '{"mimetype":"image/png","size":2}', object_row.object_id);
        get diagnostics affected_count = row_count;
        perform pg_temp.storage_guard_assert(affected_count = 1, actor.actor || '_' || object_row.kind || '_update_allowed');
      end loop;
    else
      for object_row in select f.object_id, f.kind, f.path from storage_guard_fixture as f where f.actor = actor.actor loop
        execute format('select count(*) from storage.objects where id = %L::uuid', object_row.object_id) into visible_count;
        if actor.actor = 'readonly' then
          perform pg_temp.storage_guard_assert(visible_count = 1, 'readonly_' || object_row.kind || '_select_preserved');
        else
          perform pg_temp.storage_guard_assert(visible_count = 0, 'nonmember_' || object_row.kind || '_select_denied');
        end if;

        execute format('update storage.objects set metadata = %L::jsonb where id = %L::uuid',
          '{"mimetype":"image/png","size":3}', object_row.object_id);
        get diagnostics affected_count = row_count;
        perform pg_temp.storage_guard_assert(affected_count = 0, actor.actor || '_' || object_row.kind || '_update_denied');

        if object_row.kind = 'expense' then
          target_bucket := 'expense-receipts';
          new_path := regexp_replace(object_row.path, '[.]png$', '-denied.png');
        elsif object_row.kind = 'capture' then
          target_bucket := 'expense-receipts';
          new_path := regexp_replace(object_row.path, 'seed[.]png$', 'denied.png');
        else
          target_bucket := 'client-profile-media';
          new_path := regexp_replace(object_row.path, '[^/]+[.]png$', gen_random_uuid()::text || '.png');
        end if;

        perform pg_temp.storage_guard_expect_denied(
          format(
            'insert into storage.objects (bucket_id,name,metadata) values (%L,%L,%L::jsonb)',
            target_bucket, new_path,
            '{"mimetype":"image/png","size":1}'
          ),
          actor.actor || '_' || object_row.kind || '_insert_denied'
        );
      end loop;
    end if;

    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}'::text, true);
  end loop;

  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
  if has_table_privilege('anon', 'storage.objects', 'SELECT') then
    execute 'select count(*) from storage.objects where bucket_id = ''expense-receipts''' into visible_count;
    perform pg_temp.storage_guard_assert(visible_count = 0, 'anon_storage_select_denied');
  else
    perform pg_temp.storage_guard_expect_denied(
      'select count(*) from storage.objects where bucket_id = ''expense-receipts''',
      'anon_storage_select_privilege_denied'
    );
  end if;
  perform pg_temp.storage_guard_expect_denied(
    'insert into storage.objects (bucket_id,name,metadata) values (''expense-receipts'',''expenses/anon-denied/file.png'', ''{"mimetype":"image/png","size":1}''::jsonb)',
    'anon_storage_insert_denied'
  );
  execute 'reset role';
end;
$role_matrix$;

select 'STORAGE_RLS_MATRIX=PASS' as result;
rollback;
