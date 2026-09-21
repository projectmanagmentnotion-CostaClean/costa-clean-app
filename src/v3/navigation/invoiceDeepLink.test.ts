import { describe, expect, it } from 'vitest'
import { readInvoiceDeepLink, readInvoiceFilterDeepLink } from './invoiceDeepLink'

describe('invoice deep-link contract', () => {
  it('reads invoice identity without changing the existing view contract', () => {
    expect(readInvoiceDeepLink('?view=invoices&filter=overdue&invoice=inv-42')).toBe('inv-42')
  })

  it('maps the supported overdue filter to the existing module filter', () => {
    expect(readInvoiceFilterDeepLink('?view=invoices&filter=overdue')).toBe('unpaid_older_7d')
    expect(readInvoiceFilterDeepLink('?view=invoices&filter=unknown')).toBeNull()
  })
})
