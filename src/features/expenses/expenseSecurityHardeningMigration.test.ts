import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261002170000_n56_preproduction_security_hardening.sql'), 'utf8')

describe('N5.6 pre-production security hardening migration', () => {
  it('preserves Supabase-managed Storage table ACL while closing broad receipts policies', () => {
    expect(migration).toContain('revoke all on table public.expenses from public, anon')
    expect(migration).toContain('revoke all on table public.expense_capture_sessions from public, anon')
    expect(migration).not.toContain('revoke all on table storage.objects from public, anon')
    for (const name of [
      'Allow authenticated read expense receipts',
      'Allow authenticated upload expense receipts',
      'Allow authenticated update expense receipts',
      'Allow authenticated delete expense receipts',
    ]) {
      expect(migration).toContain('drop policy if exists "' + name + '" on storage.objects')
    }
    for (const operation of ['read', 'upload', 'update', 'delete']) {
      expect(migration).toContain('create policy "Internal staff ' + operation + ' expense receipts"')
    }
    expect(migration).toContain("bucket_id = 'expense-receipts'")
    expect(migration).toContain("name like 'expenses/%'")
    expect(migration).toContain('app_private.is_active_internal_staff((select auth.uid()))')
    expect(migration).toContain('grant execute on function public.confirm_expense_capture')
    expect(migration).toContain('to authenticated, service_role')
  })

  it('keeps expenses internal-staff-only and capture helpers server-side', () => {
    expect(migration).toContain('revoke all on function public.n52_prepare_extraction')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.n53_finalize_normalization_success')
    expect(migration).toContain('to service_role')
  })
})
