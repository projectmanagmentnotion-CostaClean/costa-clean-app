import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyLedger,
  createRunId,
  LEDGER_STATES,
  PRODUCTION_REF,
  QA_REF,
  readLedger,
  transitionLedger,
  validateLedger,
  validateQaTarget,
} from './cp2b_qa_auth_fixtures_v2.mjs'
import {
  assertExecutionGate,
  privateInputStatus,
  verifyManifest,
} from './run-cp2b-qa-v2.mjs'

const temporaryPaths = []
const read = (file) => readFileSync(file, 'utf8')
const uuidLiteral = /['"][0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}['"]/giu
const manifest = JSON.parse(read('scripts/client-portal/cp2b_qa_package_v2.manifest.json'))

afterEach(() => {
  for (const target of temporaryPaths.splice(0)) {
    rmSync(target, { recursive: true, force: true })
  }
})

describe('CP-2A.1 QA-compatible package', () => {
  it('rejects production and unknown targets while accepting only exact QA', () => {
    expect(() => validateQaTarget({
      projectRef: QA_REF,
      supabaseUrl: `https://${QA_REF}.supabase.co`,
    })).not.toThrow()
    expect(() => validateQaTarget({
      projectRef: PRODUCTION_REF,
      supabaseUrl: `https://${PRODUCTION_REF}.supabase.co`,
    })).toThrow('production_target_rejected')
    expect(() => validateQaTarget({
      projectRef: 'unknown',
      supabaseUrl: 'https://unknown.supabase.co',
    })).toThrow('qa_target_required')
  })

  it('uses mandatory dynamic Auth UUID parameters and no fixed Auth UUIDs', () => {
    const matrix = read('scripts/client-portal/cp2b_qa_authorization_matrix_v2.sql')
    const fixtures = read('scripts/client-portal/cp2b_qa_fixtures_v2.sql')
    for (const variable of [
      'active_staff_user_id',
      'suspended_staff_user_id',
      'admin_a_user_id',
      'member_a_user_id',
      'admin_b_user_id',
      'member_b_user_id',
      'pending_user_id',
      'suspended_member_user_id',
      'revoked_member_user_id',
      'unverified_user_id',
      'invitee_user_id',
    ]) {
      expect(fixtures).toContain(`\\if :{?${variable}}`)
      expect(`${matrix}\n${fixtures}`).toContain(variable)
    }
    expect(matrix.match(uuidLiteral) ?? []).toEqual([])
  })

  it('validates private ledger shape, UUIDs, lifecycle and forbidden material', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cp2a1-ledger-test-'))
    temporaryPaths.push(root)
    const ledgerPath = path.join(root, 'ledger.json')
    const runId = createRunId()
    createEmptyLedger(ledgerPath, runId)
    expect(() => createEmptyLedger(ledgerPath, runId)).toThrow('ledger_already_exists')
    transitionLedger(ledgerPath, 'backup_complete', {
      authUserIds: { client_member_a: randomUUID() },
      rowIds: { client_a_id: randomUUID() },
      storageObjectKeys: [`${randomUUID()}/${randomUUID()}.pdf`],
    })
    expect(readLedger(ledgerPath)).toMatchObject({
      version: 2,
      runId,
      state: 'backup_complete',
    })
    expect(LEDGER_STATES).toEqual(expect.arrayContaining([
      'initialized',
      'rollback_required',
      'blocked',
      'completed',
    ]))
    expect(() => validateLedger({
      ...readLedger(ledgerPath),
      password: 'forbidden',
    })).toThrow('ledger_contains_forbidden_material')
  })

  it('cleanup is exact-ID only and contains no broad destructive predicate', () => {
    const cleanup = read('scripts/client-portal/cp2b_qa_cleanup_v2.sql')
    expect(cleanup).not.toMatch(/\btruncate\b/iu)
    expect(cleanup).not.toMatch(/\bemail\s+like\b/iu)
    expect(cleanup).not.toMatch(/\bdelete\s+from\s+\S+\s*;/iu)
    expect(cleanup).not.toMatch(/\bdelete\s+from\s+\S+\s+where\s+true\b/iu)
    expect(cleanup).toContain('exact_cleanup_pass')
    expect(cleanup).toContain('active_staff_user_id')
  })

  it('contains no db push, db pull, migration repair or migration-history write', () => {
    const sources = [
      'scripts/client-portal/cp2b_qa_auth_fixtures_v2.mjs',
      'scripts/client-portal/cp2b_qa_fixtures_v2.sql',
      'scripts/client-portal/cp2b_qa_authorization_matrix_v2.sql',
      'scripts/client-portal/cp2b_qa_cleanup_v2.sql',
      'scripts/client-portal/run-cp2b-qa-v2.mjs',
      'scripts/client-portal/run-cp2a1-local-proof.mjs',
    ].map(read).join('\n').toLowerCase()
    expect(sources).not.toContain('db push')
    expect(sources).not.toContain('db pull')
    expect(sources).not.toContain('migration repair')
    expect(sources).not.toContain('supabase_migrations.schema_migrations')
  })

  it('verifies hashes and rejects a tampered manifest', () => {
    expect(verifyManifest(manifest)).toBe(true)
    const tampered = structuredClone(manifest)
    tampered.artifacts[0].sha256 = '0'.repeat(64)
    expect(() => verifyManifest(tampered)).toThrow('v2_manifest_hash_mismatch')
  })

  it('blocks execute unless every authorization gate is satisfied', () => {
    expect(() => assertExecutionGate({
      environment: {},
      manifest,
      gitHead: 'head',
      clean: true,
    })).toThrow('execution_not_authorized')
    expect(() => assertExecutionGate({
      environment: {
        CP2B_EXECUTION_AUTHORIZED: 'true',
        CP2B_PROJECT_REF: PRODUCTION_REF,
      },
      manifest,
      gitHead: 'head',
      clean: true,
    })).toThrow()
  })

  it('reports private inputs only as status and redacts supplied values', () => {
    const secretValue = 'do-not-print-this-value'
    const statuses = privateInputStatus({
      CP2B_QA_DATABASE_URL: secretValue,
      SUPABASE_SERVICE_ROLE_KEY: secretValue,
    })
    expect(statuses.CP2B_QA_DATABASE_URL).toBe('PRESENT')
    expect(statuses.SUPABASE_SERVICE_ROLE_KEY).toBe('PRESENT')
    expect(JSON.stringify(statuses)).not.toContain(secretValue)

    const result = spawnSync(
      process.execPath,
      ['scripts/client-portal/run-cp2b-qa-v2.mjs', '--preflight'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          CP2B_QA_DATABASE_URL: secretValue,
          SUPABASE_SERVICE_ROLE_KEY: secretValue,
        },
      },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain(secretValue)
    expect(result.stderr).not.toContain(secretValue)
  })

  it('direct Auth fixture execution remains plan-only', () => {
    const plan = spawnSync(
      process.execPath,
      ['scripts/client-portal/cp2b_qa_auth_fixtures_v2.mjs', '--plan'],
      { encoding: 'utf8' },
    )
    expect(plan.status).toBe(0)
    expect(plan.stdout).toContain('"remoteWrites": 0')
    const blocked = spawnSync(
      process.execPath,
      ['scripts/client-portal/cp2b_qa_auth_fixtures_v2.mjs', '--execute'],
      { encoding: 'utf8' },
    )
    expect(blocked.status).not.toBe(0)
    expect(blocked.stderr).toContain('direct remote mutation is unavailable')
  })
})
