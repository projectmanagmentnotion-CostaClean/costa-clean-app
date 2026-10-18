import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261002170000_n56_preproduction_security_hardening.sql'), 'utf8')
const expenseReceiptPathPattern = /^expenses\/[^/]+\/[A-Za-z0-9][A-Za-z0-9_.-]*$/
const parentDirectorySegmentPattern = /(^|\/)\.\.(\/|$)/

function isSafeExpenseReceiptPath(path: string): boolean {
  return expenseReceiptPathPattern.test(path) && !parentDirectorySegmentPattern.test(path)
}

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

  it('keeps the migration complete and each policy/function grant unique', () => {
    expect(migration.match(/^begin;$/gim)).toHaveLength(1)
    expect(migration.match(/^commit;$/gim)).toHaveLength(1)
    expect(migration.match(/^create policy\b/gim)).toHaveLength(7)
    expect(migration.match(/^-- Browser-facing capture operations/gim)).toHaveLength(1)
    expect(migration.match(/^grant execute on function public\.confirm_expense_capture/gim)).toHaveLength(1)
    expect(migration).not.toMatch(/name ~ [^\r\n]+\r?\n\r?\n-- Browser-facing capture operations/)
  })

  it('limits new receipt paths to one safe filename and rejects parent traversal', () => {
    expect(migration).toContain("name ~ '^expenses/[^/]+/[A-Za-z0-9][A-Za-z0-9_.-]*$'")
    expect(migration.split(/\r?\n/).filter((line) => line.trim() === "and name !~ '(^|/)[.][.]($|/)'"))
      .toHaveLength(5)

    expect(isSafeExpenseReceiptPath('expenses/550e8400-e29b-41d4-a716-446655440000/2026-10-18-receipt.pdf')).toBe(true)

    for (const path of [
      'expenses/550e8400/../private.pdf',
      'expenses/../private.pdf',
      'expenses/550e8400/..',
      'expenses/550e8400/.hidden.pdf',
      'expenses/550e8400/subdir/receipt.pdf',
      'captures/550e8400/receipt.pdf',
    ]) {
      expect(isSafeExpenseReceiptPath(path), path).toBe(false)
    }
  })
})
