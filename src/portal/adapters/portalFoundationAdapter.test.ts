import { describe, expect, it } from 'vitest'
import { createPortalFoundationAdapter } from './portalFoundationAdapter'

describe('production portal foundation adapter', () => {
  it('starts closed and unauthenticated without preview controls', async () => {
    const adapter = createPortalFoundationAdapter()
    const resolution = await adapter.access.resolveAccess()

    expect(resolution.status).toBe('unauthenticated')
    expect(adapter.previewScenario).toBeNull()
  })

  it('exposes only unavailable read methods and no write operation', async () => {
    const adapter = createPortalFoundationAdapter()
    const methodNames = Object.keys(adapter.reads)
    const containsWriteMethod = methodNames.some((name) =>
      /create|update|delete|save|write|upload/i.test(name),
    )
    let readRejected = false

    try {
      await adapter.reads.getAccountContext()
    } catch {
      readRejected = true
    }

    expect(methodNames).toHaveLength(6)
    expect(containsWriteMethod).toBe(false)
    expect(readRejected).toBe(true)
  })
})
