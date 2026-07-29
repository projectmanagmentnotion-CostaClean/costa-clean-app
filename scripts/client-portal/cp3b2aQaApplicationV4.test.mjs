import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  AUTHORIZATION_ID_V4,
  AUTOMATIC_RETRIES_V4,
  MAXIMUM_APPLY_ATTEMPTS_V4,
  MAXIMUM_RECOVERY_ATTEMPTS_V4,
  PACKAGE_STATUS_V4,
  assertAuthorizationV4,
  assertRecoveredPrestateV4,
  assertModeV4,
  parseEnvelopeV4,
  preflightV4,
  requiredCapabilityGapsV4,
} from './run-cp3b2a-qa-v4.mjs'
import {
  ConcurrencyV4Error,
  annotateCleanupFailureV4,
  awaitWorkersV4,
  databaseEnvironmentV4,
  validateRaceEvidenceV4,
} from './cp3b2a_qa_concurrency_v4.mjs'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const HEAD = 'a'.repeat(40)

function validAuthorization() {
  return {
    CP3B2A_V4_EXECUTION_AUTHORIZED: 'true',
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V4_AUTHORIZATION_ID: AUTHORIZATION_ID_V4,
    CP3B2A_V4_AUTHORIZED_HEAD: HEAD,
    CP3B2A_PRIVATE_BACKUP_MANIFEST: 'private-v4-backup.json',
  }
}

describe('CP-3B.2A.4 V4 executable authorization and concurrency package', () => {
  it('is prepared, one-shot and exposes no npm execute alias', () => {
    expect(PACKAGE_STATUS_V4).toBe('PREPARED_NOT_AUTHORIZED')
    expect(AUTHORIZATION_ID_V4).toBe('CP3B2A-QA-V4-AUTHORIZATION-PENDING')
    expect(MAXIMUM_APPLY_ATTEMPTS_V4).toBe(1)
    expect(MAXIMUM_RECOVERY_ATTEMPTS_V4).toBe(1)
    expect(AUTOMATIC_RETRIES_V4).toBe(0)
    expect(assertModeV4(['--plan'])).toBe('--plan')
    expect(assertModeV4(['--preflight'])).toBe('--preflight')
    expect(assertModeV4(['--execute'])).toBe('--execute')
    expect(() => assertModeV4([])).toThrow('V4_MODE_REJECTED')
    expect(() => assertModeV4(['--execute', '--plan'])).toThrow('V4_MODE_REJECTED')
    const scripts = Object.values(
      JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {},
    ).join('\n')
    expect(scripts).not.toContain('run-cp3b2a-qa-v4.mjs --execute')
  })

  it('fails the V3 capability contract and passes the V4 contract', () => {
    const v3Matrix = readFileSync(
      'scripts/client-portal/cp3b2a_qa_matrix_v3.sql',
      'utf8',
    )
    const v3Runner = readFileSync(
      'scripts/client-portal/run-cp3b2a-qa-v3.mjs',
      'utf8',
    )
    const v4Matrix = readFileSync(
      'scripts/client-portal/cp3b2a_qa_matrix_v4.sql',
      'utf8',
    )
    const v4Concurrency = readFileSync(
      'scripts/client-portal/cp3b2a_qa_concurrency_v4.mjs',
      'utf8',
    )
    expect(requiredCapabilityGapsV4(v3Matrix, v3Runner)).toEqual(expect.arrayContaining([
      'anonActualRpc',
      'noMembershipRpc',
      'revokedMembershipRpc',
      'invalidPayloadRpc',
      'outsideAllowlistRpc',
      'separateSessions',
      'realBarrier',
      'simultaneousConflict',
    ]))
    expect(requiredCapabilityGapsV4(v4Matrix, v4Concurrency)).toEqual([])
  })

  it('parses exactly one typed V4 envelope', () => {
    const valid = 'CP3B2A_V4_JSON:{"version":4,"kind":"transactional_matrix"}'
    expect(parseEnvelopeV4(valid, 'transactional_matrix')).toMatchObject({
      version: 4,
      kind: 'transactional_matrix',
    })
    expect(() => parseEnvelopeV4('', 'transactional_matrix')).toThrow(
      'V4_ENVELOPE_CARDINALITY_REJECTED',
    )
    expect(() => parseEnvelopeV4(`${valid}\n${valid}`, 'transactional_matrix')).toThrow(
      'V4_ENVELOPE_CARDINALITY_REJECTED',
    )
    expect(() => parseEnvelopeV4(
      'CP3B2A_V4_JSON:{"version":4,"kind":"wrong"}',
      'transactional_matrix',
    )).toThrow('V4_ENVELOPE_KIND_REJECTED')
  })

  it('accepts only exact V4 authorization, HEAD and backup identity', () => {
    const gitState = { head: HEAD, remoteHead: HEAD }
    const verifier = vi.fn(() => true)
    expect(assertAuthorizationV4(validAuthorization(), gitState, verifier)).toBe(true)
    expect(verifier).toHaveBeenCalledWith('private-v4-backup.json', HEAD)
    for (const mutation of [
      { CP3B2A_V4_EXECUTION_AUTHORIZED: 'false' },
      { CP3B2A_PROJECT_REF: PRODUCTION_REF },
      { CP3B2A_V4_AUTHORIZATION_ID: 'CP3B2A-QA-V3-AUTHORIZATION-PENDING' },
      { CP3B2A_V4_AUTHORIZED_HEAD: 'b'.repeat(40) },
      { CP3B2A_V3_EXECUTION_AUTHORIZED: 'true' },
      { CP3B2A_V3_AUTHORIZATION_ID: 'CP3B2A-QA-V3-AUTHORIZATION-PENDING' },
      { CP3B2A_V1_AUTHORIZATION_ID: 'CP3B2A-QA-V1-AUTHORIZATION-STALE' },
      { CP3B2A_V1_EXECUTION_AUTHORIZED: 'true' },
    ]) {
      expect(() => assertAuthorizationV4(
        { ...validAuthorization(), ...mutation },
        gitState,
        verifier,
      )).toThrow('V4_EXECUTION_AUTHORIZATION_REJECTED')
    }
    expect(() => assertAuthorizationV4(
      validAuthorization(),
      { head: HEAD, remoteHead: 'c'.repeat(40) },
      verifier,
    )).toThrow('V4_EXECUTION_AUTHORIZATION_REJECTED')
    expect(() => assertAuthorizationV4(
      validAuthorization(),
      gitState,
      () => { throw new Error('stale backup') },
    )).toThrow('stale backup')
  })

  it('rejects production, non-TLS QA and non-loopback local targets', () => {
    const qa = `postgresql://postgres.${QA_REF}:private@region.pooler.supabase.com:6543/postgres?sslmode=require`
    expect(databaseEnvironmentV4(qa).target).toBe('QA_MATCH')
    expect(() => databaseEnvironmentV4(
      qa.replace('sslmode=require', 'sslmode=disable'),
    )).toThrow('V4_DATABASE_TARGET_REJECTED')
    expect(() => databaseEnvironmentV4(
      `postgresql://postgres.${PRODUCTION_REF}:private@region.pooler.supabase.com:6543/postgres?sslmode=require`,
    )).toThrow('V4_DATABASE_TARGET_REJECTED')
    expect(() => databaseEnvironmentV4(
      'postgresql://postgres@remote.example.invalid:5432/postgres',
      process.env,
      { allowLocal: true },
    )).toThrow('V4_DATABASE_TARGET_REJECTED')
    expect(databaseEnvironmentV4(
      'postgresql://postgres@127.0.0.1:5432/postgres',
      process.env,
      { allowLocal: true },
    ).target).toBe('LOCAL_LOOPBACK')
  })

  it('requires exact retry receipt, single request/audit and single rate use', () => {
    const receipt = {
      reference: 'CC-PR-00112233445566778899AABB',
      status: 'pending_review',
      requestedAt: '2026-07-29T10:00:00.000Z',
      changedFields: ['phone'],
      requestType: 'profile',
    }
    expect(validateRaceEvidenceV4({
      mode: 'retry',
      workers: [
        { status: 'receipt', receipt },
        { status: 'receipt', receipt: structuredClone(receipt) },
      ],
      requestCount: 1,
      auditCount: 1,
      rateDelta: 1,
    })).toBe(true)
    for (const bad of [
      { requestCount: 2 },
      { auditCount: 2 },
      { rateDelta: 2 },
      {
        workers: [
          { status: 'receipt', receipt },
          { status: 'receipt', receipt: { ...receipt, requestedAt: 'different' } },
        ],
      },
    ]) {
      expect(() => validateRaceEvidenceV4({
        mode: 'retry',
        workers: [
          { status: 'receipt', receipt },
          { status: 'receipt', receipt: structuredClone(receipt) },
        ],
        requestCount: 1,
        auditCount: 1,
        rateDelta: 1,
        ...bad,
      })).toThrow(ConcurrencyV4Error)
    }
  })

  it('requires exactly one success and one deterministic 23505 conflict', () => {
    expect(validateRaceEvidenceV4({
      mode: 'conflict',
      workers: [
        { status: 'receipt', receipt: { reference: 'one' } },
        { status: 'conflict', sqlState: '23505' },
      ],
      requestCount: 1,
      auditCount: 1,
      rateDelta: 1,
    })).toBe(true)
    expect(() => validateRaceEvidenceV4({
      mode: 'conflict',
      workers: [
        { status: 'receipt', receipt: { reference: 'one' } },
        { status: 'receipt', receipt: { reference: 'two' } },
      ],
      requestCount: 1,
      auditCount: 1,
      rateDelta: 1,
    })).toThrow('V4_DETERMINISTIC_CONFLICT_REJECTED')
  })

  it('makes fixture creation atomic and marks every cleanup failure manual', () => {
    const source = readFileSync(
      'scripts/client-portal/cp3b2a_qa_concurrency_v4.mjs',
      'utf8',
    )
    const createFixtureBody = source.slice(
      source.indexOf('function createFixture'),
      source.indexOf('function cleanupFixture'),
    )
    expect(createFixtureBody).toMatch(/begin;[\s\S]*insert into auth[.]users/u)
    expect(createFixtureBody).toMatch(/insert into public[.]client_portal_memberships[\s\S]*commit;/u)
    const cleanup = new ConcurrencyV4Error('cleanup_failed')
    expect(annotateCleanupFailureV4(cleanup)).toBe(cleanup)
    expect(cleanup.detail.recovery).toBe('MANUAL_VERIFICATION_REQUIRED')
    const primary = new ConcurrencyV4Error('matrix_failed')
    expect(annotateCleanupFailureV4(cleanup, primary)).toBe(primary)
    expect(primary.detail.recovery).toBe('MANUAL_VERIFICATION_REQUIRED')
  })

  it('bounds worker completion and terminates owned sessions on timeout', async () => {
    const killed = []
    const workers = [0, 1].map((id) => ({
      child: {
        killed: false,
        kill() {
          this.killed = true
          killed.push(id)
        },
      },
      completed: new Promise(() => {}),
    }))
    await expect(awaitWorkersV4(workers, 5)).rejects.toThrow(
      'V4_WORKER_COMPLETION_TIMEOUT',
    )
    expect(killed.sort()).toEqual([0, 1])
  })

  it('keeps preflight read-only and maps a V3 read-only result to V4', async () => {
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
    // Manifest verification is covered by the local proof; this unit isolates mapping only.
    const manifest = JSON.parse(readFileSync(
      'scripts/client-portal/cp3b2a_qa_package_v4.manifest.json',
      'utf8',
    ))
    expect(manifest.status).toBe('PREPARED_NOT_AUTHORIZED')
    const result = await preflightV4({}, { preflightV3 })
    expect(preflightV3).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      status: 'READY_FOR_CP3B2A_QA_V4',
      remoteWrites: 0,
      authorization: 'NOT_GRANTED',
    })
  })

  it('retains the current failing stage in the frozen V3 failure envelope', () => {
    const source = readFileSync(
      'scripts/client-portal/run-cp3b2a-qa-v4.mjs',
      'utf8',
    )
    for (const stage of [
      'apply',
      'postcheck',
      'transactional_matrix',
      'concurrent_matrix',
      'final_postcheck',
    ]) expect(source).toContain(`currentStage = '${stage}'`)
    expect(source).toMatch(/buildFailureEnvelopeV3\(\{[\s\S]*stage: currentStage/u)
    expect(source).not.toMatch(/stage: stages[.]at/u)
  })

  it('rejects any recovery prestate digest drift', () => {
    const expected = {
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
      profileRows: 1,
      propertyRows: 1,
      profileDigest: 'profile',
      propertyDigest: 'property',
      canonicalDigest: 'canonical',
      financialSequenceDigest: 'financial',
      authUserCount: 1,
      authDigest: 'auth',
      tableGrantDigest: 'grants',
      unaffectedPolicyDigest: 'policies',
      unaffectedFunctionDigest: 'functions',
      migrationHistoryCount: 1,
      migrationHistoryDigest: 'history',
    }
    expect(assertRecoveredPrestateV4(expected, structuredClone(expected))).toBe(true)
    for (const key of [
      'authDigest',
      'canonicalDigest',
      'profileDigest',
      'propertyDigest',
      'tableGrantDigest',
      'unaffectedPolicyDigest',
      'migrationHistoryDigest',
    ]) {
      expect(() => assertRecoveredPrestateV4(
        expected,
        { ...expected, [key]: 'drift' },
      )).toThrow('V4_RECOVERY_PRESTATE_DRIFT')
    }
  })
})
