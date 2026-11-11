import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { archiveJobWithRpc } from './jobArchiveApi'

vi.mock('../../lib/authenticatedSupabaseWrite', () => ({
  fetchAuthenticatedSupabaseWrite: vi.fn(),
  readSingleAuthenticatedWriteRow: vi.fn(),
}))

describe('archiveJobWithRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchAuthenticatedSupabaseWrite).mockResolvedValue(new Response('true', { status: 200 }))
    vi.mocked(readSingleAuthenticatedWriteRow).mockResolvedValue(true)
  })

  it('archives through the authenticated RPC contract rather than direct table UPDATE', async () => {
    await archiveJobWithRpc('synthetic-job-01')

    expect(fetchAuthenticatedSupabaseWrite).toHaveBeenCalledWith('rpc/archive_job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_job_id: 'synthetic-job-01' }),
    })
    expect(readSingleAuthenticatedWriteRow).toHaveBeenCalledWith(
      expect.any(Response),
      'No se pudo archivar el servicio.',
    )
  })

  it('surfaces authenticated write failures without retrying a direct table update', async () => {
    vi.mocked(fetchAuthenticatedSupabaseWrite).mockRejectedValueOnce(new Error('RPC denied'))

    await expect(archiveJobWithRpc('synthetic-job-01')).rejects.toThrow('RPC denied')
    expect(readSingleAuthenticatedWriteRow).not.toHaveBeenCalled()
  })
})
