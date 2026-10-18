import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('./expenseCaptureApi.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../../supabase/migrations/20260924140000_n51_smart_expense_capture.sql', import.meta.url), 'utf8').toLowerCase()
const qaRepair = readFileSync(new URL('../../../supabase/qa-migrations/20260928120000_n51_restore_authenticated_read_grants_qa.sql', import.meta.url), 'utf8').toLowerCase()

describe('N5.1 safety contract', () => {
  it('never creates an expense from capture', () => {
    expect(api).not.toMatch(/insert\s+into\s+public\.expenses|\bupdateExpense\s*\(/u)
    expect(api).not.toContain('service_role')
  })

  it('keeps capture data private and scoped to authenticated internal staff', () => {
    expect(migration).toContain('alter table public.expense_capture_sessions enable row level security')
    expect(migration).toContain("grant execute on function public.create_expense_capture_session(text, text) to authenticated")
    expect(migration).toContain("revoke all on function public.create_expense_capture_session(text, text) from public, anon")
    expect(migration).toContain("bucket_id = 'expense-receipts'")
    expect(migration).toContain("(storage.foldername(name))[1] = 'captures'")
    expect(migration).toContain("public.expense_capture_sessions")
  })

  it('restores only authenticated read access required by storage policy evaluation', () => {
    expect(migration).toContain('grant select on public.expense_capture_sessions to authenticated')
    expect(migration).toContain('grant select on public.expense_capture_documents to authenticated')
    expect(migration).not.toMatch(/grant\s+(?:select,\s*)?(?:insert|update|delete)[^;]*to\s+authenticated/u)
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete)[^;]*to\s+authenticated/u)

    const sessionRevoke = migration.indexOf('revoke all on public.expense_capture_sessions')
    const sessionGrant = migration.indexOf('grant select on public.expense_capture_sessions to authenticated')
    const documentsRevoke = migration.indexOf('revoke all on public.expense_capture_documents')
    const documentsGrant = migration.indexOf('grant select on public.expense_capture_documents to authenticated')
    expect(sessionGrant).toBeGreaterThan(sessionRevoke)
    expect(documentsGrant).toBeGreaterThan(documentsRevoke)
  })

  it('keeps RLS, FORCE RLS, and storage ownership boundaries unchanged', () => {
    expect(migration).toContain('alter table public.expense_capture_sessions force row level security')
    expect(migration).toContain('alter table public.expense_capture_documents force row level security')
    expect(migration).toContain("bucket_id = 'expense-receipts'")
    expect(migration).toContain("(storage.foldername(name))[1] = 'captures'")
    expect(migration).toContain('s.created_by = (select auth.uid())')
    expect(migration).toContain('app_private.is_active_internal_staff((select auth.uid()))')
  })

  it('keeps the QA repair forward-only and limited to the two SELECT grants', () => {
    expect(qaRepair).toContain('grant select on public.expense_capture_sessions to authenticated')
    expect(qaRepair).toContain('grant select on public.expense_capture_documents to authenticated')
    expect(qaRepair).not.toMatch(/grant\s+(?:insert|update|delete)/u)
    expect(qaRepair).not.toMatch(/revoke|drop policy|create policy|alter table|insert\s+into|update\s+public|delete\s+from/u)
    expect(qaRepair).not.toContain('service_role')
    expect(qaRepair).not.toContain('production')
  })
})
