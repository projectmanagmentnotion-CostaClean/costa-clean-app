import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261002150000_invoice_service_reference_override.sql'), 'utf8')

describe('invoice service/reference override migration', () => {
  it('adds only the nullable dedicated override and preserves write compatibility', () => {
    expect(migration).toContain('add column if not exists service_reference_override text')
    expect(migration).toContain('v_has_service_reference_override boolean')
    expect(migration).toContain("nullif(btrim(p_invoice ->> 'service_reference_override'), '')")
    expect(migration).toContain('when v_has_service_reference_override then v_service_reference_override')
    expect(migration).toContain('else public.invoices.service_reference_override')
    expect(migration).not.toMatch(/notes\s*=\s*.*service_reference_override/iu)
  })

  it('does not alter invoice lines, relations, or financial invariants in the replacement RPC', () => {
    expect(migration).toContain('delete from public.invoice_lines where invoice_id = v_invoice_id')
    expect(migration).toContain('job_id = excluded.job_id')
    expect(migration).toContain('property_id = excluded.property_id')
    expect(migration).toContain('subtotal = excluded.subtotal')
    expect(migration).toContain('tax_amount = excluded.tax_amount')
    expect(migration).toContain('total = excluded.total')
  })
})
