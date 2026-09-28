import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('./expenseCaptureApi.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../../supabase/migrations/20260924140000_n51_smart_expense_capture.sql', import.meta.url), 'utf8').toLowerCase()

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
})
