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

  it('requires an active financial role before CREATE_NEW can return or write', () => {
    const gate = migration.indexOf("p_duplicate_decision = 'create_new' and not exists")
    const idempotencyLookup = migration.indexOf('where created_by = p_authenticated_user_id and idempotency_key = trim(p_idempotency_key)')
    const expenseInsert = migration.indexOf('insert into public.expenses')
    expect(gate).toBeGreaterThan(migration.indexOf('n55_confirmation_staff_required'))
    expect(gate).toBeLessThan(idempotencyLookup)
    expect(gate).toBeLessThan(expenseInsert)
    expect(migration).toContain("membership.status = 'active'")
    expect(migration).toContain('membership.revoked_at is null')
    expect(migration).toContain('app_private.internal_staff_role_can_write_financially(membership.role)')
    expect(migration).toContain("raise exception 'n55_financial_staff_required' using errcode = '42501'")
  })
})
