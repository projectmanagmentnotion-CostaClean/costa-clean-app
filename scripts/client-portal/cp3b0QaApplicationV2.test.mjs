import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { preparePostgresEnvironmentV5 } from './cp2b_postgres_transport_v5.mjs'
import {
  AUTHORIZATION_ID,
  MIGRATION_SHA256,
  PRE_EFFECT_ORDER,
  PRODUCTION_REF,
  QA_REF,
  assertArtifactHashV2,
  assertAuthorizationAndHeadV2,
  assertCleanWorktreeV2,
  assertNoSecretsInArgumentsV2,
  validatePrestateV2,
  verifyFrozenChainV2,
  verifyPackageManifestV2,
  verifyPrivateBackupV2,
} from './run-cp3b0-qa-v2.mjs'

const migrationPath =
  'supabase/migrations/20260728120000_portal_self_access_context.sql'
const runnerPath = 'scripts/client-portal/run-cp3b0-qa-v2.mjs'
const manifestPath = 'scripts/client-portal/cp3b0_qa_package_v2.manifest.json'
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
    CP3B0_EXECUTION_AUTHORIZED: 'true',
    CP3B0_PROJECT_REF: QA_REF,
    CP3B0_V2_AUTHORIZATION_ID: AUTHORIZATION_ID,
    CP3B0_V2_AUTHORIZED_HEAD: 'a'.repeat(40),
  }
}

function validPrestate() {
  return {
    liveRead: 1,
    cp2bPrerequisite: true,
    selfContextCount: 0,
    portalTables: 11,
    portalRowCount: 1,
    tableGrantDigest: 'grant-digest',
    policyDigest: 'policy-digest',
    otherPortalFunctionCount: 18,
    otherPortalFunctionDigest: 'function-digest',
    migrationHistoryCount: 3,
    migrationHistoryDigest: 'history-digest',
    syntheticCollisions: 0,
  }
}

describe('CP-3B.0A QA application V2 package', () => {
  it('preserves the complete V1 and CP-2B immutable chains', () => {
    const frozen = verifyFrozenChainV2()
    expect(frozen.v1.artifacts).toHaveLength(9)
    expect(frozen.cp2b.version).toBe(5)
    expect(sha256(migrationPath)).toBe(MIGRATION_SHA256)
  })

  it('freezes every new V2 artifact without a self-hash', () => {
    const { manifest } = verifyPackageManifestV2()
    expect(manifest.status).toBe('PREPARED_NOT_AUTHORIZED')
    expect(manifest.authorizationId).toBe(AUTHORIZATION_ID)
    expect(manifest.artifacts.some((artifact) => artifact.path === manifestPath)).toBe(false)
    for (const artifact of manifest.artifacts) {
      expect(sha256(artifact.path), artifact.path).toBe(artifact.sha256)
    }
  })

  it('blocks execute without the exact new authorization', () => {
    expect(() => assertAuthorizationAndHeadV2({}, validGitState()))
      .toThrow('execution_not_authorized')
    const result = spawnSync(process.execPath, [runnerPath, '--execute'], {
      encoding: 'utf8',
      env: { ...process.env, CP3B0_PROJECT_REF: QA_REF },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('BLOCKED: BLOCKED_BEFORE_REMOTE_EFFECTS')
  })

  it('rejects production before any execution effect', () => {
    expect(() => assertAuthorizationAndHeadV2({
      ...validEnvironment(),
      CP3B0_PROJECT_REF: PRODUCTION_REF,
    }, validGitState())).toThrow('production_target_rejected')
  })

  it('rejects an incorrect authorized HEAD or divergent main', () => {
    expect(() => assertAuthorizationAndHeadV2({
      ...validEnvironment(),
      CP3B0_V2_AUTHORIZED_HEAD: 'b'.repeat(40),
    }, validGitState())).toThrow('git_authorization_mismatch')
    expect(() => assertAuthorizationAndHeadV2(
      validEnvironment(),
      { ...validGitState(), divergence: [1, 0] },
    )).toThrow('git_authorization_mismatch')
  })

  it('rejects a dirty worktree independently of authorization', () => {
    expect(() => assertCleanWorktreeV2({ ...validGitState(), clean: false }))
      .toThrow('dirty_worktree_rejected')
  })

  it('fails closed on artifact hash drift and invalid private backup', () => {
    expect(() => assertArtifactHashV2(migrationPath, '0'.repeat(64)))
      .toThrow('artifact_hash_mismatch')
    expect(() => verifyPrivateBackupV2('C:\\outside\\backup.json', 'a'.repeat(40)))
      .toThrow('private_path_rejected')
  })

  it('rejects a pre-existing function, collision or offline PostgreSQL state', () => {
    expect(() => validatePrestateV2({ ...validPrestate(), selfContextCount: 1 }))
      .toThrow('postgres_prestate_rejected')
    expect(() => validatePrestateV2({ ...validPrestate(), syntheticCollisions: 1 }))
      .toThrow('postgres_prestate_rejected')
    expect(() => validatePrestateV2({ ...validPrestate(), liveRead: 0 }))
      .toThrow('postgres_prestate_rejected')
  })

  it('locks the exact pre-effect order with apply last', () => {
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
      'cp2b_prerequisite',
      'function_absent',
      'catalog_prestate',
      'grants_and_policy_digest',
      'synthetic_collision_check',
      'postgres_pre_effect_check',
      'apply',
    ])
  })

  it('defines the complete postcheck contract and unchanged-state digests', () => {
    const sql = readFileSync(
      'scripts/client-portal/cp3b0_qa_postcheck_v2.sql',
      'utf8',
    )
    for (const contract of [
      "'signatureCount'",
      "'parameterCount'",
      "'returnType'",
      "'stable'",
      "'securityDefiner'",
      "'owner'",
      "'fixedSearchPath'",
      "'publicExecute'",
      "'anonExecute'",
      "'authenticatedExecute'",
      "'serviceRoleExecute'",
      "'commentPresent'",
      "'portalRowCount'",
      "'tableGrantDigest'",
      "'policyDigest'",
      "'migrationHistoryDigest'",
    ]) expect(sql).toContain(contract)
  })

  it('uses a QA-specific transactional matrix with rollback and no Auth Admin API', () => {
    const sql = readFileSync(
      'scripts/client-portal/cp3b0_qa_matrix_v2.sql',
      'utf8',
    )
    expect(sql).toContain('begin;')
    expect(sql).toContain('rollback;')
    expect(sql).toContain('example.invalid')
    expect(sql).toContain('insert into auth.users')
    expect(sql).toContain('set local session_replication_role = replica')
    expect(sql).not.toMatch(/auth\/v1\/admin|service_role/iu)
    for (const state of [
      'authenticated_without_access',
      'pending_review',
      'active_member',
      'client_selection_required',
      'suspended',
      'revoked',
    ]) expect(sql).toContain(state)
  })

  it('freezes an exact one-function atomic rollback', () => {
    const sql = readFileSync(
      'scripts/client-portal/cp3b0_qa_rollback_v2.sql',
      'utf8',
    )
    expect(sql).toMatch(/begin;[\s\S]*drop function if exists public[.]portal_resolve_self_access_context[(][)][\s\S]*commit;/u)
    expect(sql).not.toMatch(/\b(drop|alter|delete|truncate)\s+(table|policy)|schema_migrations/iu)
  })

  it('keeps secrets out of arguments and the database URL out of child env', () => {
    const protocol = ['postgresql', '//'].join(':')
    const secret = `${protocol}${['postgres', 'synthetic-password'].join(':')}@db.${QA_REF}.supabase.co/postgres`
    expect(() => assertNoSecretsInArgumentsV2(
      { CP2B_QA_DATABASE_URL: secret },
      ['--execute', secret],
    )).toThrow('secret_argument_rejected')
    const prepared = preparePostgresEnvironmentV5({
      PATH: process.env.PATH,
      CP2B_QA_DATABASE_URL: secret,
    })
    expect(prepared.environment.CP2B_QA_DATABASE_URL).toBeUndefined()
    expect(Object.values(prepared.environment)).not.toContain(secret)
  })

  it('supports only direct plan, preflight and execute modes with no npm alias', () => {
    const source = readFileSync(runnerPath, 'utf8')
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(source).toContain("['--plan', '--preflight', '--execute']")
    expect(Object.keys(packageJson.scripts).some((name) => name.includes('cp3b0') && name.includes('v2')))
      .toBe(false)
  })

  it('contains one apply path, one recovery attempt and no automatic retry loop', () => {
    const source = readFileSync(runnerPath, 'utf8')
    expect(source).toContain('applyAttempts: 1')
    expect(source).toContain('recoveryAttempts += 1')
    expect(source).not.toMatch(/\bwhile\s*\(|for\s*\([^)]*apply/iu)
    expect(source).toContain('qa_application_failed_recovery_completed')
  })
})
