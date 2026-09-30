import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { canonicalSerialize, buildNormalizationIdentity, NORMALIZER_IMPLEMENTATION_VERSION } from '../../../supabase/functions/_shared/n53Normalization.ts'

const migration = readFileSync(new URL('../../../supabase/migrations/20260930095656_n53_expense_capture_normalization_runtime.sql', import.meta.url), 'utf8').toLowerCase()

describe('N5.3 server runtime local contract', () => {
  it('sorts object keys but preserves array order', () => {
    expect(canonicalSerialize({ b: 2, a: 1, lines: [{ rate: '10' }, { rate: '21' }] })).toBe('{"a":1,"b":2,"lines":[{"rate":"10"},{"rate":"21"}]}')
    expect(canonicalSerialize({ lines: [{ rate: '21' }, { rate: '10' }] })).not.toBe(canonicalSerialize({ lines: [{ rate: '10' }, { rate: '21' }] }))
  })

  it('derives stable identities from the authoritative proposal and version', async () => {
    const proposal = { schemaVersion: 1, vatLines: [{ rate: '10' }, { rate: '21' }], missing: null }
    const first = await buildNormalizationIdentity('11111111-1111-4111-8111-111111111111', proposal as never, 1)
    const second = await buildNormalizationIdentity('11111111-1111-4111-8111-111111111111', proposal as never, 1)
    expect(first).toEqual(second)
    expect(first.inputHash).toMatch(/^[0-9a-f]{64}$/u)
    expect(first.normalizationKey).toMatch(/^[0-9a-f]{64}$/u)
    expect(NORMALIZER_IMPLEMENTATION_VERSION).toBe('n5.3-normalizer-v1')
  })

  it('binds the migration to trusted identity, partial uniqueness and terminal states', () => {
    expect(migration).toContain('p_authenticated_user_id uuid')
    expect(migration).toContain('for update')
    expect(migration).toContain("where status in ('processing', 'succeeded')")
    expect(migration).toContain('normalization_stale_attempt')
    expect(migration).toContain("extensions.digest(convert_to(p_normalization_key || '|' || v_attempt::text, 'utf8'), 'sha256')")
    expect(migration).toContain('grant execute on function public.n53_claim_normalization')
    expect(migration).toContain('revoke all on public.expense_capture_normalizations from public, anon, authenticated, service_role')
    expect(migration).not.toContain("status in ('pending'")
  })

  it('keeps the Edge entrypoint client-minimal and financially isolated', () => {
    const edge = readFileSync(new URL('../../../supabase/functions/expense-document-normalization/index.ts', import.meta.url), 'utf8')
    expect(edge).toContain('extractionId')
    expect(edge).toContain('p_authenticated_user_id')
    expect(edge).toContain('require_n52_active_internal_staff')
    expect(edge).toContain('normalizeExpenseProposal')
    expect(edge).not.toMatch(/create_expense|createExpense|insert.*expenses|insert.*invoices|insert.*payments/iu)
  })
})
