import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_ID_V6R1E,
  buildExecutionOperationsV6,
  EXECUTABLE_ORDER_V6,
  GATE_V6R1E,
  PACKAGE_STATUS_V6R1E,
  QA_REF,
  SOURCE_BASE_HEAD_V6R1E,
  assertExecutionAuthorizationV6,
  executeV6Core,
  preflightV6,
  verifyPackageManifestV6,
  V5_HISTORICAL_MANIFEST_SHA256,
} from './run-cp3b2a-qa-v6.mjs'
import {
  CANONICAL_JSON_STANDARD_V6,
  canonicalJsonSha256V1,
  canonicalJsonTextV1,
  workingTreeJsonContractIdentityV1,
  workingTreeSha256V1,
} from './cp3b2aCanonicalJsonV6.mjs'
import {
  ConcurrencyV6Error,
  FIXTURE_STATES_V6,
  classifyFixtureObservationV6,
  createFixtureInventoryV6,
  privateFixtureInventoryV6,
  resolveFixtureCommitV6,
  runConcurrencyV6,
} from './cp3b2a_qa_concurrency_v6.mjs'

const repoRoot = process.cwd()
const manifestPath = 'scripts/client-portal/cp3b2a_qa_package_v6.manifest.json'
const capabilityMapPath = 'scripts/client-portal/cp3b2a_qa_capability_map_v6.json'
const runnerPath = 'scripts/client-portal/run-cp3b2a-qa-v6.mjs'

function baseEnvironment() {
  return {
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V6R1E_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1E,
    CP3B2A_V6R1E_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1E,
    CP3B2A_V6R1E_EXECUTION_AUTHORIZED: 'true',
  }
}

function matchingPreflightDependencies() {
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
      profileNullReferences: 0,
      propertyNullReferences: 0,
      profileDuplicatePairs: 0,
      propertyDuplicatePairs: 0,
    },
    collisions: {
      profileDuplicatePairs: 0,
      propertyDuplicatePairs: 0,
      combinedDuplicatePairs: 0,
    },
  }
  return {
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
      value: { liveSnapshot },
    }),
    verifyPrivateBackup: () => ({
      path: '/tmp/private-backup-v6r1e-manifest.json',
      value: { liveSnapshot },
    }),
    readLivePrestate: () => liveSnapshot,
    readDriftSentinel: () => liveSnapshot,
  }
}

describe('CP-3B.2A.6R.1E final real PostgreSQL adapter V6R1E', () => {
  it('canonicalizes JSON recursively and ignores object key order', () => {
    const original = {
      z: 1,
      a: {
        beta: 2,
        alpha: [3, { y: 2, x: 1 }],
      },
    }
    const reordered = {
      a: {
        alpha: [3, { x: 1, y: 2 }],
        beta: 2,
      },
      z: 1,
    }
    expect(canonicalJsonTextV1(original)).toBe('{"a":{"alpha":[3,{"x":1,"y":2}],"beta":2},"z":1}')
    expect(canonicalJsonSha256V1(original)).toBe(canonicalJsonSha256V1(reordered))
    expect(CANONICAL_JSON_STANDARD_V6).toBe('CP3B2A_CANONICAL_JSON_V1')
  })

  it('uses Git blob identity and canonical JSON identity, not working tree bytes', () => {
    const manifestIdentity = workingTreeJsonContractIdentityV1(path.join(repoRoot, manifestPath))
    const capabilityIdentity = workingTreeJsonContractIdentityV1(path.join(repoRoot, capabilityMapPath))
    expect(manifestIdentity.gitBlobId).toMatch(/^[0-9a-f]{40}$/u)
    expect(capabilityIdentity.gitBlobId).toMatch(/^[0-9a-f]{40}$/u)
    expect(manifestIdentity.canonicalJsonSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(capabilityIdentity.canonicalJsonSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(workingTreeSha256V1(path.join(repoRoot, manifestPath))).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('validates the V6R1E manifest and package contract', () => {
    const { manifest, expected } = verifyPackageManifestV6()
    expect(manifest.gate).toBe(GATE_V6R1E)
    expect(manifest.status).toBe(PACKAGE_STATUS_V6R1E)
    expect(manifest.authorizationId).toBe(AUTHORIZATION_ID_V6R1E)
    expect(manifest.sourceBaseHead).toBe(SOURCE_BASE_HEAD_V6R1E)
    expect(manifest.privateBackupLocation).toBe('.project-agent/private/cp3b2a-v6r1e')
    expect(expected.map((entry) => entry.path)).toHaveLength(17)
  })

  it('preflights read-only and creates a fresh private backup model', () => {
    const result = preflightV6(baseEnvironment(), matchingPreflightDependencies())
    expect(result.verdict).toBe('READY_FOR_CP3B2A_QA_V6R1E')
    expect(result.backupLiveExactComparison).toBe('PASS')
    expect(result.driftSentinel).toBe('PASS')
    expect(result.remoteWrites).toBe(0)
    expect(result.privateBackupManifest).toContain('private-backup-v6r1e-manifest.json')
  })

  it('rejects execute without the exact V6R1E authorization', () => {
    expect(() => assertExecutionAuthorizationV6({}, SOURCE_BASE_HEAD_V6R1E))
      .toThrow('V6R_EXECUTION_NOT_AUTHORIZED')
    expect(() => assertExecutionAuthorizationV6({
      ...baseEnvironment(),
      CP3B2A_V6R1E_AUTHORIZED_HEAD: 'b'.repeat(40),
    }, SOURCE_BASE_HEAD_V6R1E)).toThrow('V6R_AUTHORIZED_HEAD_MISMATCH')
  })

  it('wires the executable runner to real PostgreSQL file-backed operations', async () => {
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
    const operations = buildExecutionOperationsV6(
      {
        CP3B2A_PROJECT_REF: QA_REF,
        CP3B2A_V6R1E_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1E,
        CP3B2A_V6R1E_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1E,
        CP3B2A_V6R1E_EXECUTION_AUTHORIZED: 'false',
        CP3B2A_V6R1E_PRIVATE_BACKUP_MANIFEST: 'C:\\Users\\USUARIO\\costa-clean-app\\.project-agent\\private\\cp3b2a-v6r1e\\test-backup.json',
        CP2B_QA_DATABASE_URL: 'postgres://qa.example.invalid/postgres',
        PORTAL_ALLOWED_ORIGIN: 'https://app.costacleanbcn.com',
      },
      {
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
        readLiveSnapshot: () => liveSnapshot,
        onConcurrentStage: () => {},
        onInventory: () => {},
      },
    )
    expect(operations.apply).toBeInstanceOf(Function)
    expect(operations.concurrentMatrix).toBeInstanceOf(Function)
    const result = await operations.apply({
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      gitState: { head: SOURCE_BASE_HEAD_V6R1E },
      backup: {
        value: {
          liveSnapshot: {
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
          },
        },
      },
    })
    expect(result.applyState).toBe('NOT_APPLIED_CONFIRMED')
    expect(calls.some((call) => call.filePath?.endsWith('20260728160000_portal_reviewed_change_contract.sql'))).toBe(true)
  })

  it('enforces the exact 26-stage order', async () => {
    const operations = {
      verifyManifest: () => true,
      authorize: () => ({ head: SOURCE_BASE_HEAD_V6R1E, clean: true }),
      assertClean: () => true,
      assertQaTarget: () => true,
      assertProductionRejected: () => true,
      verifyBackup: () => ({ value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, prestate: { marker: 'same' }, collisions: { combinedDuplicatePairs: 0 } } } }),
      assertContractAbsent: () => ({ contractAbsent: true, partialStateAbsent: true, contract: {}, collisions: { combinedDuplicatePairs: 0 } }),
      assertPartialStateAbsent: () => true,
      assertSyntheticCollisionAbsent: () => true,
      readLivePrestate: () => ({ marker: 'same' }),
      compareBackupLive: () => true,
      createLedger: () => '/tmp/ledger.json',
      readDriftSentinel: () => ({ marker: 'same' }),
      compareDriftSentinel: () => true,
      markApplyStarted: () => true,
      apply: () => ({
        applyState: 'APPLIED_CONFIRMED',
        observedSnapshotDigest: 'digest',
        observedSnapshot: { contract: { presentFunctions: 7, presentConstraints: 2, presentIndexes: 4 }, prestate: { profileRows: 2, propertyRows: 3 } },
      }),
      persistApplyEvidence: () => true,
      fixtureSetup: () => true,
      postcheck: () => true,
      transactionalMatrix: () => ({
        result: 'PASS',
        transaction: 'ROLLED_BACK',
        assertionIds: [],
      }),
      concurrentMatrix: () => ({
        result: 'PASS',
        cleanup: 'PASS_CLEANED',
        assertionIds: [],
      }),
      validateCapabilities: () => true,
      fixtureCleanup: () => true,
      fixtureCleanupConfirmed: () => true,
      finalPostcheck: () => true,
      finalDigestComparison: () => true,
      completeLedger: () => true,
      handleFailure: (error) => { throw error },
    }
    const observed = []
    const result = await executeV6Core({
      operations,
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      onStage: (stage) => observed.push(stage),
    })
    expect(result.verdict).toBe('PASS')
    expect(observed).toEqual(EXECUTABLE_ORDER_V6)
  })

  it('keeps ambiguous apply from committing or rolling back', async () => {
    const calls = []
    const operations = {
      verifyManifest: () => true,
      authorize: () => ({ head: SOURCE_BASE_HEAD_V6R1E, clean: true }),
      assertClean: () => true,
      assertQaTarget: () => true,
      assertProductionRejected: () => true,
      verifyBackup: () => ({ value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, prestate: { marker: 'same' }, collisions: { combinedDuplicatePairs: 0 } } } }),
      assertContractAbsent: () => ({ contractAbsent: true, partialStateAbsent: true, contract: {}, collisions: { combinedDuplicatePairs: 0 } }),
      assertPartialStateAbsent: () => true,
      assertSyntheticCollisionAbsent: () => true,
      readLivePrestate: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, prestate: { marker: 'same' }, collisions: { combinedDuplicatePairs: 0 } }),
      compareBackupLive: () => true,
      createLedger: () => '/tmp/ledger.json',
      readDriftSentinel: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, prestate: { marker: 'same' }, collisions: { combinedDuplicatePairs: 0 } }),
      compareDriftSentinel: () => true,
      markApplyStarted: () => true,
      apply: () => ({
        applyState: 'APPLY_STATE_AMBIGUOUS',
        observedSnapshotDigest: 'digest',
      }),
      persistApplyEvidence: () => { calls.push('persistApplyEvidence') },
      fixtureSetup: () => { calls.push('fixtureSetup') },
      postcheck: () => { calls.push('postcheck') },
      transactionalMatrix: () => ({ result: 'PASS', transaction: 'ROLLED_BACK', assertionIds: [] }),
      concurrentMatrix: () => ({ result: 'PASS', cleanup: 'PASS_CLEANED', assertionIds: [] }),
      validateCapabilities: () => true,
      fixtureCleanup: () => { calls.push('fixtureCleanup') },
      fixtureCleanupConfirmed: () => { calls.push('fixtureCleanupConfirmed') },
      finalPostcheck: () => { calls.push('finalPostcheck') },
      finalDigestComparison: () => { calls.push('finalDigestComparison') },
      completeLedger: () => { calls.push('completeLedger') },
      executeRollback: () => { calls.push('executeRollback') },
      verifyExactPrestateRestored: () => { calls.push('verifyExactPrestateRestored') },
      persistFailureEnvelope: () => '/tmp/failure-envelope.json',
      verifyFailureEnvelope: () => ({ recoveryEligibility: false }),
      determineRecoveryEligibility: () => ({ eligible: false, reason: 'guarded_recovery_not_eligible' }),
      handleFailure: (error, state, stages) => ({
        verdict: 'MANUAL_VERIFICATION_REQUIRED',
        error: error.code ?? error.message,
        applyAttempts: state.applyStarted ? 1 : 0,
        recoveryAttempts: state.recoveryAttempts,
        stages,
      }),
    }
    const result = await executeV6Core({
      operations,
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      onStage: () => {},
    })
    expect(result.verdict).toBe('MANUAL_VERIFICATION_REQUIRED')
    expect(calls).not.toContain('executeRollback')
    expect(calls).not.toContain('fixtureSetup')
    expect(calls).not.toContain('postcheck')
  })

  it('executes guarded recovery exactly once when failure is eligible', async () => {
    const calls = []
    const liveSnapshot = {
      contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 },
      prestate: { profileRows: 2, propertyRows: 3 },
      collisions: { combinedDuplicatePairs: 0 },
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
      runId: 'CP3B2A-V6R1E-RECOVERY123456',
      runPsql: (sql, options = {}) => {
        calls.push(options.filePath ?? '<sql>')
        return { rows: [], rowCount: 0, output: '', status: 0, exitCode: 0 }
      },
      gitState: () => ({
        branch: 'main',
        head: SOURCE_BASE_HEAD_V6R1E,
        remoteHead: SOURCE_BASE_HEAD_V6R1E,
        clean: true,
        divergence: [0, 0],
      }),
      readLiveSnapshot: () => ({
        gate: GATE_V6R1E,
        projectRef: QA_REF,
        authorizedHead: SOURCE_BASE_HEAD_V6R1E,
        sourceBaseHead: SOURCE_BASE_HEAD_V6R1E,
        postgresMajor: 17,
        contract: { expectedFunctions: 7, presentFunctions: 0, expectedConstraints: 2, presentConstraints: 0, expectedIndexes: 4, presentIndexes: 0 },
        prestate: { profileRows: 2, propertyRows: 3 },
        collisions: { profileDuplicatePairs: 0, propertyDuplicatePairs: 0, combinedDuplicatePairs: 0 },
      }),
      onConcurrentStage: () => {},
      onInventory: () => {},
    })
    operations.authorize = () => ({
      head: SOURCE_BASE_HEAD_V6R1E,
      clean: true,
    })
    operations.createLedger = () => {
      const ledgerPath = path.join(tmpdir(), 'cp3b2a-qa-v6r1e-recovery-ledger.json')
      writeFileSync(ledgerPath, `${JSON.stringify({
        version: 6,
        revision: 'V6R1E',
        state: 'reserved',
        gitHead: SOURCE_BASE_HEAD_V6R1E,
        projectRef: QA_REF,
        authorizationId: AUTHORIZATION_ID_V6R1E,
        canonicalJsonStandard: 'CP3B2A_CANONICAL_JSON_V1',
        applyAttempts: 0,
        recoveryAttempts: 0,
        automaticRetries: 0,
        createdAt: '2026-08-03T00:00:00.000Z',
      }, null, 2)}\n`, 'utf8')
      return ledgerPath
    }
    operations.verifyBackup = () => ({
      value: {
        liveSnapshot,
      },
    })
    operations.apply = () => ({
      applyState: 'APPLIED_CONFIRMED',
      observedSnapshotDigest: 'observed-digest',
      observedSnapshot: liveSnapshot,
    })
    operations.readLivePrestate = () => ({
      ...liveSnapshot,
    })
    operations.postcheck = () => ({ gate: GATE_V6R1E, kind: 'postcheck', result: 'PASS' })
    operations.transactionalMatrix = () => ({ result: 'PASS', transaction: 'ROLLED_BACK', assertionIds: [] })
    operations.fixtureSetup = () => ({ gate: GATE_V6R1E, kind: 'fixture_setup', result: 'PASS' })
    operations.concurrentMatrix = () => ({ result: 'PASS', cleanup: 'PASS_CLEANED', assertionIds: [] })
    operations.validateCapabilities = () => true
    operations.fixtureCleanup = () => ({ gate: GATE_V6R1E, kind: 'fixture_cleanup', result: 'PASS_CLEANED' })
    operations.fixtureCleanupConfirmed = () => ({ cleanup: 'PASS_CLEANED' })
    operations.finalPostcheck = () => ({ gate: GATE_V6R1E, kind: 'postcheck', result: 'PASS' })
    operations.finalDigestComparison = () => { throw new Error('late_failure') }
    operations.persistApplyEvidence = () => true
    operations.executeRollback = () => { calls.push('rollback-sql') ; return { result: 'PASS' } }
    operations.verifyExactPrestateRestored = () => true
    operations.determineRecoveryEligibility = () => ({ eligible: true, reason: 'eligible' })
    operations.handleFailure = (error, state, stages) => {
      operations.executeRollback(state)
      operations.verifyExactPrestateRestored(state.backup?.value?.liveSnapshot ?? null, state.backup?.value?.liveSnapshot ?? null)
      return {
        verdict: 'BLOCKED_RECOVERED',
        failureEnvelopePath: '/tmp/failure-envelope.json',
        recoveryEligibility: true,
        target: 'QA_MATCH',
        primaryFailureCode: error.code ?? error.message,
        primaryFailure: error.message,
        applyAttempts: state.applyStarted ? 1 : 0,
        recoveryAttempts: 1,
        automaticRetries: 0,
        stages,
      }
    }
    const result = await executeV6Core({
      operations,
      runId: 'CP3B2A-V6R1E-RECOVERY123456',
      onStage: () => {},
    })
    expect(result.verdict).toBe('BLOCKED_RECOVERED')
    expect(calls.filter((entry) => entry === 'rollback-sql')).toHaveLength(1)
  })

  it('classifies and resolves fixture commit states deterministically', () => {
    expect(classifyFixtureObservationV6({
      authUsers: 1,
      clients: 1,
      properties: 1,
      memberships: 1,
      profileRequests: 0,
      propertyRequests: 0,
      auditRows: 0,
      unexpectedRows: 0,
    })).toBe(FIXTURE_STATES_V6.COMMIT_CONFIRMED)
    const fixture = createFixtureInventoryV6('CP3B2A-V6R1E-ABCDEF123456')
    expect(privateFixtureInventoryV6(fixture)).toMatchObject({
      runId: fixture.runId,
      state: FIXTURE_STATES_V6.NOT_STARTED,
    })
    fixture.state = FIXTURE_STATES_V6.TRANSACTION_STARTED
    expect(() => resolveFixtureCommitV6(fixture, () => ({
      authUsers: 1,
      clients: 1,
      properties: 1,
      memberships: 0,
      profileRequests: 0,
      propertyRequests: 0,
      auditRows: 0,
      unexpectedRows: 0,
    }))).toThrow(ConcurrencyV6Error)
    expect(fixture.state).toBe(FIXTURE_STATES_V6.MANUAL_VERIFICATION_REQUIRED)
  })

  it('simulates the concurrent matrix without residue', () => {
    const result = runConcurrencyV6({ runId: 'CP3B2A-V6R1E-ABCDEF123456' })
    expect(result.result).toBe('PASS')
    expect(result.cleanup).toBe('PASS_CLEANED')
    expect(result.syntheticResidue).toBe(0)
    expect(result.authResidue).toBe(0)
    expect(result.canonicalResidue).toBe(0)
  })

  it('accepts the deterministic local proof run id and rejects invalid lengths', () => {
    const valid = runConcurrencyV6({ runId: 'CP3B2A-V6R1E-LOCALPROOF01' })
    expect(valid.result).toBe('PASS')
    expect(valid.cleanup).toBe('PASS_CLEANED')
    expect(() => runConcurrencyV6({ runId: 'CP3B2A-V6R1E-LOCAL-000000' }))
      .toThrow('V6_RUN_ID_REJECTED')
    expect(() => runConcurrencyV6({ runId: 'CP3B2A-V6R1E-LOCALPROOF1' }))
      .toThrow('V6_RUN_ID_REJECTED')
    expect(() => runConcurrencyV6({ runId: 'CP3B2A-V6R1E-LOCALPROOF010' }))
      .toThrow('V6_RUN_ID_REJECTED')
  })

  it('blocks the historical V5 pin without rewriting the incident', () => {
    const v5Manifest = readFileSync('scripts/client-portal/cp3b2a_qa_package_v5.manifest.json', 'utf8')
    expect(v5Manifest).toContain(V5_HISTORICAL_MANIFEST_SHA256)
    expect(() => JSON.parse(v5Manifest)).not.toThrow()
  })

  it('keeps the runner in plan/preflight mode only for the current gate', () => {
    const result = spawnSync(process.execPath, [runnerPath, '--plan'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('READY_PENDING_EXPLICIT_V6R1E_AUTHORIZATION')
    const preflight = preflightV6(baseEnvironment(), {
      ...matchingPreflightDependencies(),
    })
    expect(preflight.verdict).toBe('READY_FOR_CP3B2A_QA_V6R1E')
    const execute = spawnSync(process.execPath, [runnerPath, '--execute'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CP3B2A_PROJECT_REF: QA_REF },
    })
    expect(execute.status).toBe(1)
    expect(execute.stderr).toContain('BLOCKED: V6R_EXECUTE_BLOCKED')
  })
})
