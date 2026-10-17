import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923150000_n4_recurring_service_plans.sql', 'utf8')
const functionBody = migration.slice(migration.indexOf('create or replace function public.set_recurring_service_plan_status'))

describe('N4 guarded internal-staff probe contract', () => {
  it('checks authorization before invalid status and update', () => {
    const authIndex = functionBody.indexOf('perform public.require_authenticated_financial_write()')
    const validationIndex = functionBody.indexOf("raise exception 'recurring_status_invalid'")
    const updateIndex = functionBody.indexOf('update public.recurring_service_plans')
    expect(authIndex).toBeGreaterThanOrEqual(0)
    expect(validationIndex).toBeGreaterThan(authIndex)
    expect(updateIndex).toBeGreaterThan(validationIndex)
  })

  it('keeps the probe invalid and non-mutating', () => {
    const helper = readFileSync('scripts/qa/qaInternalStaffAuth.mjs', 'utf8')
    expect(helper).toContain('__QA_AUTH_PROBE_INVALID_STATUS__')
    expect(helper).toContain('__QA_AUTH_PROBE_DO_NOT_EXIST__')
    expect(helper).not.toContain("from('internal_staff_memberships')")
  })
})
