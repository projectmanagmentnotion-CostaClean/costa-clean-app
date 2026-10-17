import { describe, expect, it, vi } from 'vitest'
import { classifyInternalStaffProbeError, verifyInternalStaffAuthorization } from './qaInternalStaffAuth.mjs'

describe('QA internal staff guarded authorization probe', () => {
  it('accepts only the guarded downstream validation error as authorized', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'recurring_status_invalid' } }) }
    await expect(verifyInternalStaffAuthorization(client)).resolves.toEqual({
      authorized: true,
      evidenceMethod: 'GUARDED_RPC_NON_MUTATING_PROBE',
    })
    expect(client.rpc).toHaveBeenCalledWith('set_recurring_service_plan_status', {
      p_plan_id: '__QA_AUTH_PROBE_DO_NOT_EXIST__',
      p_status: '__QA_AUTH_PROBE_INVALID_STATUS__',
    })
  })

  it('rejects authorization failures', () => {
    expect(classifyInternalStaffProbeError({ code: '42501', message: 'permission denied' }).authorized).toBe(false)
    expect(classifyInternalStaffProbeError({ code: 'P0001', message: 'Internal financial write permission required' }).authorized).toBe(false)
  })

  it('fails closed on unexpected errors and unexpected success', async () => {
    expect(classifyInternalStaffProbeError({ code: 'P0001', message: 'unexpected' }).authorized).toBe(false)
    await expect(verifyInternalStaffAuthorization({ rpc: vi.fn().mockResolvedValue({ data: {}, error: null }) }))
      .resolves.toEqual({ authorized: false, evidenceMethod: 'GUARDED_RPC_NON_MUTATING_PROBE' })
  })

  it('does not expose credential-like values in classification output', () => {
    const result = classifyInternalStaffProbeError({ code: 'P0001', message: 'unexpected-password-token' })
    expect(JSON.stringify(result)).not.toContain('unexpected-password-token')
  })
})
