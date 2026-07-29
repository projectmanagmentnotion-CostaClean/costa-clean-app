import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_ID,
  MIGRATION_SHA256,
  PRE_EFFECT_ORDER,
  PRODUCTION_REF,
  QA_REF,
  assertArtifactHashV2,
  assertAuthorizationAndHeadV2,
  assertCleanWorktreeV2,
  assertExactQaDatabaseV2,
  assertNoSecretsInArgumentsV2,
  validatePoststateV2,
  validatePrestateV2,
  verifyFrozenChainV2,
  verifyPackageManifestV2,
  verifyPrivateBackupV2,
} from './run-cp3b2a-qa-v2.mjs'

const migrationPath =
  'supabase/migrations/20260728160000_portal_reviewed_change_contract.sql'
const runnerPath = 'scripts/client-portal/run-cp3b2a-qa-v2.mjs'
const manifestPath = 'scripts/client-portal/cp3b2a_qa_package_v2.manifest.json'
const sha256 = (filePath) => createHash('sha256')
  .update(readFileSync(filePath))
  .digest('hex')

function validGitState() {
  return {
    head: 'a'.repeat(40),
    remoteHead: 'a'.repeat(40),
    branch: 'main',
    clean: true,
    divergence: [0, 0],
  }
}

function validEnvironment() {
  return {
    CP3B2A_EXECUTION_AUTHORIZED: 'true',
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V2_AUTHORIZATION_ID: AUTHORIZATION_ID,
    CP3B2A_V2_AUTHORIZED_HEAD: 'a'.repeat(40),
  }
}

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
    profileRows: 2,
    propertyRows: 3,
    profileDigest: 'profile',
    propertyDigest: 'property',
    canonicalDigest: 'canonical',
    financialSequenceDigest: 'sequences',
    authUserCount: 4,
    authDigest: 'auth',
    tableGrantDigest: 'table-grants',
    unaffectedPolicyDigest: 'policies',
    unaffectedFunctionDigest: 'functions',
    migrationHistoryCount: 5,
    migrationHistoryDigest: 'history',
  }
}

describe('CP-3B.2A.1 QA application V2 package', () => {
  it('preserves the immutable CP-3B.2A, CP-3B.0 and CP-2B chains', () => {
    const frozen = verifyFrozenChainV2()
    expect(frozen.v1.artifacts).toHaveLength(10)
    expect(frozen.cp3b0.version).toBe(1)
    expect(frozen.cp2b.version).toBe(5)
    expect(sha256(migrationPath)).toBe(MIGRATION_SHA256)
  })

  it('freezes every new V2 artifact without a self-hash', () => {
    const { manifest } = verifyPackageManifestV2()
    expect(manifest.gate).toBe('CP-3B.2A.1')
    expect(manifest.status).toBe('PREPARED_NOT_AUTHORIZED')
    expect(manifest.artifacts.some((artifact) => artifact.path === manifestPath)).toBe(false)
    for (const artifact of manifest.artifacts) {
      expect(sha256(artifact.path), artifact.path).toBe(artifact.sha256)
    }
  })

  it('blocks execute without the exact future authorization', () => {
    expect(() => assertAuthorizationAndHeadV2({}, validGitState()))
      .toThrow('execution_not_authorized')
    const result = spawnSync(process.execPath, [runnerPath, '--execute'], {
      encoding: 'utf8',
      env: { ...process.env, CP3B2A_PROJECT_REF: QA_REF },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('BLOCKED: BLOCKED_BEFORE_REMOTE_EFFECTS')
  })

  it('rejects production, wrong HEAD, divergence and a dirty worktree', () => {
    expect(() => assertAuthorizationAndHeadV2({
      ...validEnvironment(),
      CP3B2A_PROJECT_REF: PRODUCTION_REF,
    }, validGitState())).toThrow('production_target_rejected')
    expect(() => assertAuthorizationAndHeadV2({
      ...validEnvironment(),
      CP3B2A_V2_AUTHORIZED_HEAD: 'b'.repeat(40),
    }, validGitState())).toThrow('git_authorization_mismatch')
    expect(() => assertAuthorizationAndHeadV2(
      validEnvironment(),
      { ...validGitState(), divergence: [0, 1] },
    )).toThrow('git_authorization_mismatch')
    expect(() => assertCleanWorktreeV2({ ...validGitState(), clean: false }))
      .toThrow('dirty_worktree_rejected')
  })

  it('pins direct and pooler PostgreSQL identities exactly to QA', () => {
    const direct = [
      'postgresql://postgres:synthetic@db.',
      QA_REF,
      '.supabase.co:5432/postgres?sslmode=require',
    ].join('')
    expect(assertExactQaDatabaseV2({ CP2B_QA_DATABASE_URL: direct }).target)
      .toBe('QA_MATCH')
    const pooler = [
      'postgresql://postgres.',
      QA_REF,
      ':synthetic@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require',
    ].join('')
    expect(assertExactQaDatabaseV2({ CP2B_QA_DATABASE_URL: pooler }).target)
      .toBe('QA_MATCH')
    expect(() => assertExactQaDatabaseV2({
      CP2B_QA_DATABASE_URL: `postgresql://postgres:synthetic@spoof-${QA_REF}.invalid/postgres?sslmode=require`,
    })).toThrow('database_target_rejected')
    expect(() => assertExactQaDatabaseV2({
      CP2B_QA_DATABASE_URL: `postgresql://postgres:synthetic@db.${PRODUCTION_REF}.supabase.co/postgres?sslmode=require`,
    })).toThrow('production_target_rejected')
  })

  it('rejects drift, collisions and an incomplete prestate', () => {
    expect(() => validatePrestateV2({
      ...validPrestate(), targetFunctionCount: 1,
    })).toThrow('postgres_prestate_rejected')
    expect(() => validatePrestateV2({
      ...validPrestate(), syntheticCollisions: 1,
    })).toThrow('postgres_prestate_rejected')
    expect(() => validatePrestateV2({
      ...validPrestate(), cp3b0Prerequisite: false,
    })).toThrow('postgres_prestate_rejected')
  })

  it('validates the complete post-apply catalog and unchanged state', () => {
    expect(validatePoststateV2(validPrestate(), {
      ...validPrestate(),
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
    })).toBe(true)
  })

  it('locks every pre-effect stage and keeps apply last', () => {
    expect(PRE_EFFECT_ORDER).toEqual([
      'manifest_and_hashes',
      'authorization_and_head',
      'clean_worktree',
      'private_backup',
      'local_qa_link',
      'supabase_cli_qa_link',
      'production_not_linked',
      'postgres_live_read',
      'postgres_qa_target',
      'cp2b_cp3b0_prerequisites',
      'reviewed_contract_absent',
      'catalog_prestate',
      'grants_policy_history_digest',
      'synthetic_collision_check',
      'backup_matches_prestate',
      'apply',
    ])
  })

  it('defines exhaustive precheck and postcheck evidence', () => {
    const precheck = readFileSync(
      'scripts/client-portal/cp3b2a_qa_precheck_v2.sql', 'utf8',
    )
    const postcheck = readFileSync(
      'scripts/client-portal/cp3b2a_qa_postcheck_v2.sql', 'utf8',
    )
    for (const field of [
      "'authDigest'", "'canonicalDigest'", "'financialSequenceDigest'",
      "'unaffectedPolicyDigest'", "'unaffectedFunctionDigest'",
      "'migrationHistoryDigest'", "'syntheticCollisions'",
    ]) expect(precheck).toContain(field)
    for (const field of [
      "'functionContractPass'", "'columnCount'", "'constraintDefinitionPass'",
      "'indexCount'", "'newColumnsNullForHistoricalRows'",
      "'internalStaffPolicyCount'", "'legacyServiceGrantCount'",
    ]) expect(postcheck).toContain(field)
  })

  it('uses a QA-only transactional matrix with synthetic users and rollback', () => {
    const sql = readFileSync(
      'scripts/client-portal/cp3b2a_qa_matrix_v2.sql', 'utf8',
    )
    expect(sql).toContain('begin;')
    expect(sql).toContain('rollback;')
    expect(sql).toContain('example.invalid')
    expect(sql).toContain('insert into auth.users')
    expect(sql).toContain('set local session_replication_role = replica')
    expect(sql).toContain('same_client_cross_user_hidden')
    expect(sql).toContain('canonical_client_unchanged')
    expect(sql).not.toMatch(/auth\/v1\/admin|SUPABASE_SERVICE_ROLE_KEY/iu)
  })

  it('uses an exact guarded rollback without migration-history edits', () => {
    const sql = readFileSync(
      'scripts/client-portal/cp3b2a_qa_rollback_v2.sql', 'utf8',
    )
    expect(sql).toContain('rollback_rejected_v2_rows_exist')
    expect(sql).toContain('drop function if exists public.portal_submit_profile_change_request_v2')
    expect(sql).toContain('Portal reads same-client profile requests')
    expect(sql).toContain('legacyServiceGrantsRestored')
    expect(sql).not.toMatch(/delete\s+from\s+supabase_migrations|truncate/iu)
  })

  it('keeps secrets out of arguments and rejects an external backup path', () => {
    const secret = `postgresql://postgres:secret@db.${QA_REF}.supabase.co/postgres?sslmode=require`
    expect(() => assertNoSecretsInArgumentsV2(
      { CP2B_QA_DATABASE_URL: secret }, ['--preflight', secret],
    )).toThrow('secret_argument_rejected')
    expect(() => verifyPrivateBackupV2('C:\\outside\\backup.json', 'a'.repeat(40)))
      .toThrow('private_path_rejected')
    expect(() => assertArtifactHashV2(migrationPath, '0'.repeat(64)))
      .toThrow('artifact_hash_mismatch')
  })

  it('supports only plan, preflight and execute and has no npm execute alias', () => {
    const source = readFileSync(runnerPath, 'utf8')
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(source).toContain("['--plan', '--preflight', '--execute']")
    expect(Object.keys(packageJson.scripts).some(
      (name) => name.includes('cp3b2a') && name.includes('v2'),
    )).toBe(false)
  })

  it('contains one application path, one recovery attempt and no auto retry', () => {
    const source = readFileSync(runnerPath, 'utf8')
    expect(source).toContain('applyAttempts: 1')
    expect(source).toContain('recoveryAttempts += 1')
    expect(source).not.toMatch(/\bwhile\s*\(|for\s*\([^)]*apply/iu)
    expect(source).toContain('qa_application_failed_recovery_completed')
  })
})
