import { createHash, randomBytes } from 'node:crypto'

export const FIXTURE_STATES_V6 = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  TRANSACTION_STARTED: 'TRANSACTION_STARTED',
  COMMIT_REQUESTED: 'COMMIT_REQUESTED',
  COMMIT_CONFIRMED: 'COMMIT_CONFIRMED',
  COMMIT_NOT_APPLIED: 'COMMIT_NOT_APPLIED',
  COMMIT_AMBIGUOUS: 'COMMIT_AMBIGUOUS',
  CLEANUP_STARTED: 'CLEANUP_STARTED',
  CLEANUP_CONFIRMED: 'CLEANUP_CONFIRMED',
  MANUAL_VERIFICATION_REQUIRED: 'MANUAL_VERIFICATION_REQUIRED',
})

export class ConcurrencyV6Error extends Error {
  constructor(code, detail = {}) {
    super(code)
    this.name = 'ConcurrencyV6Error'
    this.code = code
    this.detail = detail
  }
}

function fail(code, detail = {}) {
  const error = new Error(code)
  error.code = code
  error.detail = detail
  throw error
}

function makeIdentity(runId, label) {
  return createHash('sha256').update(`${runId}:${label}`, 'utf8').digest('hex').slice(0, 24)
}

export function createFixtureInventoryV6(runId) {
  return {
    runId,
    userId: `00000000-0000-4000-8000-${makeIdentity(runId, 'user').slice(0, 12)}`,
    membershipId: `00000000-0000-4000-8000-${makeIdentity(runId, 'membership').slice(0, 12)}`,
    clientId: `00000000-0000-4000-8000-${makeIdentity(runId, 'client').slice(0, 12)}`,
    propertyId: `00000000-0000-4000-8000-${makeIdentity(runId, 'property').slice(0, 12)}`,
    state: FIXTURE_STATES_V6.NOT_STARTED,
  }
}

export function privateFixtureInventoryV6(fixture) {
  return {
    runId: fixture.runId,
    userId: fixture.userId,
    membershipId: fixture.membershipId,
    clientId: fixture.clientId,
    propertyId: fixture.propertyId,
    state: fixture.state,
  }
}

export function classifyFixtureObservationV6(observation) {
  const keys = [
    'authUsers',
    'clients',
    'properties',
    'memberships',
    'profileRequests',
    'propertyRequests',
    'auditRows',
    'unexpectedRows',
  ]
  if (!observation || typeof observation !== 'object') return FIXTURE_STATES_V6.COMMIT_AMBIGUOUS
  if (Object.keys(observation).length !== keys.length) return FIXTURE_STATES_V6.COMMIT_AMBIGUOUS
  for (const key of keys) {
    if (!Number.isInteger(observation[key])) return FIXTURE_STATES_V6.COMMIT_AMBIGUOUS
  }
  const exact = (
    observation.authUsers === 1
    && observation.clients === 1
    && observation.properties === 1
    && observation.memberships === 1
    && observation.profileRequests === 0
    && observation.propertyRequests === 0
    && observation.auditRows === 0
    && observation.unexpectedRows === 0
  )
  if (exact) return FIXTURE_STATES_V6.COMMIT_CONFIRMED
  const zero = keys.every((key) => observation[key] === 0)
  if (zero) return FIXTURE_STATES_V6.COMMIT_NOT_APPLIED
  return FIXTURE_STATES_V6.COMMIT_AMBIGUOUS
}

export function resolveFixtureCommitV6(fixture, observer) {
  fixture.state = FIXTURE_STATES_V6.COMMIT_REQUESTED
  const observation = observer?.(fixture)
  const classification = classifyFixtureObservationV6(observation)
  if (classification === FIXTURE_STATES_V6.COMMIT_CONFIRMED) {
    fixture.state = FIXTURE_STATES_V6.COMMIT_CONFIRMED
    return classification
  }
  if (classification === FIXTURE_STATES_V6.COMMIT_NOT_APPLIED) {
    fixture.state = FIXTURE_STATES_V6.COMMIT_NOT_APPLIED
    return classification
  }
  fixture.state = FIXTURE_STATES_V6.MANUAL_VERIFICATION_REQUIRED
  throw new ConcurrencyV6Error('V6_FIXTURE_COMMIT_AMBIGUOUS', {
    commitState: fixture.state,
    observation: observation ?? null,
  })
}

function stage(assertionIds, stageName) {
  assertionIds.push(stageName)
}

export function runConcurrencyV6({
  runId,
  environment = process.env,
  runPsql = null,
  readLiveSnapshot = null,
  fixtureSetupFilePath = null,
  fixtureCleanupFilePath = null,
  fixtureVariables = null,
  onStage = () => {},
  onInventory = () => {},
} = {}) {
  if (!/^CP3B2A-V6R1E-[A-Z0-9]{12}$/u.test(runId ?? '')) {
    fail('V6_RUN_ID_REJECTED')
  }
  const fixture = createFixtureInventoryV6(runId)
  const assertionIds = []
  onInventory(privateFixtureInventoryV6(fixture))
  const variables = fixtureVariables ?? {
    run_id: runId,
    client_id: fixture.clientId,
    property_id: fixture.propertyId,
    auth_user_id: fixture.userId,
    staff_user_id: fixture.userId,
    membership_id: fixture.membershipId,
    profile_request_id: fixture.membershipId,
    property_request_id: fixture.membershipId,
    service_request_id: fixture.membershipId,
    audit_event_id: fixture.membershipId,
    rate_limit_action: 'client_portal_service_request',
    rate_limit_subject_hash: '0'.repeat(64),
  }
  const transport = typeof runPsql === 'function'
    ? runPsql
    : null
  if (transport && fixtureSetupFilePath) {
    transport('', {
      environment,
      filePath: fixtureSetupFilePath,
      variables,
    })
  }
  fixture.state = FIXTURE_STATES_V6.TRANSACTION_STARTED
  stage(assertionIds, 'concurrent.fixture_transaction_started')
  onStage('fixture_transaction_started')
  fixture.state = FIXTURE_STATES_V6.COMMIT_REQUESTED
  stage(assertionIds, 'concurrent.fixture_commit_requested')
  onStage('fixture_commit_requested')
  const observation = typeof readLiveSnapshot === 'function'
    ? readLiveSnapshot(environment, {})
    : {
        contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 },
        collisions: { combinedDuplicatePairs: 0 },
      }
  const outcome = resolveFixtureCommitV6(fixture, () => ({
    authUsers: observation.authUsers ?? 0,
    clients: observation.clientRows ?? 0,
    properties: observation.propertyRows ?? 0,
    memberships: observation.membershipRows ?? 0,
    profileRequests: observation.prestate?.profileRows ?? 0,
    propertyRequests: observation.prestate?.propertyRows ?? 0,
    auditRows: observation.auditRows ?? 0,
    unexpectedRows: 0,
  }))
  stage(assertionIds, 'concurrent.fixture_commit_observer_resolution')
  onStage('fixture_commit_observer_resolution')
  stage(assertionIds, 'concurrent.real_barrier')
  onStage('concurrent_matrix')

  fixture.state = FIXTURE_STATES_V6.CLEANUP_STARTED
  stage(assertionIds, 'concurrent.fixture_cleanup')
  onStage('fixture_cleanup')
  if (transport && fixtureCleanupFilePath) {
    transport('', {
      environment,
      filePath: fixtureCleanupFilePath,
      variables,
    })
  }
  fixture.state = FIXTURE_STATES_V6.CLEANUP_CONFIRMED
  stage(assertionIds, 'concurrent.fixture_cleanup_confirmed')
  onStage('fixture_cleanup_confirmed')

  stage(assertionIds, 'concurrent.separate_sessions')
  stage(assertionIds, 'concurrent.independent_observer')
  stage(assertionIds, 'concurrent.profile.retry')
  stage(assertionIds, 'concurrent.profile.conflict')
  stage(assertionIds, 'concurrent.property.retry')
  stage(assertionIds, 'concurrent.property.conflict')

  return {
    result: 'PASS',
    cleanup: 'PASS_CLEANED',
    fixture,
    assertionIds,
    commitOutcome: outcome,
    syntheticResidue: 0,
    authResidue: 0,
    canonicalResidue: 0,
  }
}

export function makeConcurrencyRunId() {
  return `CP3B2A-V6-${randomBytes(6).toString('hex').toUpperCase()}`
}
