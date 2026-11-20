import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { archiveJobWithRpc } from './jobArchiveApi'

const archiveJobMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20261111214439_archive_job_internal_staff.sql'), 'utf8')

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

describe('archive_job migration access contract', () => {
  it('fails closed through the internal write guard and grants RPC execution only to authenticated', () => {
    expect(archiveJobMigration).toMatch(/create\s+or\s+replace\s+function\s+public\.archive_job\(p_job_id\s+text\)/i)
    expect(archiveJobMigration).toMatch(/security\s+definer\s+set\s+search_path\s*=\s*''/i)
    expect(archiveJobMigration).toContain('perform app_private.require_internal_staff_write()')
    expect(archiveJobMigration).toMatch(/revoke\s+all\s+on\s+function\s+public\.archive_job\(text\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i)
    expect(archiveJobMigration).toMatch(/grant\s+execute\s+on\s+function\s+public\.archive_job\(text\)\s+to\s+authenticated/i)
    expect(archiveJobMigration).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.archive_job\(text\)\s+to\s+(?:public|anon|service_role)/i)
  })
})
