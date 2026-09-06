import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_ID_V6R1E,
  GATE_V6R1E,
  PACKAGE_STATUS_V6R1E,
  QA_REF,
  SOURCE_BASE_HEAD_V6R1E,
  assertExecutionAuthorizationV6,
  buildExecutionOperationsV6,
  planV6,
  preflightV6,
  verifyPackageManifestV6,
} from './run-cp3b2a-qa-v6.mjs'

function environment() {
  return {
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V6R1E_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1E,
    CP3B2A_V6R1E_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1E,
    CP3B2A_V6R1E_EXECUTION_AUTHORIZED: 'false',
  }
}

describe('CP-3B.2A.6R.1E final real PostgreSQL adapter', () => {
  it('exposes the V6R1E package contract', () => {
    const { manifest } = verifyPackageManifestV6()
    expect(manifest.gate).toBe(GATE_V6R1E)
    expect(manifest.status).toBe(PACKAGE_STATUS_V6R1E)
    expect(manifest.authorizationId).toBe(AUTHORIZATION_ID_V6R1E)
    expect(manifest.sourceBaseHead).toBe(SOURCE_BASE_HEAD_V6R1E)
  })

  it('keeps plan/preflight read-only', { timeout: 30_000 }, () => {
    const plan = planV6()
    expect(plan.gate).toBe(GATE_V6R1E)
    expect(plan.qaApplication).toBe('READY_PENDING_EXPLICIT_V6R1E_AUTHORIZATION')
    const preflight = preflightV6(environment(), {
      gitState: () => ({
        branch: 'main',
        head: SOURCE_BASE_HEAD_V6R1E,
        remoteHead: SOURCE_BASE_HEAD_V6R1E,
        clean: true,
        divergence: [0, 0],
      }),
      assertQaTarget: () => ({ target: 'QA_MATCH', tls: 'REQUIRED', adapter: 'POSTGRESQL_17' }),
      assertProductionRejected: () => true,
      createPrivateBackup: () => ({
        path: '/tmp/private-backup-v6r1e-manifest.json',
        value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } } },
      }),
      verifyPrivateBackup: () => ({
        path: '/tmp/private-backup-v6r1e-manifest.json',
        value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } } },
      }),
      readLivePrestate: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } }),
      readDriftSentinel: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } }),
    })
    expect(preflight.verdict).toBe('READY_FOR_CP3B2A_QA_V6R1E')
    expect(preflight.backupLiveExactComparison).toBe('PASS')
    expect(preflight.driftSentinel).toBe('PASS')
  })

  it('rejects execute without the explicit V6R1E authorization', () => {
    expect(() => assertExecutionAuthorizationV6({}, SOURCE_BASE_HEAD_V6R1E))
      .toThrow('V6R_EXECUTION_NOT_AUTHORIZED')
  })

  it('builds file-backed execution operations for the reviewed contract', () => {
    const calls = []
    const liveSnapshot = {
      gate: GATE_V6R1E,
      projectRef: QA_REF,
      authorizedHead: SOURCE_BASE_HEAD_V6R1E,
      sourceBaseHead: SOURCE_BASE_HEAD_V6R1E,
      postgresMajor: 17,
      contract: {
        expectedFunctions: 7,
        presentFunctions: 0,
        expectedConstraints: 2,
        presentConstraints: 0,
        expectedIndexes: 4,
        presentIndexes: 0,
      },
      prestate: {
        profileRows: 2,
        propertyRows: 3,
      },
      collisions: {
        profileDuplicatePairs: 0,
        propertyDuplicatePairs: 0,
        combinedDuplicatePairs: 0,
      },
    }
    const operations = buildExecutionOperationsV6({
      CP3B2A_PROJECT_REF: QA_REF,
      CP3B2A_V6R1E_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1E,
      CP3B2A_V6R1E_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1E,
      CP3B2A_V6R1E_EXECUTION_AUTHORIZED: 'false',
      CP3B2A_V6R1E_PRIVATE_BACKUP_MANIFEST: 'C:\\Users\\USUARIO\\costa-clean-app\\.project-agent\\private\\cp3b2a-v6r1e\\test-backup.json',
      CP2B_QA_DATABASE_URL: 'postgres://qa.example.invalid/postgres',
      PORTAL_ALLOWED_ORIGIN: 'https://app.costacleanbcn.com',
    }, {
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      runPsql: (sql, options = {}) => {
        calls.push({
          sql: typeof sql === 'string' ? sql : '',
          filePath: options.filePath ?? null,
        })
        return { rows: [], rowCount: 0, output: '' }
      },
      gitState: () => ({
        branch: 'main',
        head: SOURCE_BASE_HEAD_V6R1E,
        remoteHead: SOURCE_BASE_HEAD_V6R1E,
        clean: true,
        divergence: [0, 0],
      }),
      readLiveSnapshot: () => ({
        ...liveSnapshot,
      }),
      onConcurrentStage: () => {},
      onInventory: () => {},
    })
    expect(operations.apply).toBeInstanceOf(Function)
    expect(operations.concurrentMatrix).toBeInstanceOf(Function)
    expect(operations.fixtureCleanupConfirmed).toBeInstanceOf(Function)
    const applyResult = operations.apply({
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      gitState: {
        head: SOURCE_BASE_HEAD_V6R1E,
      },
      backup: {
        value: {
          liveSnapshot: {
            contract: { expectedFunctions: 7, presentFunctions: 0, expectedConstraints: 2, presentConstraints: 0, expectedIndexes: 4, presentIndexes: 0 },
            prestate: { profileRows: 2, propertyRows: 3 },
            collisions: { profileDuplicatePairs: 0, propertyDuplicatePairs: 0, combinedDuplicatePairs: 0 },
          },
        },
      },
    })
    expect(applyResult.applyState).toBe('NOT_APPLIED_CONFIRMED')
    expect(calls.some((call) => call.filePath?.endsWith('20260728160000_portal_reviewed_change_contract.sql'))).toBe(true)
  })
})
