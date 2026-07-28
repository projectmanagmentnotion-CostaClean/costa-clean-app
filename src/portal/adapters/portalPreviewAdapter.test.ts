import { describe, expect, it } from 'vitest'
import {
  createPortalPreviewAdapter,
  readPortalPreviewScenario,
} from './portalPreviewAdapter'

describe('portal development preview adapter', () => {
  it('accepts only allowlisted local preview scenarios', () => {
    expect(readPortalPreviewScenario('?portalPreview=authenticated')).toBe('authenticated')
    expect(readPortalPreviewScenario('?portalPreview=revoked')).toBe('revoked')
    expect(readPortalPreviewScenario('?portalPreview=admin')).toBe('unauthenticated')
  })

  it('returns unmistakably synthetic, client-scoped DTOs', async () => {
    const adapter = createPortalPreviewAdapter('authenticated')
    const account = await adapter.reads.getAccountContext()
    const properties = await adapter.reads.listProperties()
    const invoices = await adapter.reads.listInvoices()

    expect(account.clientContextId).toBe('client-demo-cp3a')
    expect(account.isSynthetic).toBe(true)
    expect(properties.every((property) => property.isSynthetic)).toBe(true)
    expect(invoices.every((invoice) => invoice.isSynthetic)).toBe(true)
    expect(invoices[0]?.issuedLabel.includes('sin validez fiscal')).toBe(true)
  })

  it('does not infer a client from an unauthenticated preview', async () => {
    const adapter = createPortalPreviewAdapter('unauthenticated')
    const resolution = await adapter.access.resolveAccess()

    expect(resolution).toMatchObject({
      status: 'unauthenticated',
    })
  })
})
