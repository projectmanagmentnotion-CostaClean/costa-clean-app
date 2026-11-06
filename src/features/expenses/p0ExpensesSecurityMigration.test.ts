import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../../supabase/migrations/20261102120000_p0_expense_access_and_rpc_hardening.sql', import.meta.url), 'utf8').toLowerCase()
const matrix = readFileSync(new URL('../../../supabase/qa/p0_expenses_security_matrix.sql', import.meta.url), 'utf8').toLowerCase()
const rollback = readFileSync(new URL('../../../docs/evidence/P0_PRODUCTION_ROLLBACK_20261105.sql', import.meta.url), 'utf8').toLowerCase()

describe('P0 expenses privilege hardening contract', () => {
  it('removes non-RLS table maintenance privileges while preserving service-role grants', () => {
    expect(migration).toContain('revoke delete, truncate, maintain, references, trigger on table public.expenses from authenticated')
    expect(migration).toContain('revoke all on table public.expenses from public, anon')
    expect(migration).toContain('grant select, insert, update, delete on table public.expenses to service_role')
    expect(matrix).toContain("not has_table_privilege('anon', 'public.expenses', 'maintain')")
    expect(matrix).toContain("not has_table_privilege('authenticated', 'public.expenses', 'maintain')")
    expect(matrix).toContain("has_table_privilege('service_role', 'public.expenses', 'maintain')")
  })

  it('retains the transactional rollback boundary in the role matrix', () => {
    expect(matrix).toMatch(/^begin;/mu)
    expect(matrix).toMatch(/^rollback;/mu)
    expect(matrix).not.toMatch(/^commit;/mu)
  })

  it('keeps the compensating rollback target-bound, transactional, and scoped to the captured prestate', () => {
    expect(rollback).toContain("current_setting('app.p0.rollback_project_ref') <> 'wfxnwfcdjainpojhbdri'")
    expect(rollback).toContain('grant insert, update, delete, truncate, references, trigger, maintain')
    expect(rollback).toContain('to anon')
    expect(rollback).toContain('to authenticated')
    expect(rollback).toContain('grant execute on function public.debug_run_authorized_invoice_batch()')
    expect(rollback).toContain('drop function public.expense_staff_access(boolean)')
    expect(rollback).toMatch(/^begin;/mu)
    expect(rollback).toMatch(/^commit;/mu)
    expect(rollback).not.toContain('cascade')
  })
})
