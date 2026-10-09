import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260922200501_n21_atomic_business_graph.sql'), 'utf8')
const flow = readFileSync(resolve(process.cwd(), 'src/v3/invoices/V3InvoiceCreateFlow.tsx'), 'utf8')

describe('N2.1 atomic business graph contract', () => {
  it('keeps the migration self-contained and isolated', () => {
    expect(migration).toContain('save_invoice_business_graph')
    expect(migration).toContain('settle_invoice_business')
    expect(migration).toContain('invoice_business_operations')
    expect(migration).toContain('invoice_settlement_operations')
    expect(migration).toContain("'invoice_auto_service'")
    expect(migration).not.toMatch(/Hotel Las Vegas|PRO-0018|schema_migrations|portal_private|db push/iu)
  })

  it('keeps the invoice flow on five governed business decisions', () => {
    expect(flow).toContain('Cliente e inmueble')
    expect(flow).toContain('Servicio')
    expect(flow).toContain('Conceptos')
    expect(flow).toContain('Facturación')
    expect(flow).toContain('Revisar')
    expect(flow).toContain('AUTO_CREATE')
    expect(flow).toContain('EXISTING_JOB')
    expect(flow).toContain('FROM_QUOTE')
    expect(flow).toContain('saveInvoiceBusinessGraph')
  })
})
