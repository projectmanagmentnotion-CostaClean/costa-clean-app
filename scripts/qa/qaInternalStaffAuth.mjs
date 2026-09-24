const PROBE_PLAN_ID = '__QA_AUTH_PROBE_DO_NOT_EXIST__'
const PROBE_STATUS = '__QA_AUTH_PROBE_INVALID_STATUS__'

export function classifyInternalStaffProbeError(error) {
  if (error?.code === 'P0001' && error?.message === 'recurring_status_invalid') {
    return { authorized: true, evidenceMethod: 'GUARDED_RPC_NON_MUTATING_PROBE' }
  }

  if (error?.code === '42501' || error?.message === 'Internal financial write permission required') {
    return { authorized: false, evidenceMethod: 'GUARDED_RPC_NON_MUTATING_PROBE' }
  }

  return { authorized: false, evidenceMethod: 'GUARDED_RPC_NON_MUTATING_PROBE' }
}

export async function verifyInternalStaffAuthorization(client) {
  const { data, error } = await client.rpc('set_recurring_service_plan_status', {
    p_plan_id: PROBE_PLAN_ID,
    p_status: PROBE_STATUS,
  })

  if (!error || data !== null) {
    return { authorized: false, evidenceMethod: 'GUARDED_RPC_NON_MUTATING_PROBE' }
  }

  return classifyInternalStaffProbeError(error)
}
