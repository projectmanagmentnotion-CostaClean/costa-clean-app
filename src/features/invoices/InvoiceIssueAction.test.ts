import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InvoiceIssueAction } from './InvoiceIssueAction'
import {
  getInvoiceIssueConfirmationDescription,
  getInvoiceIssueEnvironmentLabel,
} from './invoiceIssueFlow'
import type { InvoiceListItem } from './types'

function createInvoice(status: string): InvoiceListItem {
  return {
    id: 'INVOICE-ALCAPA',
    display_code: null,
    invoice_number: null,
    job_id: null,
    client_id: 'CLIENT-ALCAPA',
    client_name: 'ALCAPA SPORT SL',
    issue_date: '2026-11-03',
    status,
    subtotal: 2600,
    tax_amount: 546,
    total: 3146,
  }
}

describe('InvoiceIssueAction', () => {
  it('labels the confirmation with the configured Supabase environment', () => {
    const qaUrl = 'https://kpvvydthlxupjjqqdpxy.supabase.co'

    expect(getInvoiceIssueEnvironmentLabel(qaUrl)).toBe('QA')
    expect(getInvoiceIssueConfirmationDescription(qaUrl)).toContain('en QA ')
    expect(getInvoiceIssueConfirmationDescription(qaUrl)).not.toContain('Production')
    expect(getInvoiceIssueEnvironmentLabel('https://wfxnwfcdjainpojhbdri.supabase.co')).toBe('Production')
    expect(getInvoiceIssueEnvironmentLabel('https://unknown-project.supabase.co')).toBe('Supabase desconocido')
  })

  it('shows the independent issue action for a draft', () => {
    const html = renderToStaticMarkup(createElement(InvoiceIssueAction, {
      invoice: createInvoice('draft'),
      onInvoiceUpdated: async () => {},
    }))

    expect(html).toContain('Emitir factura')
  })

  it('does not show the issue action for an already issued invoice', () => {
    const html = renderToStaticMarkup(createElement(InvoiceIssueAction, {
      invoice: createInvoice('issued'),
      onInvoiceUpdated: async () => {},
    }))

    expect(html).toBe('')
  })
})
