import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261002170000_n56_preproduction_security_hardening.sql'), 'utf8')

describe('N5.6 pre-production security hardening migration', () => {
  it('removes anonymous table access without removing authenticated or service-role workflow grants', () => {
    expect(migration).toContain('revoke all on table public.expenses from public, anon')
    expect(migration).toContain('revoke all on table public.expense_capture_sessions from public, anon')
    expect(migration).not.toContain('revoke all on table storage.objects from public, anon')
    expect(migration).toContain('drop policy if exists "Allow authenticated read expense receipts" on storage.objects')
    expect(migration).toContain('drop policy if exists "Allow authenticated upload expense receipts" on storage.objects')
    expect(migration).toContain('drop policy if exists "Allow authenticated update expense receipts" on storage.objects')
    expect(migration).toContain('drop policy if exists "Allow authenticated delete expense receipts" on storage.objects')
    expect(migration).toContain('create policy "Internal staff read expense receipts"')
    expect(migration).toContain('create policy "Internal staff upload expense receipts"')
    expect(migration).toContain('create policy "Internal staff update expense receipts"')
    expect(migration).toContain('create policy "Internal staff delete expense receipts"')
    expect(migration).toContain("name like 'expenses/%'")
    expect(migration).toContain("name ~ '^expenses/[^/]+/[A-Za-z0-9_.-]+
    expect(migration).toContain('grant execute on function public.confirm_expense_capture')
    expect(migration).toContain('to authenticated, service_role')
  })

  it('keeps expenses internal-staff-only and leaves capture runtime helpers server-side', () => {
    expect(migration).toContain('app_private.is_active_internal_staff((select auth.uid()))')
    expect(migration).toContain('revoke all on function public.n52_prepare_extraction')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.n53_finalize_normalization_success')
    expect(migration).toContain('to service_role')
  })
})
")
    expect(migration).toContain("bucket_id = 'expense-receipts'")
    expect(migration).toContain('grant execute on function public.confirm_expense_capture')
    expect(migration).toContain('to authenticated, service_role')
  })

  it('keeps expenses internal-staff-only and leaves capture runtime helpers server-side', () => {
    expect(migration).toContain('app_private.is_active_internal_staff((select auth.uid()))')
    expect(migration).toContain('revoke all on function public.n52_prepare_extraction')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.n53_finalize_normalization_success')
    expect(migration).toContain('to service_role')
  })
})
