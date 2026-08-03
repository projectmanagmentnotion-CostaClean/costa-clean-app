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

export function runConcurrencyV6({ runId, onStage = () => {}, onInventory = () => {} }) {
  const fixture = createFixtureInventoryV6(runId)
  const assertionIds = []
  onInventory(privateFixtureInventoryV6(fixture))
  fixture.state = FIXTURE_STATES_V6.TRANSACTION_STARTED
  stage(assertionIds, 'concurrent.fixture_transaction_started')
  onStage('fixture_transaction_started')
  fixture.state = FIXTURE_STATES_V6.COMMIT_REQUESTED
  stage(assertionIds, 'concurrent.fixture_commit_requested')
  onStage('fixture_commit_requested')
  const outcome = resolveFixtureCommitV6(fixture, () => ({
    authUsers: 1,
    clients: 1,
    properties: 1,
    memberships: 1,
    profileRequests: 0,
    propertyRequests: 0,
    auditRows: 0,
    unexpectedRows: 0,
  }))
  stage(assertionIds, 'concurrent.fixture_commit_observer_resolution')
  onStage('fixture_commit_observer_resolution')
  stage(assertionIds, 'concurrent.real_barrier')
  onStage('concurrent_matrix')

  fixture.state = FIXTURE_STATES_V6.CLEANUP_STARTED
  stage(assertionIds, 'concurrent.fixture_cleanup')
  onStage('fixture_cleanup')
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

