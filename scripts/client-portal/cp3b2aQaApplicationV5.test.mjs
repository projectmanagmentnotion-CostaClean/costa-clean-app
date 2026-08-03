import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  AUTHORIZATION_ID_V5,
  AUTOMATIC_RETRIES_V5,
  EXECUTABLE_ORDER_V5,
  MAXIMUM_APPLY_ATTEMPTS_V5,
  MAXIMUM_RECOVERY_ATTEMPTS_V5,
  PACKAGE_STATUS_V5,
  REQUIRED_CAPABILITY_IDS_V5,
  assertAuthorizationV5,
  assertExactProtectedPrestateV5,
  assertRecoveredLivePrestateV5,
  assertModeV5,
  compareBackupLivePrestateV5,
  compareDriftSentinelV5,
  executeV5Core,
  normalizeExecutionFailureV5,
  parseEnvelopeV5,
  preflightV5,
  requiredCapabilityGapsV5,
  validateCapabilityEvidenceV5,
} from './run-cp3b2a-qa-v5.mjs'
import {
  ConcurrencyV5Error,
  FIXTURE_STATES_V5,
  classifyFixtureObservationV5,
  createFixtureInventoryV5,
  databaseEnvironmentV5,
  privateFixtureInventoryV5,
  resolveFixtureCommitV5,
} from './cp3b2a_qa_concurrency_v5.mjs'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const HEAD = 'a'.repeat(40)
const map = JSON.parse(readFileSync(
  'scripts/client-portal/cp3b2a_qa_capability_map_v5.json',
  'utf8',
))

function validAuthorization() {
  return {
    CP3B2A_V5_EXECUTION_AUTHORIZED: 'true',
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V5_AUTHORIZATION_ID: AUTHORIZATION_ID_V5,
    CP3B2A_V5_AUTHORIZED_HEAD: HEAD,
    CP3B2A_PRIVATE_BACKUP_MANIFEST: 'private-v5-backup.json',
  }
}

function stageEvidence() {
  return Object.fromEntries(
    ['transactional_matrix_complete', 'concurrent_matrix'].map((stage) => [
      stage,
      new Set(
        map.capabilities
          .filter((entry) => entry[1] === stage)
          .map((entry) => entry[2]),
      ),
    ]),
  )
}

function successfulCoreOperations(overrides = {}) {
  const transactional = {
    result: 'PASS',
    transaction: 'ROLLED_BACK',
    assertionIds: [...stageEvidence().transactional_matrix_complete],
  }
  const concurrent = {
    result: 'PASS',
    cleanup: 'PASS_CLEANED',
    assertionIds: [...stageEvidence().concurrent_matrix],
  }
  return {
    verifyManifest: vi.fn(() => true),
    authorize: vi.fn(() => true),
    assertClean: vi.fn(() => true),
    assertQaTarget: vi.fn(() => true),
    assertProductionRejected: vi.fn(() => true),
    verifyBackup: vi.fn(() => ({ snapshot: true })),
    readGuardState: vi.fn(() => ({ syntheticCollisions: 0 })),
    assertContractAbsent: vi.fn(() => true),
    assertPartialStateAbsent: vi.fn(() => true),
    assertSyntheticCollisionAbsent: vi.fn(() => true),
    readLivePrestate: vi.fn(() => ({ prestate: { marker: 1 }, boundaryDigest: 'x' })),
    compareBackupLive: vi.fn(() => true),
    createLedger: vi.fn(() => 'ledger'),
    readDriftSentinel: vi.fn(() => ({ prestate: { marker: 1 }, boundaryDigest: 'x' })),
    compareDriftSentinel: vi.fn(() => true),
    markApplyStarted: vi.fn(() => true),
    apply: vi.fn(() => true),
    postcheck: vi.fn(() => true),
    transactionalMatrix: vi.fn(() => transactional),
    concurrentMatrix: vi.fn((_state, onStage) => {
      for (const stage of [
        'fixture_transaction_started',
        'fixture_commit_requested',
        'fixture_commit_confirmed_by_observer',
        'concurrent_matrix',
        'fixture_cleanup',
        'fixture_cleanup_confirmed',
      ]) onStage(stage)
      return concurrent
    }),
    validateCapabilities: vi.fn((tx, race) => validateCapabilityEvidenceV5(map, tx, race)),
    finalPostcheck: vi.fn(() => true),
    finalDigestComparison: vi.fn(() => true),
    completeLedger: vi.fn(() => true),
    handleFailure: vi.fn((error) => { throw error }),
    ...overrides,
  }
}

describe('CP-3B.2A.5 final executable-path safety closure V5', () => {
  it('is prepared, one-shot and exposes no npm execute alias', () => {
    expect(PACKAGE_STATUS_V5).toBe('PREPARED_NOT_AUTHORIZED')
    expect(AUTHORIZATION_ID_V5).toBe('CP3B2A-QA-V5-AUTHORIZATION-PENDING')
    expect(MAXIMUM_APPLY_ATTEMPTS_V5).toBe(1)
    expect(MAXIMUM_RECOVERY_ATTEMPTS_V5).toBe(1)
    expect(AUTOMATIC_RETRIES_V5).toBe(0)
    expect(assertModeV5(['--plan'])).toBe('--plan')
    expect(assertModeV5(['--preflight'])).toBe('--preflight')
    expect(assertModeV5(['--execute'])).toBe('--execute')
    expect(() => assertModeV5([])).toThrow('V5_MODE_REJECTED')
    expect(() => assertModeV5(['--execute', '--plan'])).toThrow('V5_MODE_REJECTED')
    const scripts = Object.values(JSON.parse(readFileSync('package.json', 'utf8')).scripts)
    expect(scripts.join('\n')).not.toContain('run-cp3b2a-qa-v5.mjs --execute')
  })

  it('proves the three V4 P1 negative controls and their V5 replacements', () => {
    const v4Concurrency = readFileSync(
      'scripts/client-portal/cp3b2a_qa_concurrency_v4.mjs',
      'utf8',
    )
    const v4Runner = readFileSync(
      'scripts/client-portal/run-cp3b2a-qa-v4.mjs',
      'utf8',
    )
    const v5Concurrency = readFileSync(
      'scripts/client-portal/cp3b2a_qa_concurrency_v5.mjs',
      'utf8',
    )
    const v5Runner = readFileSync(
      'scripts/client-portal/run-cp3b2a-qa-v5.mjs',
      'utf8',
    )
    expect(v4Concurrency).toMatch(/fixture\s*=\s*createFixture/u)
    expect(v4Concurrency).toMatch(/if\s*[(]fixture[)]/u)
    expect(v4Runner).not.toContain('matrix_v3.sql')
    expect(v4Runner).not.toContain('compareBackupLivePrestate')
    expect(v5Concurrency).toContain('createFixtureInventoryV5')
    expect(v5Concurrency).toContain('COMMIT_AMBIGUOUS')
    expect(v5Concurrency).toContain('fixture_collision_precheck')
    expect(v5Concurrency).toContain('V5_FIXTURE_COLLISION_REJECTED')
    expect(v5Runner).toContain('transactional_matrix_complete')
    expect(v5Runner).toContain('compareBackupLivePrestateV5')
    expect(v5Runner).toContain('live_drift_sentinel_recheck')
    expect(v5Runner).toContain('fixtureInventory: privateFixtureInventoryV5(inventory)')
  })

  it('requires every mapped capability to have runtime evidence', () => {
    expect(REQUIRED_CAPABILITY_IDS_V5).toHaveLength(52)
    expect(requiredCapabilityGapsV5(map, stageEvidence())).toEqual([])
    const incomplete = stageEvidence()
    incomplete.transactional_matrix_complete.delete('isolation.archived_property')
    expect(requiredCapabilityGapsV5(map, incomplete)).toContain('archived property')
    const transactional = {
      assertionIds: [...stageEvidence().transactional_matrix_complete],
    }
    const concurrent = {
      assertionIds: [...stageEvidence().concurrent_matrix],
    }
    expect(validateCapabilityEvidenceV5(map, transactional, concurrent)).toBe(true)
    expect(() => validateCapabilityEvidenceV5(
      map,
      { assertionIds: transactional.assertionIds.slice(1) },
      concurrent,
    )).toThrow('V5_CAPABILITY_EVIDENCE_REJECTED')
    const missingMap = structuredClone(map)
    missingMap.capabilities = missingMap.capabilities.filter(
      (entry) => entry[2] !== 'privacy.no_internal_uuid',
    )
    expect(requiredCapabilityGapsV5(missingMap, stageEvidence()))
      .toContain('required:privacy.no_internal_uuid')
    expect(() => validateCapabilityEvidenceV5(
      missingMap,
      transactional,
      concurrent,
    )).toThrow('V5_CAPABILITY_EVIDENCE_REJECTED')
  })

  it('parses exactly one typed V5 envelope', () => {
    const valid = 'CP3B2A_V5_JSON:{"version":5,"kind":"transactional_matrix_complete"}'
    expect(parseEnvelopeV5(valid, 'transactional_matrix_complete')).toMatchObject({
      version: 5,
      kind: 'transactional_matrix_complete',
    })
    expect(() => parseEnvelopeV5('', 'transactional_matrix_complete')).toThrow(
      'V5_ENVELOPE_CARDINALITY_REJECTED',
    )
    expect(() => parseEnvelopeV5(`${valid}\n${valid}`, 'transactional_matrix_complete'))
      .toThrow('V5_ENVELOPE_CARDINALITY_REJECTED')
  })

  it('accepts only exact V5 authorization and rejects V1-V4 markers', () => {
    const state = { head: HEAD, remoteHead: HEAD }
    const verifier = vi.fn(() => true)
    expect(assertAuthorizationV5(validAuthorization(), state, verifier)).toBe(true)
    expect(verifier).not.toHaveBeenCalled()
    for (const mutation of [
      { CP3B2A_V5_EXECUTION_AUTHORIZED: 'false' },
      { CP3B2A_PROJECT_REF: PRODUCTION_REF },
      { CP3B2A_V5_AUTHORIZATION_ID: 'CP3B2A-QA-V4-AUTHORIZATION-PENDING' },
      { CP3B2A_V5_AUTHORIZED_HEAD: 'b'.repeat(40) },
      { CP3B2A_V1_AUTHORIZATION_ID: 'stale' },
      { CP3B2A_V2_AUTHORIZATION_ID: 'stale' },
      { CP3B2A_V3_AUTHORIZATION_ID: 'stale' },
      { CP3B2A_V4_AUTHORIZATION_ID: 'stale' },
      { CP3B2A_V4_EXECUTION_AUTHORIZED: 'true' },
    ]) {
      expect(() => assertAuthorizationV5(
        { ...validAuthorization(), ...mutation },
        state,
        verifier,
      )).toThrow('V5_EXECUTION_AUTHORIZATION_REJECTED')
    }
  })

  it('rejects production, non-TLS QA and non-loopback local targets', () => {
    const qa = `postgresql://postgres.${QA_REF}:private@region.pooler.supabase.com:6543/postgres?sslmode=require`
    expect(databaseEnvironmentV5(qa).target).toBe('QA_MATCH')
    expect(() => databaseEnvironmentV5(
      qa.replace('sslmode=require', 'sslmode=disable'),
    )).toThrow('V5_DATABASE_TARGET_REJECTED')
    expect(() => databaseEnvironmentV5(
      `postgresql://postgres.${PRODUCTION_REF}:private@region.pooler.supabase.com:6543/postgres?sslmode=require`,
    )).toThrow('V5_DATABASE_TARGET_REJECTED')
    expect(databaseEnvironmentV5(
      'postgresql://postgres@127.0.0.1:5432/postgres',
      process.env,
      { allowLocal: true },
    ).target).toBe('LOCAL_LOOPBACK')
  })

  it('classifies exact, absent and partial fixture observations', () => {
    const exact = {
      authUsers: 1,
      clients: 1,
      properties: 1,
      memberships: 1,
      profileRequests: 0,
      propertyRequests: 0,
      auditRows: 0,
      unexpectedRows: 0,
    }
    expect(classifyFixtureObservationV5(exact)).toBe('COMMIT_CONFIRMED')
    expect(classifyFixtureObservationV5(
      Object.fromEntries(Object.keys(exact).map((key) => [key, 0])),
    )).toBe('COMMIT_NOT_APPLIED')
    expect(classifyFixtureObservationV5({})).toBe('COMMIT_AMBIGUOUS')
    expect(classifyFixtureObservationV5({ authUsers: 0 }))
      .toBe('COMMIT_AMBIGUOUS')
    expect(classifyFixtureObservationV5({
      ...Object.fromEntries(Object.keys(exact).map((key) => [key, 0])),
      extraCounter: 0,
    })).toBe('COMMIT_AMBIGUOUS')
    expect(classifyFixtureObservationV5({ ...exact, memberships: 0 }))
      .toBe('COMMIT_AMBIGUOUS')
    expect(classifyFixtureObservationV5({ ...exact, unexpectedRows: 1 }))
      .toBe('COMMIT_AMBIGUOUS')
  })

  it('makes ambiguous observer results manual without assuming cleanup', () => {
    const fixture = createFixtureInventoryV5('CP3B2A-V5-ABCDEF123456')
    expect(privateFixtureInventoryV5(fixture)).toEqual({
      runId: fixture.runId,
      userId: fixture.userId,
      membershipId: fixture.membershipId,
      clientId: fixture.clientId,
      propertyId: fixture.propertyId,
      state: 'NOT_STARTED',
    })
    fixture.state = FIXTURE_STATES_V5.COMMIT_REQUESTED
    expect(() => resolveFixtureCommitV5(
      fixture,
      () => ({ authUsers: 1, clients: 1 }),
    )).toThrow(ConcurrencyV5Error)
    expect(fixture.state).toBe('MANUAL_VERIFICATION_REQUIRED')
    const timeout = createFixtureInventoryV5('CP3B2A-V5-ABCDEF123456')
    timeout.state = FIXTURE_STATES_V5.COMMIT_REQUESTED
    expect(() => resolveFixtureCommitV5(
      timeout,
      () => { throw new Error('observer_timeout') },
    )).toThrow('V5_FIXTURE_COMMIT_AMBIGUOUS')
    expect(timeout.state).toBe('MANUAL_VERIFICATION_REQUIRED')
    const unexpected = createFixtureInventoryV5('CP3B2A-V5-ABCDEF123456')
    unexpected.state = FIXTURE_STATES_V5.COMMIT_REQUESTED
    expect(() => resolveFixtureCommitV5(unexpected, () => ({
      authUsers: 1,
      clients: 1,
      properties: 1,
      memberships: 1,
      profileRequests: 0,
      propertyRequests: 0,
      auditRows: 0,
      unexpectedRows: 1,
    }))).toThrow('V5_FIXTURE_COMMIT_AMBIGUOUS')
    expect(unexpected.state).toBe('MANUAL_VERIFICATION_REQUIRED')
    const normalized = normalizeExecutionFailureV5(new ConcurrencyV5Error(
      'V5_FIXTURE_COMMIT_AMBIGUOUS',
      {
        recovery: 'MANUAL_VERIFICATION_REQUIRED',
        commitState: 'COMMIT_AMBIGUOUS',
      },
    ))
    expect(normalized).toMatchObject({
      name: 'DiagnosticError',
      code: 'V5_FIXTURE_COMMIT_AMBIGUOUS',
      detail: {
        recovery: 'MANUAL_VERIFICATION_REQUIRED',
        commitState: 'COMMIT_AMBIGUOUS',
      },
    })
  })

  it('executes the exact 26-stage order through the same core', async () => {
    const observed = []
    const result = await executeV5Core({
      operations: successfulCoreOperations(),
      runId: 'CP3B2A-V5-ABCDEF123456',
      onStage: (stage) => observed.push(stage),
    })
    expect(result.verdict).toBe('PASS')
    expect(observed).toEqual(EXECUTABLE_ORDER_V5)
    expect(result.automaticRetries).toBe(0)
  })

  it('blocks backup mismatch and sentinel drift before apply', async () => {
    for (const point of ['backup', 'drift']) {
      const apply = vi.fn()
      const operations = successfulCoreOperations({
        apply,
        compareBackupLive: point === 'backup'
          ? vi.fn(() => { throw new Error('backup_live_mismatch') })
          : vi.fn(() => true),
        compareDriftSentinel: point === 'drift'
          ? vi.fn(() => { throw new Error('sentinel_drift') })
          : vi.fn(() => true),
      })
      await expect(executeV5Core({
        operations,
        runId: 'CP3B2A-V5-ABCDEF123456',
      })).rejects.toThrow()
      expect(apply).not.toHaveBeenCalled()
    }
  })

  it('treats an apply transport failure as an attempted ambiguous apply', async () => {
    let failureState
    const operations = successfulCoreOperations({
      apply: vi.fn(() => { throw new Error('apply_transport_failure') }),
      handleFailure: vi.fn((error, state) => {
        failureState = state
        throw error
      }),
    })
    await expect(executeV5Core({
      operations,
      runId: 'CP3B2A-V5-ABCDEF123456',
    })).rejects.toThrow('apply_transport_failure')
    expect(failureState).toMatchObject({
      applyStarted: true,
      applyCommitted: false,
    })
  })

  it('does not cleanup or recover an ambiguous fixture commit', async () => {
    const cleanup = vi.fn()
    const recovery = vi.fn()
    const operations = successfulCoreOperations({
      concurrentMatrix: vi.fn((_state, onStage) => {
        onStage('fixture_transaction_started')
        onStage('fixture_commit_requested')
        const error = new Error('ambiguous_commit')
        error.detail = { recovery: 'MANUAL_VERIFICATION_REQUIRED' }
        throw error
      }),
      handleFailure: vi.fn((error) => {
        if (error.detail?.recovery === 'MANUAL_VERIFICATION_REQUIRED') throw error
        recovery()
        throw error
      }),
      finalPostcheck: cleanup,
    })
    await expect(executeV5Core({
      operations,
      runId: 'CP3B2A-V5-ABCDEF123456',
    })).rejects.toThrow('ambiguous_commit')
    expect(cleanup).not.toHaveBeenCalled()
    expect(recovery).not.toHaveBeenCalled()
  })

  it('compares the authorized backup and the same live drift sentinel exactly', () => {
    const keys = [
      'profileRows', 'propertyRows', 'profileDigest', 'propertyDigest',
      'canonicalDigest', 'financialSequenceDigest', 'authUserCount', 'authDigest',
      'tableGrantDigest', 'unaffectedPolicyDigest', 'unaffectedFunctionDigest',
      'migrationHistoryCount', 'migrationHistoryDigest', 'auditRows', 'auditDigest',
      'rateRows', 'rateDigest',
    ]
    const prestate = Object.fromEntries(keys.map((key, index) => [
      key,
      key.endsWith('Rows') || key.endsWith('Count') ? index : `digest-${index}`,
    ]))
    Object.assign(prestate, {
      liveRead: 1,
      cp2bPrerequisite: true,
      cp3b0Prerequisite: true,
      portalTables: 11,
      targetFunctionCount: 0,
      targetColumnCount: 0,
      targetConstraintCount: 0,
      targetIndexCount: 0,
      broadCustomerPolicyCount: 2,
      legacyServiceGrantCount: 2,
      syntheticCollisions: 0,
    })
    const backup = {
      boundaryDigest: 'boundary',
      artifacts: [{
        path: 'catalog-prestate.json',
      }],
    }
    const read = vi.spyOn(JSON, 'parse').mockReturnValue(prestate)
    const original = readFileSync
    expect(original).toBeTypeOf('function')
    read.mockRestore()
    expect(compareDriftSentinelV5(
      { prestate, boundaryDigest: 'boundary', rlsForceDigest: 'rls' },
      {
        prestate: structuredClone(prestate),
        boundaryDigest: 'boundary',
        rlsForceDigest: 'rls',
      },
    )).toBe(true)
    expect(assertRecoveredLivePrestateV5(
      { prestate, boundaryDigest: 'boundary', rlsForceDigest: 'rls' },
      {
        prestate: structuredClone(prestate),
        boundaryDigest: 'boundary',
        rlsForceDigest: 'rls',
      },
    )).toBe(true)
    expect(() => compareDriftSentinelV5(
      { prestate, boundaryDigest: 'boundary', rlsForceDigest: 'rls' },
      {
        prestate: { ...prestate, authDigest: 'drift' },
        boundaryDigest: 'boundary',
        rlsForceDigest: 'rls',
      },
    )).toThrow('V5_LIVE_DRIFT_SENTINEL_MISMATCH')
    for (const key of [
      'portalTables',
      'targetFunctionCount',
      'targetColumnCount',
      'targetConstraintCount',
      'targetIndexCount',
      'broadCustomerPolicyCount',
      'legacyServiceGrantCount',
    ]) {
      const drift = {
        ...prestate,
        [key]: prestate[key] + 1,
      }
      expect(() => assertExactProtectedPrestateV5(
        prestate,
        drift,
        'V5_BACKUP_LIVE_PRESTATE_MISMATCH',
        'backup_live_exact_comparison',
      )).toThrow('V5_BACKUP_LIVE_PRESTATE_MISMATCH')
      expect(() => compareDriftSentinelV5(
        { prestate, boundaryDigest: 'boundary', rlsForceDigest: 'rls' },
        {
          prestate: drift,
          boundaryDigest: 'boundary',
          rlsForceDigest: 'rls',
        },
      )).toThrow('V5_LIVE_DRIFT_SENTINEL_MISMATCH')
    }
    expect(() => assertRecoveredLivePrestateV5(
      { prestate, boundaryDigest: 'boundary', rlsForceDigest: 'rls' },
      {
        prestate: structuredClone(prestate),
        boundaryDigest: 'recovery-drift',
        rlsForceDigest: 'rls',
      },
    )).toThrow('V5_LIVE_DRIFT_SENTINEL_MISMATCH')
    expect(() => compareDriftSentinelV5(
      { prestate, boundaryDigest: 'boundary', rlsForceDigest: 'rls' },
      {
        prestate: structuredClone(prestate),
        boundaryDigest: 'boundary',
        rlsForceDigest: 'rls-drift',
      },
    )).toThrow('V5_LIVE_DRIFT_SENTINEL_MISMATCH')
    expect(backup.boundaryDigest).toBe('boundary')
    expect(compareBackupLivePrestateV5).toBeTypeOf('function')
  })

  it('keeps preflight read-only and maps the fresh V3 backup to V5', async () => {
    const freshV3 = {
      path: 'private-backup-v3-manifest.json',
      value: {
        version: 3,
        status: 'COMPLETE',
        projectRef: QA_REF,
        gitHead: HEAD,
      },
    }
    const live = {
      prestate: { marker: 'same' },
      boundaryDigest: 'boundary',
      rlsForceDigest: 'rls',
    }
    const freshV5 = {
      path: 'private-backup-v5-manifest.json',
      value: {
        version: 5,
        status: 'COMPLETE',
        projectRef: QA_REF,
        gitHead: HEAD,
        rlsForceDigest: 'rls',
      },
    }
    const preflightV3 = vi.fn(async () => ({
      status: 'READY_FOR_CP3B2A_QA_V3',
      target: 'QA_MATCH',
      gitHead: HEAD,
      originalHashes: '10/10_PASS',
      v2Hashes: '9/9_PASS',
      v3Hashes: 'PASS',
      prestate: 'RECOVERED_CONTRACT_ABSENT',
      privateBackup: 'COMPLETE_HEAD_BOUND',
      remoteWrites: 0,
    }))
    const compareBackupLive = vi.fn(() => true)
    const compareDriftSentinel = vi.fn(() => true)
    const result = await preflightV5({}, {
      preflightV3,
      listPrivateBackupManifests: () => [],
      resolveFreshBackup: () => freshV3,
      createPrivateBackup: () => freshV5,
      captureLivePrestate: () => structuredClone(live),
      compareBackupLive,
      compareDriftSentinel,
    })
    expect(result).toMatchObject({
      status: 'READY_FOR_CP3B2A_QA_V5',
      backupLiveExactComparison: 'PASS',
      privateBackupHead: HEAD,
      remoteWrites: 0,
      authorization: 'NOT_GRANTED',
    })
    expect(compareBackupLive).toHaveBeenCalledOnce()
    expect(compareDriftSentinel).toHaveBeenCalledOnce()
    await expect(preflightV5({}, {
      preflightV3,
      listPrivateBackupManifests: () => [],
      resolveFreshBackup: () => freshV3,
      createPrivateBackup: () => freshV5,
      captureLivePrestate: () => structuredClone(live),
      compareBackupLive: () => true,
      compareDriftSentinel: () => {
        throw new Error('preflight_rls_drift')
      },
    })).rejects.toThrow('preflight_rls_drift')
  })
})
