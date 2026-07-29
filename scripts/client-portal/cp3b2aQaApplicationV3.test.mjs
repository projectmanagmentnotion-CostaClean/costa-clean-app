import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  ASSERTION_IDS,
  AUTHORIZATION_ID,
  DiagnosticError,
  PACKAGE_STATUS,
  PRE_EFFECT_ORDER,
  PRODUCTION_REF,
  QA_REF,
  applyFailureEnvelopeUpdateV3,
  assertLedgerIdentityV3,
  assertModeV3,
  assertNoSecretsV3,
  assertNoSyntheticCollisionsV3,
  buildFailureEnvelopeV3,
  executeV3TestHarness,
  parseDatabaseTarget,
  parseEnvelopeV3,
  parseSingleJsonV3,
  publicFailureSummaryV3,
  runObservedProcessV3,
  sanitizeFailureV3,
  validateDetailedPostcheckV3,
} from './run-cp3b2a-qa-v3.mjs'

const RUN_ID = 'CP3B2A-V3-ABCDEF123456'

function validPrestate() {
  return {
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
    tableGrantDigest: 'table-grants',
    unaffectedPolicyDigest: 'policies',
    unaffectedFunctionDigest: 'functions',
    migrationHistoryCount: 1,
    migrationHistoryDigest: 'history',
    auditRows: 1,
    auditDigest: 'audit',
    rateRows: 1,
    rateDigest: 'rate',
  }
}

function validPoststate(prestate = validPrestate()) {
  return {
    ...Object.fromEntries([
      'profileRows',
      'propertyRows',
      'profileDigest',
      'propertyDigest',
      'canonicalDigest',
      'financialSequenceDigest',
      'authUserCount',
      'authDigest',
      'tableGrantDigest',
      'unaffectedPolicyDigest',
      'unaffectedFunctionDigest',
      'migrationHistoryCount',
      'migrationHistoryDigest',
      'auditRows',
      'auditDigest',
      'rateRows',
      'rateDigest',
    ].map((key) => [key, prestate[key]])),
    functionCount: 7,
    functionContractPass: true,
    columnCount: 4,
    constraintCount: 2,
    constraintDefinitionPass: true,
    indexCount: 4,
    broadCustomerPolicyCount: 0,
    internalStaffPolicyCount: 2,
    legacyServiceGrantCount: 0,
    newColumnsNullForHistoricalRows: true,
  }
}

function validDetailedPostcheck() {
  return {
    version: 3,
    kind: 'postcheck',
    result: 'PASS',
    checks: Array.from({ length: 48 }, (_, index) => ({
      id: `V3-SYNTHETIC-${index}`,
      object: `other:synthetic-${index}`,
      pass: true,
      expected: { value: index },
      actual: { value: index },
    })),
  }
}

function makeHarness(overrides = {}) {
  const prestate = validPrestate()
  const context = {
    gitState: { head: 'a'.repeat(40) },
    backup: { boundaryDigest: 'boundary' },
    backupManifestPath: 'private-backup',
    prestate,
    runId: RUN_ID,
  }
  const events = []
  const handles = []
  const ledgerStates = []
  const operations = {
    preEffect: async () => {
      events.push('pre_effect')
      return context
    },
    createLedger: () => {
      events.push('ledger')
      return 'private-ledger'
    },
    updateLedger: (_path, state) => {
      events.push(`ledger:${state}`)
      ledgerStates.push(state)
    },
    persistFailure: (envelope) => {
      events.push('failure_persisted')
      const handle = { envelope: structuredClone(envelope) }
      handles.push(handle)
      return handle
    },
    verifyFailure: (handle) => {
      events.push('failure_verified')
      if (handle.envelope.version !== 3) throw new Error('unreadable')
      return handle.envelope
    },
    updateFailure: (handle, patch) => {
      events.push(`failure_updated:${patch.recoveryOutcome ?? 'pending'}`)
      handle.envelope = applyFailureEnvelopeUpdateV3(handle.envelope, patch)
      return handle.envelope
    },
    apply: async () => {
      events.push('apply')
    },
    postcheckState: async () => {
      events.push('postcheck_state')
      return validPoststate(prestate)
    },
    postcheckDetails: async () => {
      events.push('postcheck_details')
      return validDetailedPostcheck()
    },
    matrix: async () => {
      events.push('matrix')
      return { version: 3, kind: 'matrix', result: 'PASS', transaction: 'ROLLED_BACK' }
    },
    residue: async () => {
      events.push('residue')
      return 0
    },
    finalPostcheckState: async () => validPoststate(prestate),
    finalPostcheckDetails: async () => validDetailedPostcheck(),
    reconcile: async () => false,
    recoveryEligibility: async () => {
      events.push('recovery_eligible')
      return true
    },
    rollback: async () => {
      events.push('rollback')
      return 'synthetic rollback'
    },
    parseRollback: async () => ({
      legacy: {
        result: 'PASS',
        contractAbsent: true,
        customerPoliciesRestored: true,
        legacyServiceGrantsRestored: true,
      },
      envelope: { version: 3, kind: 'rollback', result: 'PASS' },
    }),
    recoveryPrecheck: async () => prestate,
    boundaryDigest: async () => 'boundary',
    writeSuccessCandidate: () => {
      events.push('success_candidate')
      return 'private-success-candidate'
    },
    finalizeSuccessReport: () => events.push('success_finalized'),
    invalidateSuccessCandidate: () => events.push('success_invalidated'),
    ...overrides,
  }
  return { operations, context, prestate, events, handles, ledgerStates }
}

async function expectBlocked(harness) {
  let caught
  try {
    await executeV3TestHarness({}, harness.operations, RUN_ID)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(DiagnosticError)
  expect(caught.code).toBe('V3_EXECUTION_FAILED')
  expect(harness.handles).toHaveLength(1)
  return {
    error: caught,
    envelope: harness.handles[0].envelope,
    publicFailure: caught.detail.publicFailure,
  }
}

describe('CP-3B.2A.3 V3 observability package', () => {
  it('is prepared but not authorized and rejects all mode ambiguity', () => {
    expect(PACKAGE_STATUS).toBe('PREPARED_NOT_AUTHORIZED')
    expect(AUTHORIZATION_ID).toBe('CP3B2A-QA-V3-AUTHORIZATION-PENDING')
    expect(assertModeV3(['--plan'])).toBe('--plan')
    expect(assertModeV3(['--preflight'])).toBe('--preflight')
    expect(assertModeV3(['--execute'])).toBe('--execute')
    expect(() => assertModeV3([])).toThrow('V3_MODE_REJECTED')
    expect(() => assertModeV3(['--execute', '--plan'])).toThrow('V3_MODE_REJECTED')
    expect(PRE_EFFECT_ORDER.at(-2)).toBe('attempt_ledger_create')
    expect(PRE_EFFECT_ORDER.at(-1)).toBe('apply_started')
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(Object.values(packageJson.scripts ?? {}).join('\n')).not.toContain(
      'run-cp3b2a-qa-v3.mjs --execute',
    )
  })

  it('defines every stable assertion family required by the manifest', () => {
    for (const id of [
      'V3-COLUMN-COUNT',
      'V3-COLUMN-DEFINITION',
      'V3-CONSTRAINT-DEFINITION',
      'V3-INDEX-DEFINITION',
      'V3-FUNCTION-SIGNATURE',
      'V3-FUNCTION-OWNER',
      'V3-FUNCTION-SEARCH-PATH',
      'V3-FUNCTION-GRANTS',
      'V3-POLICY-COUNT',
      'V3-LEGACY-GRANT-COUNT',
      'V3-HISTORICAL-DIGEST',
      'V3-CANONICAL-DIGEST',
      'V3-FINANCIAL-SEQUENCE-DIGEST',
      'V3-MIGRATION-HISTORY-DIGEST',
    ]) expect(ASSERTION_IDS).toContain(id)
  })

  it('distinguishes empty, malformed, multiple and wrong-kind JSON', () => {
    expect(() => parseSingleJsonV3('')).toThrow('POSTGRES_JSON_EMPTY')
    expect(() => parseSingleJsonV3('{bad json}')).toThrow('POSTGRES_JSON_PARSE_REJECTED')
    expect(() => parseSingleJsonV3('{"a":1}\n{"b":2}')).toThrow(
      'POSTGRES_JSON_CARDINALITY_REJECTED',
    )
    expect(() => parseEnvelopeV3('', 'matrix')).toThrow('V3_ENVELOPE_EMPTY')
    expect(() => parseEnvelopeV3(
      'CP3B2A_V3_JSON:{bad json}',
      'matrix',
    )).toThrow('V3_ENVELOPE_PARSE_REJECTED')
    expect(() => parseEnvelopeV3(
      'CP3B2A_V3_JSON:{"version":3,"kind":"postcheck"}',
      'matrix',
    )).toThrow('V3_ENVELOPE_KIND_REJECTED')
  })

  it('classifies real process outcomes and retains sanitized SQLSTATE evidence', () => {
    const sqlFailure = () => runObservedProcessV3(
      'psql',
      [],
      { source: 'postgres', stage: 'postcheck' },
      () => ({
        status: 3,
        stdout: '',
        stderr: 'ERROR: P0001: assertion_failed:V3-POLICY-COUNT',
        signal: null,
      }),
    )
    expect(sqlFailure).toThrow('POSTGRES_SQL_ERROR')
    try {
      sqlFailure()
    } catch (error) {
      const failure = sanitizeFailureV3(error, 'postcheck')
      expect(failure).toMatchObject({
        failureCategory: 'sql',
        failureCode: 'POSTGRES_SQL_ERROR',
        sqlState: 'P0001',
        postgresOutputReceived: true,
      })
    }
    expect(() => runObservedProcessV3(
      'psql',
      [],
      { source: 'postgres', stage: 'apply' },
      () => ({ error: { code: 'ETIMEDOUT' }, status: null, stdout: '', stderr: '' }),
    )).toThrow('PROCESS_TIMEOUT')
    expect(() => runObservedProcessV3(
      'psql',
      [],
      { source: 'postgres', stage: 'apply' },
      () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }),
    )).toThrow('PROCESS_ABORTED')
  })

  it('persists and verifies a precheck failure without ledger, apply or recovery', async () => {
    const harness = makeHarness({
      preEffect: async () => {
        throw new DiagnosticError('POSTGRES_SQL_ERROR', {
          sqlState: '42501',
          stderr: 'private path C:\\Users\\private and user@example.invalid',
        })
      },
    })
    const { envelope } = await expectBlocked(harness)
    expect(envelope).toMatchObject({
      stage: 'pre_effect',
      failureCategory: 'sql',
      sqlState: '42501',
      applyStarted: false,
      recoveryOutcome: 'not_required',
      automaticRetryCount: 0,
    })
    expect(harness.events).toEqual([
      'failure_persisted',
      'failure_verified',
      'failure_updated:not_required',
    ])
    expect(envelope.privateEvidence.stderr).not.toContain('C:\\Users')
    expect(envelope.privateEvidence.stderr).not.toContain('@example.invalid')
  })

  it('does not recover an apply SQL failure when reconciliation proves absence', async () => {
    const harness = makeHarness({
      apply: async () => {
        throw new DiagnosticError('POSTGRES_SQL_ERROR', {
          sqlState: '42703',
          stderr: 'ERROR: 42703: undefined column',
        })
      },
      reconcile: async () => false,
    })
    const { envelope } = await expectBlocked(harness)
    expect(envelope).toMatchObject({
      stage: 'apply',
      applyStarted: true,
      applyCommitted: false,
      recoveryOutcome: 'not_required',
    })
    expect(harness.events).not.toContain('rollback')
    expect(harness.ledgerStates).toEqual(['apply_started', 'blocked_no_contract'])
  })

  it('fails manual on ambiguous timeout with a complete or partial contract', async () => {
    for (const contractState of [true, null]) {
      const harness = makeHarness({
        apply: async () => {
          throw new DiagnosticError('PROCESS_TIMEOUT', { timedOut: true })
        },
        reconcile: async () => contractState,
      })
      const { envelope } = await expectBlocked(harness)
      expect(envelope.failureCategory).toBe('timeout')
      expect(envelope.recoveryOutcome).toBe('failed')
      expect(harness.events).not.toContain('rollback')
      expect(harness.ledgerStates).toContain('manual_verification_required')
    }
  })

  it('retains exact postcheck assertion before one recovery and never starts matrix', async () => {
    const details = validDetailedPostcheck()
    details.result = 'FAIL'
    details.checks[0] = {
      id: 'V3-FUNCTION-OWNER:public.synthetic()',
      object: 'function:public.synthetic',
      pass: false,
      expected: { owner: 'postgres' },
      actual: { owner: 'unexpected' },
    }
    const harness = makeHarness({
      postcheckDetails: async () => details,
    })
    const { envelope, publicFailure } = await expectBlocked(harness)
    expect(envelope).toMatchObject({
      stage: 'postcheck',
      failureCode: 'V3_POSTCHECK_ASSERTION_FAILED',
      assertionId: 'V3-FUNCTION-OWNER:public.synthetic()',
      objectKind: 'function',
      recoveryOutcome: 'restored',
      automaticRetryCount: 0,
    })
    expect(envelope.expectedSummary).toContain('postgres')
    expect(envelope.actualSummary).toContain('unexpected')
    expect(harness.events.indexOf('failure_verified')).toBeLessThan(
      harness.events.indexOf('recovery_eligible'),
    )
    expect(harness.events).not.toContain('matrix')
    expect(publicFailure).toEqual(publicFailureSummaryV3(envelope))
    expect(Object.keys(publicFailure).sort()).toEqual([
      'actualSummary',
      'assertionId',
      'expectedSummary',
      'failureCategory',
      'failureCode',
      'objectKind',
      'recoveryOutcome',
      'stage',
    ].sort())
  })

  it.each([
    ['postcheck SQL', {
      postcheckState: async () => {
        throw new DiagnosticError('POSTGRES_SQL_ERROR', { sqlState: 'P0001' })
      },
    }, 'postcheck'],
    ['postcheck malformed JSON', {
      postcheckDetails: async () => parseEnvelopeV3('CP3B2A_V3_JSON:{bad}', 'postcheck'),
    }, 'postcheck'],
    ['postcheck empty stdout', {
      postcheckDetails: async () => parseEnvelopeV3('', 'postcheck'),
    }, 'postcheck'],
    ['matrix SQL', {
      matrix: async () => {
        throw new DiagnosticError('POSTGRES_SQL_ERROR', { sqlState: 'P0001' })
      },
    }, 'matrix'],
    ['matrix envelope fail', {
      matrix: async () => ({ result: 'FAIL', transaction: 'ROLLED_BACK' }),
    }, 'matrix'],
    ['residue', { residue: async () => 1 }, 'residue'],
    ['final postcheck', {
      finalPostcheckDetails: async () => parseEnvelopeV3('', 'postcheck'),
    }, 'final_postcheck'],
  ])('preserves %s and performs exactly one recovery', async (_name, overrides, stage) => {
    const harness = makeHarness(overrides)
    const { envelope } = await expectBlocked(harness)
    expect(envelope.stage).toBe(stage)
    expect(envelope.recoveryOutcome).toBe('restored')
    expect(harness.events.filter((event) => event === 'rollback')).toHaveLength(1)
    expect(harness.events.filter((event) => event === 'apply')).toHaveLength(1)
    expect(envelope.automaticRetryCount).toBe(0)
  })

  it('preserves primary and separate recovery failure', async () => {
    const harness = makeHarness({
      postcheckState: async () => {
        throw new DiagnosticError('POSTGRES_SQL_ERROR', { sqlState: 'P0001' })
      },
      rollback: async () => {
        throw new DiagnosticError('POSTGRES_SQL_ERROR', {
          sqlState: '42501',
          stderr: 'recovery denied',
        })
      },
    })
    const { envelope } = await expectBlocked(harness)
    expect(envelope.primaryFailure).toMatchObject({
      stage: 'postcheck',
      sqlState: 'P0001',
    })
    expect(envelope.recoveryFailure).toMatchObject({
      stage: 'recovery',
      sqlState: '42501',
    })
    expect(envelope.recoveryOutcome).toBe('failed')
    expect(envelope.failureCode).toBe(envelope.primaryFailure.failureCode)
  })

  it('completes once with zero recovery and zero retry', async () => {
    const harness = makeHarness()
    await expect(executeV3TestHarness({}, harness.operations, RUN_ID)).resolves.toMatchObject({
      verdict: 'PASS',
      applyAttempts: 1,
      recoveryAttempts: 0,
      automaticRetries: 0,
    })
    expect(harness.ledgerStates).toEqual(['apply_started', 'apply_committed', 'completed'])
    expect(harness.handles).toHaveLength(0)
  })

  it('keeps the primary failure immutable across every recovery update', () => {
    const envelope = buildFailureEnvelopeV3({
      error: new DiagnosticError('V3_POSTCHECK_ASSERTION_FAILED', {
        assertion: 'V3-POLICY-COUNT',
        expected: { policies: ['exact'] },
        actual: { policies: ['unexpected'] },
      }),
      stage: 'postcheck',
      runId: RUN_ID,
      stages: ['apply_committed'],
      runtime: {
        applyStarted: true,
        applyCommitted: true,
        postcheckStarted: true,
        matrixStarted: false,
      },
    })
    const updated = applyFailureEnvelopeUpdateV3(envelope, {
      recoveryStarted: true,
      recoveryOutcome: 'restored',
    })
    expect(updated.primaryFailure).toEqual(envelope.primaryFailure)
    expect(updated.primaryFailureSha256).toBe(envelope.primaryFailureSha256)
    expect(() => applyFailureEnvelopeUpdateV3(envelope, {
      primaryFailure: { failureCode: envelope.failureCode },
    })).toThrow('V3_FAILURE_ENVELOPE_UPDATE_REJECTED')
    expect(() => applyFailureEnvelopeUpdateV3(envelope, {
      automaticRetryCount: 1,
    })).toThrow('V3_FAILURE_ENVELOPE_UPDATE_REJECTED')
    const tampered = structuredClone(envelope)
    tampered.actualSummary = 'tampered'
    expect(() => applyFailureEnvelopeUpdateV3(tampered, {
      recoveryOutcome: 'failed',
    })).toThrow('V3_PRIMARY_FAILURE_TAMPERED')
  })

  it('retains private expected/actual detail and redacts known secrets and PII', () => {
    const secret = 'sentinel-private-value'
    const envelope = buildFailureEnvelopeV3({
      error: new DiagnosticError('V3_POSTCHECK_ASSERTION_FAILED', {
        assertion: 'V3-POLICY-COUNT',
        expected: { exact: { role: 'authenticated', secret } },
        actual: {
          exact: {
            role: 'authenticated',
            jwt: 'eyJabcdefghijk.abcdefghijkl.abcdefghijkl',
            phone: '+34 612 345 678',
            taxId: '12345678Z',
            companyTaxId: 'B12345678',
          },
        },
      }),
      stage: 'postcheck',
      runId: RUN_ID,
      stages: ['apply_committed'],
      runtime: {
        applyStarted: true,
        applyCommitted: true,
        postcheckStarted: true,
        matrixStarted: false,
      },
      sensitiveValues: [secret],
    })
    expect(envelope.privateEvidence.expected).toContain('"role":"authenticated"')
    expect(envelope.privateEvidence.expected).toContain('[REDACTED_SECRET]')
    expect(envelope.privateEvidence.actual).toContain('[REDACTED_JWT]')
    expect(envelope.privateEvidence.actual).toContain('[REDACTED_PHONE]')
    expect(envelope.privateEvidence.actual).toContain('[REDACTED_TAX_ID]')
    expect(envelope.privateEvidence.actual).not.toContain('B12345678')
    expect(JSON.stringify(envelope)).not.toContain(secret)
  })

  it('keeps success provisional and invalidates it if ledger completion fails', async () => {
    const harness = makeHarness({
      updateLedger: (_path, state) => {
        harness.events.push(`ledger:${state}`)
        harness.ledgerStates.push(state)
        if (state === 'completed') {
          throw new DiagnosticError('V3_ATTEMPT_LEDGER_TRANSITION_REJECTED')
        }
      },
    })
    const { envelope } = await expectBlocked(harness)
    expect(envelope.recoveryOutcome).toBe('restored')
    expect(harness.ledgerStates).toEqual([
      'apply_started',
      'apply_committed',
      'completed',
      'blocked_recovered',
    ])
    expect(harness.events.indexOf('success_candidate')).toBeLessThan(
      harness.events.indexOf('ledger:completed'),
    )
    expect(harness.events.indexOf('success_invalidated')).toBeLessThan(
      harness.events.indexOf('rollback'),
    )
    expect(harness.events).not.toContain('success_finalized')
  })

  it('does not recover a completed ledger when local report finalization fails', async () => {
    const harness = makeHarness({
      finalizeSuccessReport: () => {
        throw new DiagnosticError('V3_SUCCESS_REPORT_FINALIZE_FAILED')
      },
    })
    await expect(executeV3TestHarness({}, harness.operations, RUN_ID))
      .rejects.toThrow('V3_SUCCESS_REPORT_FINALIZE_FAILED')
    expect(harness.ledgerStates).toEqual([
      'apply_started',
      'apply_committed',
      'completed',
    ])
    expect(harness.events).not.toContain('rollback')
    expect(harness.events).not.toContain('success_invalidated')
  })

  it('rejects ledger identity tampering and any V3 run-id collision', () => {
    const context = {
      gitState: { head: 'a'.repeat(40) },
      runId: RUN_ID,
    }
    const expectedHashes = {
      packageManifestSha256: 'b'.repeat(64),
      backupManifestSha256: 'c'.repeat(64),
    }
    const ledger = {
      version: 3,
      gitHead: context.gitState.head,
      runId: context.runId,
      authorizationId: AUTHORIZATION_ID,
      projectRef: QA_REF,
      packageManifestSha256: expectedHashes.packageManifestSha256,
      migrationSha256:
        '4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544',
      backupManifestSha256: expectedHashes.backupManifestSha256,
      createdAt: '2026-07-29T10:00:00.000Z',
    }
    expect(assertLedgerIdentityV3(ledger, context, expectedHashes)).toBe(true)
    for (const tampered of [
      { ...ledger, gitHead: 'd'.repeat(40) },
      { ...ledger, runId: 'CP3B2A-V3-FFFFFFFFFFFF' },
      { ...ledger, backupManifestSha256: 'e'.repeat(64) },
    ]) {
      expect(() => assertLedgerIdentityV3(
        tampered,
        context,
        expectedHashes,
      )).toThrow('V3_ATTEMPT_LEDGER_TAMPERED')
    }
    expect(assertNoSyntheticCollisionsV3(0)).toBe(true)
    expect(() => assertNoSyntheticCollisionsV3(1))
      .toThrow('V3_SYNTHETIC_COLLISION')
  })

  it('demonstrates V2 detail loss while V3 retains the same injected failure', async () => {
    const injected = new DiagnosticError('V3_POSTCHECK_ASSERTION_FAILED', {
      assertion: 'V3-POLICY-COUNT',
      object: 'policy:customer-read',
      expected: '0 broad policies',
      actual: '1 broad policy',
    })
    const v2FrozenSource = readFileSync(
      'scripts/client-portal/run-cp3b2a-qa-v2.mjs',
      'utf8',
    )
    expect(v2FrozenSource).toContain('} catch {')
    expect(v2FrozenSource).toContain("fail('qa_application_failed_recovery_completed')")
    expect(v2FrozenSource).not.toContain('primaryFailure')
    const v2Closure = {
      code: 'qa_application_failed_recovery_completed',
      assertionId: null,
      expected: null,
      actual: null,
    }
    const v3Envelope = buildFailureEnvelopeV3({
      error: injected,
      stage: 'postcheck',
      runId: RUN_ID,
      stages: ['apply_committed', 'postcheck_started'],
      runtime: {
        applyStarted: true,
        applyCommitted: true,
        postcheckStarted: true,
        matrixStarted: false,
      },
    })
    expect(v2Closure.assertionId).toBeNull()
    expect(v3Envelope).toMatchObject({
      assertionId: 'V3-POLICY-COUNT',
      expectedSummary: '0 broad policies',
      actualSummary: '1 broad policy',
    })
  })

  it('keeps secrets out of argv/public summaries and rejects production literals', () => {
    const environment = {
      CP2B_QA_DATABASE_URL: 'sentinel-database-secret',
      SUPABASE_ACCESS_TOKEN: 'sentinel-token-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'sentinel-service-secret',
      PORTAL_INVITATION_PEPPER: 'sentinel-pepper',
    }
    expect(assertNoSecretsV3(environment, ['--preflight'], 'safe')).toBe(true)
    expect(() => assertNoSecretsV3(
      environment,
      ['--preflight', 'sentinel-token-secret'],
      'safe',
    )).toThrow('V3_SECRET_EXPOSURE_REJECTED')
    for (const source of [
      readFileSync('scripts/client-portal/run-cp3b2a-qa-v3.mjs', 'utf8'),
      readFileSync('scripts/client-portal/cp3b2a_qa_matrix_v3.sql', 'utf8'),
    ]) {
      expect(source).toContain(QA_REF)
      expect(source).toContain(PRODUCTION_REF)
    }
  })

  it('builds a minimal PostgreSQL child environment and rejects production/spoofs', () => {
    const environment = {
      PATH: 'synthetic-path',
      SystemRoot: 'synthetic-system-root',
      CP2B_QA_DATABASE_URL:
        `postgresql://postgres:private@db.${QA_REF}.supabase.co:5432/postgres?sslmode=require`,
      SUPABASE_ACCESS_TOKEN: 'sentinel-token',
      SUPABASE_ANON_KEY: 'sentinel-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'sentinel-service',
      PORTAL_INVITATION_PEPPER: 'sentinel-invitation',
      PORTAL_RATE_LIMIT_PEPPER: 'sentinel-rate',
      CP3B2A_PRIVATE_BACKUP_MANIFEST: 'sentinel-backup',
      CP3B2A_EXECUTION_AUTHORIZED: 'true',
    }
    const { childEnvironment } = parseDatabaseTarget(environment)
    expect(childEnvironment).toMatchObject({
      PATH: 'synthetic-path',
      SystemRoot: 'synthetic-system-root',
      PGHOST: `db.${QA_REF}.supabase.co`,
      PGDATABASE: 'postgres',
      PGUSER: 'postgres',
      PGPASSWORD: 'private',
      PGSSLMODE: 'require',
    })
    for (const forbidden of [
      'CP2B_QA_DATABASE_URL',
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PORTAL_INVITATION_PEPPER',
      'PORTAL_RATE_LIMIT_PEPPER',
      'CP3B2A_PRIVATE_BACKUP_MANIFEST',
      'CP3B2A_EXECUTION_AUTHORIZED',
    ]) expect(childEnvironment).not.toHaveProperty(forbidden)
    expect(() => parseDatabaseTarget({
      CP2B_QA_DATABASE_URL:
        `postgresql://postgres:private@db.${PRODUCTION_REF}.supabase.co:5432/postgres?sslmode=require`,
    })).toThrow('QA_DATABASE_TARGET_REJECTED')
    expect(() => parseDatabaseTarget({
      CP2B_QA_DATABASE_URL:
        `postgresql://postgres:private@spoof-${QA_REF}.invalid:5432/postgres?sslmode=require`,
    })).toThrow('QA_DATABASE_TARGET_REJECTED')
  })

  it('keeps read-only preflight structurally separate from ledger/apply/matrix/recovery', () => {
    const source = readFileSync(
      'scripts/client-portal/run-cp3b2a-qa-v3.mjs',
      'utf8',
    )
    const preflightSource = source
      .split('export function preflightV3')[1]
      .split('async function main')[0]
    expect(preflightSource).toContain('createPrivateBackupV3')
    for (const forbidden of [
      'createAttemptLedger',
      'migrationPath',
      'matrixPath',
      'rollbackPath',
      'executeV3(',
    ]) expect(preflightSource).not.toContain(forbidden)
  })

  it('keeps the postcheck semantic and matrix history/privacy controls exact', () => {
    const postcheck = readFileSync(
      'scripts/client-portal/cp3b2a_qa_postcheck_v3.sql',
      'utf8',
    )
    for (const evidence of [
      'V3-FUNCTION-SIGNATURE',
      'V3-FUNCTION-OWNER',
      'V3-FUNCTION-SEARCH-PATH',
      'V3-FUNCTION-GRANTS',
      'V3-CONSTRAINT-DEFINITION',
      'V3-INDEX-DEFINITION',
      'indimmediate',
      'indnkeyatts',
      'aclexplode',
      'relforcerowsecurity',
    ]) expect(postcheck).toContain(evidence)
    const matrix = readFileSync(
      'scripts/client-portal/cp3b2a_qa_matrix_v3.sql',
      'utf8',
    )
    for (const evidence of [
      'profile_rows+2',
      'property_rows+1',
      'historical_profile_rows_unchanged',
      'audit_metadata_has_no_values_or_pii',
      'financial_sequences_unchanged',
    ]) expect(matrix).toContain(evidence)
  })
})
