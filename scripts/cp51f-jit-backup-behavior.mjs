const EXPECTED_PAT_NAME = 'CostaClean CP-5.1F Backup Temporary'

export const JIT_STOP = 'STOP_JIT_CLEANUP_FAILURE'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function assertJitState(state) {
  if (state !== 'enabled' && state !== 'disabled') {
    throw new Error('invalid JIT state response')
  }
}

function assertMapping(mapping) {
  if (mapping === null) return 'absent'
  if (
    mapping &&
    typeof mapping.user_id === 'string' &&
    mapping.user_id.length > 0 &&
    Array.isArray(mapping.user_roles)
  ) return 'present'
  throw new Error('invalid JIT mapping response')
}

export function createMockJitApi({ state, mapping, failAt = null, failAfter = null }) {
  const api = {
    state,
    mapping: clone(mapping),
    calls: [],
    failAt,
    failAfter,
    maybeFail(operation) {
      api.calls.push(operation)
      if (api.failAt === operation) throw new Error(`mock failure: ${operation}`)
    },
    maybeFailAfter(operation) {
      if (api.failAfter === operation) throw new Error(`mock failure after: ${operation}`)
    },
    getState() {
      api.maybeFail('get-state')
      return api.state
    },
    getMapping() {
      api.maybeFail('get-mapping')
      return clone(api.mapping)
    },
    setState(nextState) {
      api.maybeFail('enable')
      api.state = nextState
      api.maybeFailAfter('enable')
    },
    updateMapping(nextMapping) {
      api.maybeFail('mapping-put')
      api.mapping = clone(nextMapping)
      api.maybeFailAfter('mapping-put')
    },
    restoreState(nextState) {
      api.maybeFail('cleanup-state')
      api.state = nextState
    },
    restoreMapping(nextMapping) {
      api.maybeFail('cleanup-mapping-put')
      api.mapping = clone(nextMapping)
    },
    deleteMapping() {
      api.maybeFail('mapping-delete')
      api.mapping = null
    },
  }
  return api
}

export async function runMockBackup({ api, dump = async name => {
  api.maybeFail(`dump-${name}`)
} }) {
  let preState
  let preMapping
  let mappingKind
  try {
    preState = api.getState()
    assertJitState(preState)
    preMapping = api.getMapping()
    mappingKind = assertMapping(preMapping)
  } catch (error) {
    return { status: 'FAIL_CLOSED', calls: [...api.calls], error: error.message }
  }

  if (mappingKind === 'absent') {
    return { status: 'STOP_MAPPING_ABSENT', calls: [...api.calls] }
  }

  const originalMapping = clone(preMapping)
  let changed = false
  const cleanup = async () => {
    if (api.state !== preState) api.restoreState(preState)
    api.calls.push('cleanup')
    api.restoreMapping(originalMapping)
    if (api.state !== preState) throw new Error('state restore mismatch')
    if (JSON.stringify(api.mapping) !== JSON.stringify(originalMapping)) throw new Error('mapping restore mismatch')
  }

  try {
    if (preState === 'disabled') {
      changed = true
      api.setState('enabled')
    }
    api.updateMapping({
      user_id: originalMapping.user_id,
      user_roles: [{ role: 'postgres', expires_at: 123 }],
    })
    changed = true
    for (const name of ['roles', 'schema', 'data', 'history_schema', 'history_data']) await dump(name)
    await cleanup()
    return { status: 'PASS', calls: [...api.calls] }
  } catch (error) {
    if (changed) {
      try {
        await cleanup()
      } catch {
        return { status: JIT_STOP, calls: [...api.calls], error: error.message }
      }
    }
    return { status: 'FAIL_CLOSED', calls: [...api.calls], error: error.message }
  }
}

export function evaluateRevocationGate(input) {
  if (input.classicPatRevoked !== 'YES') {
    return { status: 'AWAITING_PAT_REVOCATION', canCertify: false }
  }
  const evidence = input.revocationEvidence
  const validEvidence = evidence &&
    evidence.tokenName === EXPECTED_PAT_NAME &&
    evidence.active === false &&
    evidence.tokenValuePresent === false
  if (!validEvidence) return { status: 'STOP_PAT_REVOCATION_FAILURE', canCertify: false }
  if (input.restoreResult !== 'PASS' || input.jitPoststateMatchesPrestate !== 'YES') {
    return { status: 'NOT_READY_FOR_REVOCATION_CERTIFICATION', canCertify: false }
  }
  return { status: 'LOGICAL_BACKUP_VERIFIED', canCertify: true }
}

export { EXPECTED_PAT_NAME }
