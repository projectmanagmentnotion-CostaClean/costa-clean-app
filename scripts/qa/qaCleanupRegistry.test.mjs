import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupCreatedEntity, findCreatedEntityByQaRun } from './qaCleanupRegistry.mjs'

describe('qaCleanupRegistry', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://qa-project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'qa-public-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_ANON_KEY
  })

  it('matches expenses by notes, supplier, or description fingerprint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 'EXPENSE-QA' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const entity = await findCreatedEntityByQaRun({
      flowId: 'expense-create',
      qaRunId: 'QA-AUTO-TEST',
      createdAfter: '2026-07-19T00:00:00.000Z',
    })

    expect(entity).toEqual({ id: 'EXPENSE-QA' })
    const requestUrl = String(fetchMock.mock.calls[0][0])
    expect(requestUrl).toContain('or=(notes.eq.QA-RUN%20QA-AUTO-TEST')
    expect(requestUrl).toContain('supplier_name.eq.QA%20Supplier%20QA-AUTO-TEST')
    expect(requestUrl).toContain('description.eq.QA%20expense%20QA-AUTO-TEST')
  })

  it('fails cleanup when Supabase reports no affected row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(cleanupCreatedEntity({
      flowId: 'expense-create',
      entityId: 'EXPENSE-QA',
    })).rejects.toThrow('Cleanup did not affect expenses/EXPENSE-QA')
  })
})
