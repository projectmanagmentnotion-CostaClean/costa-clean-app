import { describe, expect, it } from 'vitest'
import {
  createPortalPreviewAdapter,
  readPortalPreviewScenario,
} from './portalPreviewAdapter'
import type { PortalLifecycleResolution } from '../contracts'

describe('portal development preview adapter', () => {
  it('accepts only allowlisted local preview scenarios', () => {
    expect(readPortalPreviewScenario('?portalPreview=active_admin')).toBe('active_admin')
    expect(readPortalPreviewScenario('?portalPreview=revoked')).toBe('revoked')
    expect(readPortalPreviewScenario('?portalPreview=admin')).toBe('offline')
    expect(readPortalPreviewScenario('')).toBeNull()
  })

  it('returns unmistakably synthetic, client-scoped DTOs', async () => {
    const adapter = createPortalPreviewAdapter('active_admin')
    if (!adapter.reads) throw new Error('Preview reads are required.')
    const account = await adapter.reads.getAccountContext()
    const properties = await adapter.reads.listProperties()
    const invoices = await adapter.reads.listInvoices()

    expect(account.clientContextId).toBe('client-demo-cp3b1')
    expect(account.isSynthetic).toBe(true)
    expect(properties.every((property) => property.isSynthetic)).toBe(true)
    expect(invoices.every((invoice) => invoice.isSynthetic)).toBe(true)
    expect(invoices[0]?.issuedLabel.includes('sin validez fiscal')).toBe(true)
  })

  it('does not infer a client from a login preview', async () => {
    const adapter = createPortalPreviewAdapter('login')
    const resolutions: PortalLifecycleResolution[] = []
    const stop = adapter.lifecycle.start((resolution) => resolutions.push(resolution))
    await new Promise<void>((resolve) => globalThis.queueMicrotask(resolve))
    stop()

    expect(resolutions[0]).toMatchObject({ status: 'unauthenticated' })
  })

  it('requires explicit selection when multiple synthetic accounts exist', async () => {
    const adapter = createPortalPreviewAdapter('multi_client')
    const resolutions: PortalLifecycleResolution[] = []
    const stop = adapter.lifecycle.start((resolution) => resolutions.push(resolution))
    await new Promise<void>((resolve) => globalThis.queueMicrotask(resolve))
    stop()

    expect(resolutions[0]).toMatchObject({
      status: 'client_selection_required',
    })
  })
})
