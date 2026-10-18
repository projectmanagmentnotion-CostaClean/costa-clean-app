import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20260922104759_n11a_app_internal_staff_authorization.sql', import.meta.url), 'utf8')
const normalized = migration.toLowerCase().replace(/\s+/g, ' ')
const rolePredicateMigration = readFileSync(new URL('../../supabase/migrations/20260922115842_n11c_testable_internal_staff_role_predicates.sql', import.meta.url), 'utf8').toLowerCase().replace(/\s+/g, ' ')

describe('N1.1A APP internal staff authorization migration', () => {
  it('adopts one membership source idempotently and validates instead of rewriting existing rows', () => {
    expect(normalized).toContain('create table if not exists public.internal_staff_memberships')
    expect(normalized).toContain('user_id uuid primary key references auth.users(id) on delete restrict')
    expect(normalized).toContain("role in ('owner', 'admin', 'operator', 'finance', 'readonly')")
    expect(normalized).toContain("status in ('active', 'suspended', 'revoked')")
    expect(normalized).toContain('app internal-staff membership relation has an incompatible column contract')
    expect(normalized).not.toMatch(/insert\s+into\s+public\.internal_staff_memberships/)
    expect(normalized).not.toMatch(/update\s+public\.internal_staff_memberships/)
    expect(normalized).not.toMatch(/delete\s+from\s+public\.internal_staff_memberships/)
  })

  it('keeps the app-private authorization boundary inaccessible to API roles', () => {
    expect(normalized).toContain('create schema if not exists app_private')
    expect(normalized).toContain('revoke all on schema app_private from public, anon, authenticated, service_role')
    expect(normalized).toContain('revoke all on function app_private.is_active_internal_staff(uuid) from public, anon, authenticated, service_role')
    expect(normalized).toContain('revoke all on function app_private.require_active_internal_staff() from public, anon, authenticated, service_role')
    expect(normalized).toContain('revoke all on function app_private.require_internal_staff_write() from public, anon, authenticated, service_role')
    expect(normalized).toContain('revoke all on function app_private.require_internal_financial_write() from public, anon, authenticated, service_role')
    expect(normalized).toContain("set search_path = ''")
    expect(normalized).not.toContain('portal_private')
  })

  it('routes general and financial writes through distinct APP-owned role authorization checks', () => {
    expect(normalized).toContain('create or replace function public.require_authenticated_write()')
    expect(normalized).toContain('create or replace function public.require_authenticated_financial_write()')
    expect(normalized).toContain('perform app_private.require_internal_staff_write();')
    expect(normalized).toContain('perform app_private.require_internal_financial_write();')
    expect(rolePredicateMigration).toContain("array['owner', 'admin', 'operator', 'finance']::text[]")
    expect(rolePredicateMigration).toContain("array['owner', 'admin', 'finance']::text[]")
    expect(rolePredicateMigration).toContain('membership.status = \'active\'')
    expect(rolePredicateMigration).toContain('membership.revoked_at is null')
    expect(normalized).toContain("using errcode = '42501'")
    expect(normalized).toContain('revoke execute on function public.require_authenticated_write() from public, anon, authenticated')
    expect(normalized).toContain('revoke execute on function public.require_authenticated_financial_write() from public, anon, authenticated')
  })
})
