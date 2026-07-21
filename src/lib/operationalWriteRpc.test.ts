import { describe, expect, it } from 'vitest'
import { operationalWriteRpcPaths } from './operationalWriteRpc'

describe('authenticated operational write RPC contracts', () => {
  it('routes client writes through protected RPCs', () => {
    expect(operationalWriteRpcPaths.createClient).toBe('rpc/create_client')
    expect(operationalWriteRpcPaths.updateClient).toBe('rpc/update_client')
  })

  it('routes property writes and reassignment through protected RPCs', () => {
    expect(operationalWriteRpcPaths.createProperty).toBe('rpc/create_property')
    expect(operationalWriteRpcPaths.updateProperty).toBe('rpc/update_property')
    expect(operationalWriteRpcPaths.reassignProperty).toBe('rpc/reassign_property_client_authenticated')
  })

  it('routes job writes through protected RPCs', () => {
    expect(operationalWriteRpcPaths.updateJobStatus).toBe('rpc/update_job_status')
    expect(operationalWriteRpcPaths.saveJobWithLines).toBe('rpc/save_job_with_lines')
  })

  it('does not expose a direct REST table write path', () => {
    expect(Object.values(operationalWriteRpcPaths).every((path) => path.startsWith('rpc/'))).toBe(true)
  })
})
