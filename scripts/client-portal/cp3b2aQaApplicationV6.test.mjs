import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_ID_V6,
  EXECUTABLE_ORDER_V6,
  GATE_V6,
  PACKAGE_STATUS_V6,
  QA_REF,
  SOURCE_BASE_HEAD,
  assertExecutionAuthorizationV6,
  preflightV6,
  verifyPackageManifestV6,
  executeV6Core,
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
    CP3B2A_V6_AUTHORIZATION_ID: AUTHORIZATION_ID_V6,
    CP3B2A_V6_AUTHORIZED_HEAD: SOURCE_BASE_HEAD,
    CP3B2A_V6_EXECUTION_AUTHORIZED: 'true',
  }
}

function matchingPreflightDependencies() {
  const prestate = {
    marker: 'same',
  }
  return {
    gitState: () => ({
      branch: 'main',
      head: SOURCE_BASE_HEAD,
      remoteHead: SOURCE_BASE_HEAD,
      clean: true,
      divergence: [0, 0],
    }),
    assertQaTarget: () => ({ target: 'QA_MATCH', tls: 'REQUIRED' }),
    assertProductionRejected: () => true,
    createPrivateBackup: () => ({
      path: '/tmp/private-backup-v6-manifest.json',
      value: { prestate },
    }),
    verifyPrivateBackup: () => ({
      path: '/tmp/private-backup-v6-manifest.json',
      value: { prestate },
    }),
    readLivePrestate: () => prestate,
    readDriftSentinel: () => prestate,
  }
}

describe('CP-3B.2A.6 reproducible rebaseline V6', () => {
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

  it('validates the V6 manifest and package contract', () => {
    const { manifest, expected } = verifyPackageManifestV6()
    expect(manifest.gate).toBe(GATE_V6)
    expect(manifest.status).toBe(PACKAGE_STATUS_V6)
    expect(manifest.authorizationId).toBe(AUTHORIZATION_ID_V6)
    expect(manifest.sourceBaseHead).toBe(SOURCE_BASE_HEAD)
    expect(expected.map((entry) => entry.path)).toHaveLength(9)
  })

  it('preflights read-only and creates a fresh private backup model', () => {
    const result = preflightV6(baseEnvironment(), matchingPreflightDependencies())
    expect(result.verdict).toBe('READY_FOR_CP3B2A_QA_V6')
    expect(result.backupLiveExactComparison).toBe('PASS')
    expect(result.driftSentinel).toBe('PASS')
    expect(result.remoteWrites).toBe(0)
  })

  it('rejects execute without the exact V6 authorization', () => {
    expect(() => assertExecutionAuthorizationV6({}, SOURCE_BASE_HEAD))
      .toThrow('V6_EXECUTION_NOT_AUTHORIZED')
    expect(() => assertExecutionAuthorizationV6({
      ...baseEnvironment(),
      CP3B2A_V6_AUTHORIZED_HEAD: 'b'.repeat(40),
    }, SOURCE_BASE_HEAD)).toThrow('V6_AUTHORIZED_HEAD_MISMATCH')
  })

  it('enforces the exact 26-stage order', async () => {
    const operations = {
      verifyManifest: () => true,
      authorize: () => ({ head: SOURCE_BASE_HEAD, clean: true }),
      assertClean: () => true,
      assertQaTarget: () => true,
      assertProductionRejected: () => true,
      verifyBackup: () => ({ value: { prestate: { marker: 'same' } } }),
      assertContractAbsent: () => ({}),
      assertPartialStateAbsent: () => true,
      assertSyntheticCollisionAbsent: () => true,
      readLivePrestate: () => ({ marker: 'same' }),
      compareBackupLive: () => true,
      createLedger: () => '/tmp/ledger.json',
      readDriftSentinel: () => ({ marker: 'same' }),
      compareDriftSentinel: () => true,
      markApplyStarted: () => true,
      apply: () => true,
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
      runId: 'CP3B2A-V6-ABCDEF123456',
      onStage: (stage) => observed.push(stage),
    })
    expect(result.verdict).toBe('PASS')
    expect(observed).toEqual(EXECUTABLE_ORDER_V6)
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
    const fixture = createFixtureInventoryV6('CP3B2A-V6-ABCDEF123456')
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
    const result = runConcurrencyV6({ runId: 'CP3B2A-V6-ABCDEF123456' })
    expect(result.result).toBe('PASS')
    expect(result.cleanup).toBe('PASS_CLEANED')
    expect(result.syntheticResidue).toBe(0)
    expect(result.authResidue).toBe(0)
    expect(result.canonicalResidue).toBe(0)
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
    expect(result.stdout).toContain('READY_PENDING_EXPLICIT_V6_AUTHORIZATION')
    const preflight = preflightV6(baseEnvironment(), {
      ...matchingPreflightDependencies(),
    })
    expect(preflight.verdict).toBe('READY_FOR_CP3B2A_QA_V6')
    const execute = spawnSync(process.execPath, [runnerPath, '--execute'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CP3B2A_PROJECT_REF: QA_REF },
    })
    expect(execute.status).toBe(1)
    expect(execute.stderr).toContain('BLOCKED: V6_EXECUTE_BLOCKED')
  })
})
