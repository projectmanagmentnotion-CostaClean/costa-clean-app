import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20260923120000_n2_atomic_financial_operation.sql', import.meta.url),
  'utf8',
)

describe('N2 atomic financial operation contract', () => {
  it('uses one authenticated RPC boundary and preserves rollback semantics', () => {
    expect(migration).toMatch(/create or replace function public\.create_atomic_financial_operation/iu)
    expect(migration).toMatch(/perform public\.require_authenticated_financial_write\(\)/u)
    expect(migration).toMatch(/perform public\.save_job_with_lines/iu)
    expect(migration).toMatch(/perform public\.save_invoice_with_lines_v2/iu)
    expect(migration).toMatch(/perform public\.save_payment_and_refresh_invoice/iu)
    expect(migration).not.toMatch(/commit\s*;/iu)
    expect(migration).not.toMatch(/rollback\s*;/iu)
    expect(migration).toMatch(/grant execute on function public\.create_atomic_financial_operation[\s\S]*to authenticated/iu)
  })

  it('rejects invalid relationships and server-side total inconsistencies', () => {
    expect(migration).toMatch(/property_client_mismatch/u)
    expect(migration).toMatch(/quote_client_mismatch/u)
    expect(migration).toMatch(/job_relationship_mismatch/u)
    expect(migration).toMatch(/invoice_line_totals_invalid/u)
    expect(migration).toMatch(/invoice_totals_invalid/u)
    expect(migration).toMatch(/payment_amount_invalid/u)
  })

  it('persists stable idempotency receipts and rejects payload conflicts', () => {
    expect(migration).toMatch(/financial_operation_idempotency/u)
    expect(migration).toMatch(/on conflict \(idempotency_key\) do nothing/iu)
    expect(migration).toMatch(/idempotency_conflict/u)
    expect(migration).toMatch(/if v_existing\.result is not null then[\s\S]*return v_existing\.result/iu)
  })

  it('covers rollback-triggering failures without swallowing exceptions', () => {
    for (const code of [
      'job_lines_required',
      'invoice_line_totals_invalid',
      'invoice_totals_invalid',
      'payment_invoice_mismatch',
      'payment_amount_invalid',
      'atomic_financial_operation_readback_failed',
    ]) {
      expect(migration).toMatch(new RegExp(code, 'u'))
    }
    expect(migration).toMatch(/if p_payment is not null then[\s\S]*perform public\.save_payment_and_refresh_invoice/iu)
  })

  it('supports both invoice-only and invoice-with-payment paths', () => {
    expect(migration).toMatch(/p_payment jsonb default null/iu)
    expect(migration).toMatch(/if p_payment is not null then/iu)
    expect(migration).toMatch(/'payment_created', p_payment is not null/iu)
  })
})
