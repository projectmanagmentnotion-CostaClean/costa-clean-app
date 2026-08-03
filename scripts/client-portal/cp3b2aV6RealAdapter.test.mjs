import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_ID_V6R1,
  GATE_V6R1,
  PACKAGE_STATUS_V6R1,
  QA_REF,
  SOURCE_BASE_HEAD_V6R1,
  assertExecutionAuthorizationV6,
  planV6,
  preflightV6,
  verifyPackageManifestV6,
} from './run-cp3b2a-qa-v6.mjs'

function environment() {
  return {
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V6R1_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1,
    CP3B2A_V6R1_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1,
    CP3B2A_V6R1_EXECUTION_AUTHORIZED: 'false',
  }
}

describe('CP-3B.2A.6R.1 final real PostgreSQL adapter', () => {
  it('exposes the V6R1 package contract', () => {
    const { manifest } = verifyPackageManifestV6()
    expect(manifest.gate).toBe(GATE_V6R1)
    expect(manifest.status).toBe(PACKAGE_STATUS_V6R1)
    expect(manifest.authorizationId).toBe(AUTHORIZATION_ID_V6R1)
    expect(manifest.sourceBaseHead).toBe(SOURCE_BASE_HEAD_V6R1)
  })

  it('keeps plan/preflight read-only', () => {
    const plan = planV6()
    expect(plan.gate).toBe(GATE_V6R1)
    expect(plan.qaApplication).toBe('READY_PENDING_EXPLICIT_V6R1_AUTHORIZATION')
    const preflight = preflightV6(environment(), {
      gitState: () => ({
        branch: 'main',
        head: SOURCE_BASE_HEAD_V6R1,
        remoteHead: SOURCE_BASE_HEAD_V6R1,
        clean: true,
        divergence: [0, 0],
      }),
      assertQaTarget: () => ({ target: 'QA_MATCH', tls: 'REQUIRED', adapter: 'POSTGRESQL_17' }),
      assertProductionRejected: () => true,
      createPrivateBackup: () => ({
        path: '/tmp/private-backup-v6r1-manifest.json',
        value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } } },
      }),
      verifyPrivateBackup: () => ({
        path: '/tmp/private-backup-v6r1-manifest.json',
        value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } } },
      }),
      readLivePrestate: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } }),
      readDriftSentinel: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } }),
    })
    expect(preflight.verdict).toBe('READY_FOR_CP3B2A_QA_V6R1')
    expect(preflight.backupLiveExactComparison).toBe('PASS')
    expect(preflight.driftSentinel).toBe('PASS')
  })

  it('rejects execute without the explicit V6R1 authorization', () => {
    expect(() => assertExecutionAuthorizationV6({}, SOURCE_BASE_HEAD_V6R1))
      .toThrow('V6R_EXECUTION_NOT_AUTHORIZED')
  })
})
