import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../../supabase/migrations/20261001170000_n55_confirm_expense_capture.sql', import.meta.url), 'utf8').toLowerCase()

describe('N5.5 confirmation persistence contract', () => {
  it('uses one authenticated transaction boundary with ownership and idempotency', () => {
    expect(migration).toContain('create table if not exists public.expense_capture_confirmations')
    expect(migration).toContain('create or replace function public.confirm_expense_capture')
    expect(migration).toContain('p_authenticated_user_id <> auth.uid()')
    expect(migration).toContain('n.status = \'succeeded\'')
    expect(migration).toContain('unique (created_by, idempotency_key)')
    expect(migration).toContain("set status = 'completed'")
    expect(migration).toContain('grant execute on function public.confirm_expense_capture')
  })

  it('does not grant direct table mutation or service-role client execution', () => {
    expect(migration).toContain('revoke all on public.expense_capture_confirmations from public, anon, authenticated, service_role')
    expect(migration).not.toContain('grant insert, update, delete on public.expense_capture_confirmations')
    expect(migration).not.toContain('grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to service_role')
    expect(migration).toContain('grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to authenticated')
  })
})
