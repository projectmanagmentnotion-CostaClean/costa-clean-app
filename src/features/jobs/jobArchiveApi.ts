import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'

export async function archiveJobWithRpc(jobId: string): Promise<void> {
  const response = await fetchAuthenticatedSupabaseWrite(operationalWriteRpcPaths.archiveJob, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_job_id: jobId }),
  })

  await readSingleAuthenticatedWriteRow<boolean>(response, 'No se pudo archivar el servicio.')
}
