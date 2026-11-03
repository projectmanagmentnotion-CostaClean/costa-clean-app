import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20260922113953_n11b_role_scoped_authorization_and_literal_hygiene_prefixes.sql', import.meta.url), 'utf8')
const normalized = migration.toLowerCase().replace(/\s+/g, ' ')
const predicateMigration = readFileSync(new URL('../../supabase/migrations/20260922115842_n11c_testable_internal_staff_role_predicates.sql', import.meta.url), 'utf8').toLowerCase().replace(/\s+/g, ' ')
const databaseContractTest = readFileSync(new URL('../../supabase/tests/n11b_role_scoped_authorization_and_literal_prefixes_test.sql', import.meta.url), 'utf8').toLowerCase()

describe('N1.1B corrective role and literal-prefix migration', () => {
  it('allows general writes only for active owner, admin, operator, or finance memberships', () => {
    expect(normalized).toContain("array['owner', 'admin', 'operator', 'finance']::text[]")
    expect(normalized).toContain("membership.status = 'active'")
    expect(normalized).toContain('membership.revoked_at is null')
    expect(normalized).toContain('perform app_private.require_internal_staff_write()')
  })

  it('restricts financial writes to active owner, admin, or finance memberships', () => {
    expect(normalized).toContain("array['owner', 'admin', 'finance']::text[]")
    expect(normalized).toContain('perform app_private.require_internal_financial_write()')
    expect(normalized).not.toContain("array['owner', 'admin', 'operator', 'finance', 'readonly']::text[]")
  })

  it('defines the synthetic fixture namespace using literal prefix comparison', () => {
    expect(normalized).toContain("pg_catalog.left(p_entity_id, pg_catalog.length('qa_hygiene_n11_')) = 'qa_hygiene_n11_'")
    expect(normalized).toContain('check (app_private.is_n11_hygiene_fixture_id(entity_id))')
    expect(normalized).toContain('drop constraint data_hygiene_actions_entity_id_check')
  })

  it('filters plans by exact entity-kind prefixes rather than SQL LIKE patterns', () => {
    expect(normalized).toContain("pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('qa_hygiene_n11_relink_')) = 'qa_hygiene_n11_relink_'")
    expect(normalized).toContain("pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('qa_hygiene_n11_archive_')) = 'qa_hygiene_n11_archive_'")
    expect(normalized).toContain("pg_catalog.left(item.value ->> 'entity_id', pg_catalog.length('qa_hygiene_n11_ambiguous_')) = 'qa_hygiene_n11_ambiguous_'")
    expect(normalized).not.toContain("like 'qa_hygiene_n11_%'")
  })

  it('protects the already-deployed QA adapter with a role-gated literal-prefix wrapper', () => {
    expect(normalized).toContain('alter function public.data_hygiene_n11_apply_qa(jsonb, text) set schema app_private')
    expect(normalized).toContain('rename to apply_data_hygiene_n11_legacy')
    expect(normalized).toContain('perform app_private.require_internal_staff_write()')
    expect(normalized).toContain('return app_private.apply_data_hygiene_n11_legacy(p_plan, p_plan_hash)')
    expect(normalized).toContain('plan contains an entity outside the literal synthetic qa fixture namespace')
    expect(normalized).toContain('revoke all on function app_private.apply_data_hygiene_n11_legacy(jsonb, text) from public, anon, authenticated, service_role')
    expect(normalized).not.toMatch(/execute\s+format\s*\(/)
  })

  it('includes executable pgTAP cases for the authorization and prefix matrix', () => {
    expect(databaseContractTest).toContain('select plan(27)')
    expect(databaseContractTest.match(/select (?:throws_ok|lives_ok|ok)\(/g)).toHaveLength(27)
    expect(databaseContractTest).toContain("internal_staff_role_can_write('readonly')")
    expect(databaseContractTest).toContain("internal_staff_role_can_write_financially('operator')")
    expect(databaseContractTest).toContain("is_n11_hygiene_fixture_id('qa-hygiene-n11-archive_x')")
    expect(databaseContractTest).toContain("from pg_constraint as constraint_row")
    expect(databaseContractTest).toContain("constraint_row.conrelid = 'app_private.data_hygiene_actions'::regclass")
    expect(databaseContractTest).toContain("constraint_row.conname = 'data_hygiene_actions_literal_fixture_prefix_check'")
    expect(databaseContractTest).toContain("'operator cannot perform financial writes'")
    expect(databaseContractTest).toContain("'readonly cannot perform general writes'")
    expect(databaseContractTest).toContain('rollback;')
  })

  it('extracts role decisions into deterministic private predicates and retains active-membership guards', () => {
    expect(predicateMigration).toContain("array['owner', 'admin', 'operator', 'finance']::text[]")
    expect(predicateMigration).toContain("array['owner', 'admin', 'finance']::text[]")
    expect(predicateMigration).toContain('not app_private.internal_staff_role_can_write(v_role)')
    expect(predicateMigration).toContain('not app_private.internal_staff_role_can_write_financially(v_role)')
    expect(predicateMigration).toContain("membership.status = 'active'")
    expect(predicateMigration).toContain('membership.revoked_at is null')
    expect(predicateMigration).toContain('revoke all on function app_private.internal_staff_role_can_write(text) from public, anon, authenticated, service_role')
  })
})
