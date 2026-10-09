import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261002173000_expense_product_grant_hardening.sql'),
  'utf8',
)

describe('Product expense grant hardening migration', () => {
  it('removes only anonymous legacy expense relation grants', () => {
    expect(migration).toContain('revoke all on table public.expenses from public, anon')
    expect(migration).not.toContain('storage.objects')
    expect(migration).not.toContain('drop policy')
    expect(migration).not.toContain('create policy')
  })
})
