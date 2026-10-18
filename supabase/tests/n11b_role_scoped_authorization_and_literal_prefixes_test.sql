BEGIN;
SELECT plan(27);

SELECT ok(app_private.internal_staff_role_can_write('owner'), 'owner may perform general writes');
SELECT ok(app_private.internal_staff_role_can_write('admin'), 'admin may perform general writes');
SELECT ok(app_private.internal_staff_role_can_write('operator'), 'operator may perform general writes');
SELECT ok(app_private.internal_staff_role_can_write('finance'), 'finance may perform general writes');
SELECT ok(NOT app_private.internal_staff_role_can_write('readonly'), 'readonly cannot perform general writes');
SELECT ok(NOT app_private.internal_staff_role_can_write(NULL), 'null role cannot perform general writes');
SELECT ok(NOT app_private.internal_staff_role_can_write('unknown'), 'unknown role cannot perform general writes');

SELECT ok(app_private.internal_staff_role_can_write_financially('owner'), 'owner may perform financial writes');
SELECT ok(app_private.internal_staff_role_can_write_financially('admin'), 'admin may perform financial writes');
SELECT ok(app_private.internal_staff_role_can_write_financially('finance'), 'finance may perform financial writes');
SELECT ok(NOT app_private.internal_staff_role_can_write_financially('operator'), 'operator cannot perform financial writes');
SELECT ok(NOT app_private.internal_staff_role_can_write_financially('readonly'), 'readonly cannot perform financial writes');
SELECT ok(NOT app_private.internal_staff_role_can_write_financially(NULL), 'null role cannot perform financial writes');

SELECT ok(app_private.is_n11_hygiene_fixture_id('QA_HYGIENE_N11_ARCHIVE_x'), 'accepts the exact synthetic fixture prefix');
SELECT ok(NOT app_private.is_n11_hygiene_fixture_id('QA-HYGIENE-N11-ARCHIVE_x'), 'rejects underscore-lookalike identifiers');
SELECT ok(NOT app_private.is_n11_hygiene_fixture_id(NULL), 'rejects null fixture identifiers');

SELECT ok(has_function_privilege('authenticated', 'public.data_hygiene_n11_apply_qa(jsonb,text)', 'EXECUTE'), 'authenticated may call the guarded apply wrapper');
SELECT ok(NOT has_function_privilege('anon', 'public.data_hygiene_n11_apply_qa(jsonb,text)', 'EXECUTE'), 'anonymous role cannot call apply');
SELECT ok(NOT has_function_privilege('authenticated', 'app_private.apply_data_hygiene_n11_legacy(jsonb,text)', 'EXECUTE'), 'authenticated cannot bypass the guarded wrapper');
SELECT ok(NOT has_function_privilege('authenticated', 'app_private.internal_staff_role_can_write(text)', 'EXECUTE'), 'role policy helper is not callable through the API');
SELECT ok(NOT has_function_privilege('authenticated', 'app_private.internal_staff_role_can_write_financially(text)', 'EXECUTE'), 'financial role policy helper is not callable through the API');

SELECT ok(position('internal_staff_role_can_write' in lower(pg_get_functiondef('app_private.require_internal_staff_write()'::regprocedure))) > 0, 'general write guard uses the role policy helper');
SELECT ok(position('internal_staff_role_can_write_financially' in lower(pg_get_functiondef('app_private.require_internal_financial_write()'::regprocedure))) > 0, 'financial write guard uses the financial role policy helper');
SELECT ok(position('membership.status = ''active''' in lower(pg_get_functiondef('app_private.require_internal_staff_write()'::regprocedure))) > 0 AND position('membership.revoked_at is null' in lower(pg_get_functiondef('app_private.require_internal_staff_write()'::regprocedure))) > 0, 'general write guard requires active, non-revoked membership');
SELECT ok(position('membership.status = ''active''' in lower(pg_get_functiondef('app_private.require_internal_financial_write()'::regprocedure))) > 0 AND position('membership.revoked_at is null' in lower(pg_get_functiondef('app_private.require_internal_financial_write()'::regprocedure))) > 0, 'financial write guard requires active, non-revoked membership');

SELECT ok(position('is_n11_hygiene_fixture_id' in pg_get_functiondef('public.data_hygiene_n11_apply_qa(jsonb,text)'::regprocedure)) > 0, 'apply wrapper enforces the literal fixture prefix');
SELECT ok(EXISTS (
  SELECT 1
  FROM pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'app_private.data_hygiene_actions'::regclass
    AND constraint_row.conname = 'data_hygiene_actions_literal_fixture_prefix_check'
    AND position('is_n11_hygiene_fixture_id' in pg_get_constraintdef(constraint_row.oid)) > 0
), 'audit constraint enforces the literal fixture prefix');

SELECT * FROM finish();
ROLLBACK;
