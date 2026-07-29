\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin transaction read only;

with expected_functions(
  schema_name, function_name, arguments, volatility, authenticated_execute,
  expected_comment
) as (
  values
    ('public', 'portal_submit_profile_change_request_v2', 'text, jsonb, uuid', 'v', true,
     'Authenticated requester-only profile correction contract with atomic idempotency.'),
    ('public', 'portal_submit_property_change_request_v2', 'text, text, jsonb, uuid', 'v', true,
     'Authenticated requester-only eligible-property correction contract with atomic idempotency.'),
    ('public', 'portal_list_own_profile_change_requests_v2', 'text, integer', 's', true,
     'Minimized requester-only profile correction status list.'),
    ('public', 'portal_list_own_property_change_requests_v2', 'text, text, integer', 's', true,
     'Minimized requester-only eligible-property correction status list.'),
    ('portal_private', 'normalize_profile_change_v2', 'jsonb', 'i', false, null),
    ('portal_private', 'normalize_property_change_v2', 'jsonb', 'i', false, null),
    ('portal_private', 'reviewed_change_receipt_v2',
     'text, text, timestamp with time zone, jsonb, text', 's', false, null)
),
function_actual as (
  select
    e.*,
    p.oid,
    count(p.oid) over (partition by e.schema_name, e.function_name, e.arguments)
      as signature_count,
    pg_get_function_result(p.oid) as result_type,
    p.provolatile,
    p.proisstrict,
    p.prosecdef,
    r.rolname as owner_name,
    p.proconfig,
    obj_description(p.oid, 'pg_proc') as actual_comment,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'grantee', grantee.rolname,
        'grantor', grantor.rolname,
        'privilege', privilege_type,
        'grantable', is_grantable
      ) order by grantee.rolname, privilege_type)
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      join pg_roles grantor on grantor.oid = acl.grantor
      left join pg_roles grantee on grantee.oid = acl.grantee
      where acl.privilege_type = 'EXECUTE'
    ), '[]'::jsonb) as execute_acl
  from expected_functions e
  left join pg_namespace n on n.nspname = e.schema_name
  left join pg_proc p
    on p.pronamespace = n.oid
   and p.proname = e.function_name
   and oidvectortypes(p.proargtypes) = e.arguments
  left join pg_roles r on r.oid = p.proowner
),
function_signature_checks as (
  select
    'V3-FUNCTION-SIGNATURE:' || schema_name || '.' || function_name || '(' || arguments || ')' as id,
    schema_name || '.' || function_name as object_name,
    (
      oid is not null
      and signature_count = 1
      and result_type = 'jsonb'
      and provolatile = volatility
      and proisstrict is false
      and prosecdef is true
    ) as pass,
    jsonb_build_object(
      'signatureCount', 1, 'returnType', 'jsonb', 'volatility', volatility,
      'strict', false, 'securityDefiner', true
    ) as expected,
    jsonb_build_object(
      'signatureCount', coalesce(signature_count, 0),
      'returnType', result_type, 'volatility', provolatile,
      'strict', proisstrict, 'securityDefiner', prosecdef
    ) as actual
  from function_actual
),
function_owner_checks as (
  select
    'V3-FUNCTION-OWNER:' || schema_name || '.' || function_name || '(' || arguments || ')' as id,
    schema_name || '.' || function_name as object_name,
    owner_name = 'postgres' as pass,
    jsonb_build_object('owner', 'postgres') as expected,
    jsonb_build_object('owner', owner_name) as actual
  from function_actual
),
function_search_path_checks as (
  select
    'V3-FUNCTION-SEARCH-PATH:' || schema_name || '.' || function_name || '(' || arguments || ')' as id,
    schema_name || '.' || function_name as object_name,
    proconfig = array['search_path=pg_catalog'] as pass,
    jsonb_build_object('proconfig', jsonb_build_array('search_path=pg_catalog')) as expected,
    jsonb_build_object('proconfig', proconfig) as actual
  from function_actual
),
function_grant_checks as (
  select
    'V3-FUNCTION-GRANTS:' || schema_name || '.' || function_name || '(' || arguments || ')' as id,
    schema_name || '.' || function_name as object_name,
    execute_acl = case when authenticated_execute then
        jsonb_build_array(
          jsonb_build_object('grantee','authenticated','grantor','postgres',
            'privilege','EXECUTE','grantable',false),
          jsonb_build_object('grantee','postgres','grantor','postgres',
            'privilege','EXECUTE','grantable',false)
        )
      else
        jsonb_build_array(
          jsonb_build_object('grantee','postgres','grantor','postgres',
            'privilege','EXECUTE','grantable',false)
        )
      end as pass,
    jsonb_build_object(
      'executeAcl',
      case when authenticated_execute then
        jsonb_build_array(
          jsonb_build_object('grantee','authenticated','grantor','postgres',
            'privilege','EXECUTE','grantable',false),
          jsonb_build_object('grantee','postgres','grantor','postgres',
            'privilege','EXECUTE','grantable',false)
        )
      else
        jsonb_build_array(
          jsonb_build_object('grantee','postgres','grantor','postgres',
            'privilege','EXECUTE','grantable',false)
        )
      end
    ) as expected,
    jsonb_build_object('executeAcl', execute_acl) as actual
  from function_actual
),
function_comment_checks as (
  select
    'V3-FUNCTION-COMMENT:' || schema_name || '.' || function_name || '(' || arguments || ')' as id,
    schema_name || '.' || function_name as object_name,
    actual_comment is not distinct from expected_comment as pass,
    jsonb_build_object('comment', expected_comment) as expected,
    jsonb_build_object(
      'comment', actual_comment
    ) as actual
  from function_actual
),
expected_columns(table_name, column_name, data_type, target_order) as (
  values
    ('client_portal_profile_change_requests', 'idempotency_key', 'uuid', 1),
    ('client_portal_profile_change_requests', 'public_reference', 'text', 2),
    ('client_portal_property_change_requests', 'idempotency_key', 'uuid', 1),
    ('client_portal_property_change_requests', 'public_reference', 'text', 2)
),
column_checks as (
  select
    'V3-COLUMN-DEFINITION:public.' || e.table_name || '.' || e.column_name as id,
    'public.' || e.table_name || '.' || e.column_name as object_name,
    (
      c.column_name is not null
      and c.udt_name = e.data_type
      and c.is_nullable = 'YES'
      and c.column_default is null
      and (
        select count(*) from information_schema.columns ordered
        where ordered.table_schema='public'
          and ordered.table_name=e.table_name
          and ordered.column_name in ('idempotency_key','public_reference')
          and ordered.ordinal_position <= c.ordinal_position
      ) = e.target_order
      and c.ordinal_position > (
        select max(base.ordinal_position) from information_schema.columns base
        where base.table_schema='public'
          and base.table_name=e.table_name
          and base.column_name not in ('idempotency_key','public_reference')
      )
    ) as pass,
    jsonb_build_object(
      'type', e.data_type, 'nullable', true, 'default', null,
      'targetOrder', e.target_order, 'afterBaseColumns', true
    ) as expected,
    jsonb_build_object(
      'type', c.udt_name, 'nullable', c.is_nullable = 'YES',
      'default', c.column_default, 'ordinal', c.ordinal_position
    ) as actual
  from expected_columns e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.table_name
   and c.column_name = e.column_name
),
expected_constraints(table_name, constraint_name, expected_definition) as (
  values
    ('client_portal_profile_change_requests',
     'client_portal_profile_change_public_reference_format',
     'CHECK ((public_reference IS NULL) OR (public_reference ~ ''^CC-PR-[0-9A-F]{24}$''::text))'),
    ('client_portal_property_change_requests',
     'client_portal_property_change_public_reference_format',
     'CHECK ((public_reference IS NULL) OR (public_reference ~ ''^CC-PT-[0-9A-F]{24}$''::text))')
),
constraint_checks as (
  select
    'V3-CONSTRAINT-DEFINITION:public.' || e.table_name || '.' || e.constraint_name as id,
    'public.' || e.table_name || '.' || e.constraint_name as object_name,
    (
      c.oid is not null and c.contype = 'c' and c.convalidated
      and regexp_replace(lower(pg_get_constraintdef(c.oid, false)), '[[:space:]()]', '', 'g')
        = regexp_replace(lower(e.expected_definition), '[[:space:]()]', '', 'g')
    ) as pass,
    jsonb_build_object(
      'type', 'check', 'validated', true, 'definition', e.expected_definition
    ) as expected,
    jsonb_build_object(
      'type', c.contype, 'validated', c.convalidated,
      'definition', pg_get_constraintdef(c.oid, false)
    ) as actual
  from expected_constraints e
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class t on t.relnamespace = n.oid and t.relname = e.table_name
  left join pg_constraint c on c.conrelid = t.oid and c.conname = e.constraint_name
),
expected_indexes(table_name, index_name, keys, predicate) as (
  values
    ('client_portal_profile_change_requests',
     'client_portal_profile_change_v2_idempotency_uidx',
     array['requested_by','idempotency_key']::text[], '(idempotency_key IS NOT NULL)'),
    ('client_portal_property_change_requests',
     'client_portal_property_change_v2_idempotency_uidx',
     array['requested_by','idempotency_key']::text[], '(idempotency_key IS NOT NULL)'),
    ('client_portal_profile_change_requests',
     'client_portal_profile_change_v2_public_reference_uidx',
     array['public_reference']::text[], '(public_reference IS NOT NULL)'),
    ('client_portal_property_change_requests',
     'client_portal_property_change_v2_public_reference_uidx',
     array['public_reference']::text[], '(public_reference IS NOT NULL)')
),
index_actual as (
  select
    e.*,
    i.indexrelid,
    i.indisunique,
    i.indisvalid,
    i.indisready,
    i.indimmediate,
    i.indisprimary,
    i.indisexclusion,
    i.indnkeyatts,
    i.indnatts,
    am.amname as access_method,
    i.indexprs is null as no_expressions,
    pg_get_expr(i.indpred, i.indrelid) as actual_predicate,
    (
      select array_agg(pg_get_indexdef(i.indexrelid, position, true) order by position)
      from generate_series(1, i.indnkeyatts) position
    ) as actual_keys
  from expected_indexes e
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class t on t.relnamespace = n.oid and t.relname = e.table_name
  left join pg_class ix on ix.relnamespace = n.oid and ix.relname = e.index_name
  left join pg_index i on i.indexrelid = ix.oid and i.indrelid = t.oid
  left join pg_am am on am.oid = ix.relam
),
index_checks as (
  select
    'V3-INDEX-DEFINITION:public.' || table_name || '.' || index_name as id,
    'public.' || table_name || '.' || index_name as object_name,
    (
      indexrelid is not null and indisunique and indisvalid and indisready
      and indimmediate and not indisprimary and not indisexclusion
      and access_method='btree'
      and indnkeyatts=array_length(keys,1)
      and indnatts=array_length(keys,1)
      and no_expressions
      and actual_keys = keys and actual_predicate = predicate
    ) as pass,
    jsonb_build_object(
      'unique', true, 'valid', true, 'ready', true, 'immediate', true,
      'primary', false, 'exclusion', false, 'method', 'btree',
      'keyCount', array_length(keys,1), 'attributeCount', array_length(keys,1),
      'expressions', false,
      'keys', keys, 'predicate', predicate
    ) as expected,
    jsonb_build_object(
      'unique', indisunique, 'valid', indisvalid, 'ready', indisready,
      'immediate', indimmediate, 'primary', indisprimary,
      'exclusion', indisexclusion, 'method', access_method,
      'keyCount', indnkeyatts, 'attributeCount', indnatts,
      'expressions', not no_expressions,
      'keys', actual_keys, 'predicate', actual_predicate
    ) as actual
  from index_actual
),
target_policy_actual as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'policy', policyname,
    'permissive', permissive,
    'roles', to_jsonb(roles),
    'command', cmd,
    'qual', regexp_replace(coalesce(qual,''), '\s+', '', 'g'),
    'withCheck', regexp_replace(coalesce(with_check,''), '\s+', '', 'g')
  ) order by tablename, policyname), '[]'::jsonb) as definition
  from pg_policies
  where schemaname='public' and tablename in (
    'client_portal_profile_change_requests',
    'client_portal_property_change_requests'
  )
),
target_policy_expected as (
  select jsonb_build_array(
    jsonb_build_object(
      'table','client_portal_profile_change_requests',
      'policy','Internal staff manage profile requests',
      'permissive','PERMISSIVE',
      'roles',jsonb_build_array('authenticated'),
      'command','ALL',
      'qual','portal_private.is_active_internal_staff(auth.uid())',
      'withCheck','portal_private.is_active_internal_staff(auth.uid())'
    ),
    jsonb_build_object(
      'table','client_portal_property_change_requests',
      'policy','Internal staff manage property requests',
      'permissive','PERMISSIVE',
      'roles',jsonb_build_array('authenticated'),
      'command','ALL',
      'qual','portal_private.is_active_internal_staff(auth.uid())',
      'withCheck','portal_private.is_active_internal_staff(auth.uid())'
    )
  ) as definition
),
target_legacy_acl_rows as (
  select target.signature,
    coalesce(jsonb_agg(jsonb_build_object(
      'grantee',coalesce(grantee.rolname,'PUBLIC'),
      'grantor',grantor.rolname,
      'privilege',acl.privilege_type,
      'grantable',acl.is_grantable
    ) order by coalesce(grantee.rolname,'PUBLIC')), '[]'::jsonb) as execute_acl
  from (values
    (
      'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
      'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)'::regprocedure
    ),
    (
      'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
      'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)'::regprocedure
    )
  ) as target(signature, oid)
  join pg_proc p on p.oid=target.oid
  join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl on true
  join pg_roles grantor on grantor.oid=acl.grantor
  left join pg_roles grantee on grantee.oid=acl.grantee
  where acl.privilege_type='EXECUTE'
  group by target.signature
),
target_legacy_acl_actual as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'signature',signature,
    'executeAcl',execute_acl
  ) order by signature), '[]'::jsonb) as definition
  from target_legacy_acl_rows
),
target_legacy_acl_expected as (
  select jsonb_build_array(
    jsonb_build_object(
      'signature','public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
      'executeAcl',jsonb_build_array(jsonb_build_object(
        'grantee','postgres','grantor','postgres',
        'privilege','EXECUTE','grantable',false
      ))
    ),
    jsonb_build_object(
      'signature','public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
      'executeAcl',jsonb_build_array(jsonb_build_object(
        'grantee','postgres','grantor','postgres',
        'privilege','EXECUTE','grantable',false
      ))
    )
  ) as definition
),
boundary_checks as (
  select
    'V3-POLICY-COUNT'::text as id,
    'public.client_portal_*_change_requests exact policy set'::text as object_name,
    actual.definition=expected.definition as pass,
    expected.definition as expected,
    actual.definition as actual
  from target_policy_actual actual
  cross join target_policy_expected expected
  union all
  select
    'V3-RLS-FORCE'::text,
    'public.client_portal_*_change_requests RLS'::text,
    (select count(*)=2 and bool_and(relrowsecurity and relforcerowsecurity)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      )),
    jsonb_build_object('rls',true,'forceRls',true),
    (select jsonb_agg(jsonb_build_object(
      'table',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity
    ) order by c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      ))
  union all
  select
    'V3-LEGACY-GRANT-COUNT'::text,
    'public.portal_submit_*_change_trusted exact ACL'::text,
    actual.definition=expected.definition,
    expected.definition,
    actual.definition
  from target_legacy_acl_actual actual
  cross join target_legacy_acl_expected expected
),
all_checks as (
  select * from function_signature_checks
  union all select * from function_owner_checks
  union all select * from function_search_path_checks
  union all select * from function_grant_checks
  union all select * from function_comment_checks
  union all select * from column_checks
  union all select * from constraint_checks
  union all select * from index_checks
  union all select * from boundary_checks
)
select 'CP3B2A_V3_JSON:' || jsonb_build_object(
  'version', 3,
  'kind', 'postcheck',
  'result', case when bool_and(pass) then 'PASS' else 'FAIL' end,
  'checks', jsonb_agg(jsonb_build_object(
    'id', id,
    'object', object_name,
    'pass', pass,
    'expected', expected,
    'actual', actual
  ) order by id)
)::text
from all_checks;

rollback;
