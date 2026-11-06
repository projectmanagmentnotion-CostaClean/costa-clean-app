import { describe, expect, it, vi } from 'vitest'
import { issueSelectedInvoice, type InvoiceIssueDependencies, type InvoiceIssueSnapshot } from './invoiceIssueFlow'

const selected = {
  id: 'INVOICE-ALCAPA',
  client_id: 'CLIENT-ALCAPA',
  status: 'draft',
  subtotal: 2600,
  tax_amount: 546,
  total: 3146,
  invoice_number: null,
}

function snapshot(overrides: Partial<InvoiceIssueSnapshot> = {}): InvoiceIssueSnapshot {
  return {
    ...selected,
    ...overrides,
  }
}

function dependencies(
  production: InvoiceIssueSnapshot | null = snapshot({ status: 'issued', invoice_number: '2026-082' }),
  overrides: Partial<InvoiceIssueDependencies> = {},
): InvoiceIssueDependencies {
  return {
    getAuthenticatedUserId: vi.fn().mockResolvedValue('internal-user-1'),
    readInvoice: vi.fn().mockResolvedValue(production),
    issueInvoice: vi.fn().mockResolvedValue(undefined),
    findInvoicesWithNumber: vi.fn().mockResolvedValue(['INVOICE-ALCAPA']),
    ...overrides,
  }
}

describe('official invoice issue flow', () => {
  it('issues the selected ID through the official status API and verifies its assigned number', async () => {
    const before = snapshot()
    const after = snapshot({ status: 'issued', invoice_number: '2026-082' })
    const readInvoice = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after)
    const deps = dependencies(null, { readInvoice })

    const result = await issueSelectedInvoice(selected, deps)

    expect(deps.issueInvoice).toHaveBeenCalledExactlyOnceWith('INVOICE-ALCAPA')
    expect(readInvoice).toHaveBeenNthCalledWith(1, 'INVOICE-ALCAPA')
    expect(readInvoice).toHaveBeenNthCalledWith(2, 'INVOICE-ALCAPA')
    expect(deps.findInvoicesWithNumber).toHaveBeenCalledExactlyOnceWith('2026-082')
    expect(result.invoice.status).toBe('issued')
    expect(result.invoice.invoice_number).toBe('2026-082')
  })

  it('blocks when the configured environment returns a different invoice ID', async () => {
    const deps = dependencies(snapshot({ id: 'INVOICE-HOTEL' }))

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('no coincide con el entorno configurado')
    expect(deps.issueInvoice).not.toHaveBeenCalled()
  })

  it('blocks when the configured environment amounts differ from the selected invoice', async () => {
    const deps = dependencies(snapshot({ total: 4424.97 }))

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('no coincide con el entorno configurado')
    expect(deps.issueInvoice).not.toHaveBeenCalled()
  })

  it('blocks an unauthenticated user before reading or issuing', async () => {
    const deps = dependencies(snapshot(), { getAuthenticatedUserId: vi.fn().mockResolvedValue(null) })

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('Inicia sesión')
    expect(deps.readInvoice).not.toHaveBeenCalled()
    expect(deps.issueInvoice).not.toHaveBeenCalled()
  })

  it('never issues a record that is no longer a draft or already has a number', async () => {
    const deps = dependencies(snapshot({ status: 'issued', invoice_number: '2026-070' }))

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('no coincide con el entorno configurado')
    expect(deps.issueInvoice).not.toHaveBeenCalled()
  })

  it('blocks if the authenticated RPC reports an authorization failure and the configured environment remains a draft', async () => {
    const deps = dependencies(snapshot(), {
      issueInvoice: vi.fn().mockRejectedValue(new Error('not authorized for internal financial write')),
    })

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('not authorized for internal financial write')
  })

  it('does not claim success unless readback shows issued status and a unique fiscal number', async () => {
    const deps = dependencies(snapshot())

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('no confirma la emisión')
    expect(deps.findInvoicesWithNumber).not.toHaveBeenCalled()
  })

  it('reports an ambiguous RPC result as persisted and numbered without encouraging a retry', async () => {
    const after = snapshot({ status: 'issued', invoice_number: '2026-082' })
    const readInvoice = vi.fn().mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(after)
    const deps = dependencies(null, {
      readInvoice,
      issueInvoice: vi.fn().mockRejectedValue(new Error('audit call timed out')),
    })

    const result = await issueSelectedInvoice(selected, deps)

    expect(result.invoice.invoice_number).toBe('2026-082')
    expect(result.warning).toContain('audit call timed out')
  })

  it('rejects a fiscal number that is already used by another invoice', async () => {
    const readInvoice = vi.fn()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ status: 'issued', invoice_number: '2026-082' }))
    const deps = dependencies(null, {
      readInvoice,
      findInvoicesWithNumber: vi.fn().mockResolvedValue(['INVOICE-ALCAPA', 'INVOICE-OTHER']),
    })

    await expect(issueSelectedInvoice(selected, deps)).rejects.toThrow('unicidad no pudo verificarse')
  })
})
