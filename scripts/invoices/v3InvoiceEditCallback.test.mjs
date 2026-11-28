import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const v3InvoicesPage = readFileSync('src/v3/invoices/V3InvoicesPage.tsx', 'utf8')
const invoicesPage = readFileSync('src/pages/InvoicesPage.tsx', 'utf8')

describe('V3 invoice edit callback contract', () => {
  it('passes the selected invoice to the parent before opening the edit flow', () => {
    expect(v3InvoicesPage).toContain('onEditInvoice={() => onEditInvoice(selectedInvoice)}')
    expect(v3InvoicesPage).toContain('onEditInvoice(invoice) }}>Editar factura')
    expect(invoicesPage).toMatch(/onEditInvoice=\{\(invoice\)\s*=>\s*\{\s*setSelectedInvoiceId\(invoice\.id\)\s*setShowMajorEdit\(true\)/)
  })
})
