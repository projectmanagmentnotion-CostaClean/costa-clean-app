import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../../supabase/migrations/20261001213000_n55_confirm_expense_capture_concurrency.sql', import.meta.url), 'utf8').toLowerCase()

describe('N5.5 confirmation concurrency correction contract', () => {
  it('locks the owned session before the idempotency re-check', () => {
    const ownershipCheck = migration.indexOf('where id = p_capture_session_id and created_by = p_authenticated_user_id;')
    const sessionLock = migration.indexOf('where id = p_capture_session_id and created_by = p_authenticated_user_id\n  for update;')
    const idempotencyLookup = migration.indexOf('where created_by = p_authenticated_user_id and idempotency_key = trim(p_idempotency_key);')
    expect(ownershipCheck).toBeGreaterThanOrEqual(0)
    expect(sessionLock).toBeGreaterThan(ownershipCheck)
    expect(idempotencyLookup).toBeGreaterThan(sessionLock)
    expect(migration).toContain('re-check idempotency while the session lock is held')
  })

  it('preserves the authenticated RPC boundary and atomic expense path', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = pg_catalog, public, app_private, pg_temp')
    expect(migration).toContain('p_authenticated_user_id <> auth.uid()')
    expect(migration).toContain("raise exception 'n55_confirmation_idempotency_mismatch'")
    expect(migration).toContain('insert into public.expenses')
    expect(migration).toContain('insert into public.expense_capture_confirmations')
    expect(migration).toContain("grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to authenticated")
    expect(migration).not.toContain('grant execute on function public.confirm_expense_capture(uuid, uuid, uuid, uuid, text, text, uuid, jsonb) to service_role')
  })
})
