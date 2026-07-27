import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assertExecutionGateV4,
  planV4,
  preflightV4,
  verifyManifestV4,
} from './run-cp2b-qa-v4.mjs'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const MIGRATION_SHA256 = 'ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277'

function read(filePath) {
  return readFileSync(filePath, 'utf8')
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function runner(args, environment = {}) {
  return spawnSync(process.execPath, ['scripts/client-portal/run-cp2b-qa-v4.mjs', ...args], {
    cwd: process.cwd(),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  })
}

describe('CP-2A.3 bootstrap contract V4', () => {
  it('proves the frozen mismatch and the later suspended fixture responsibility', () => {
    const original = read('scripts/client-portal/cp2b_apply.sql')
    const migration = read('supabase/migrations/20260723160000_client_portal_security_boundary.sql')
    const fixtures = read('scripts/client-portal/cp2b_qa_fixtures_v2.sql')

    expect(original).toMatch(/staff_role text not null/iu)
    expect(original).toMatch(/suspended_staff_user_id/iu)
    expect(migration).toMatch(/select b\.user_id, b\.role, 'active'/iu)
    expect(fixtures).toMatch(/suspended_staff_user_id[\s\S]*'operator'[\s\S]*'suspended'/iu)
  })

  it('defines exactly the migration bootstrap contract and only the real active staff', () => {
    const apply = read('scripts/client-portal/cp2b_apply_v4.sql')
    const table = apply.match(
      /create temp table cp2a_bootstrap_staff\s*\(([\s\S]*?)\)\s*on commit preserve rows/iu,
    )
    expect(table?.[1].replace(/\s+/gu, ' ').trim()).toBe(
      'user_id uuid PRIMARY KEY, role text NOT NULL',
    )
    expect(apply).toMatch(
      /insert into cp2a_bootstrap_staff\s*\(user_id, role\)\s*values\s*\(:'active_staff_user_id'::uuid, 'admin'\)/iu,
    )
    expect(apply).not.toMatch(/suspended_staff_user_id/iu)
    expect(table?.[1]).not.toMatch(/\bstatus\b/iu)
  })

  it('checks target, UUID and Auth existence before including the frozen migration', () => {
    const apply = read('scripts/client-portal/cp2b_apply_v4.sql')
    const includeAt = apply.indexOf('\\ir ../../supabase/migrations/')
    expect(includeAt).toBeGreaterThan(0)
    for (const contract of [
      ":'project_ref' = 'wfxnwfcdjainpojhbdri'",
      ":'project_ref' <> 'kpvvydthlxupjjqqdpxy'",
      ":'active_staff_user_id'::uuid",
      'from auth.users',
    ]) {
      expect(apply.toLowerCase().indexOf(contract.toLowerCase())).toBeGreaterThanOrEqual(0)
      expect(apply.toLowerCase().indexOf(contract.toLowerCase())).toBeLessThan(includeAt)
    }
  })

  it('keeps V4 explicit, uses the V3 launcher, and points only to the V4 apply', () => {
    const source = read('scripts/client-portal/run-cp2b-qa-v4.mjs')
    expect(source).toContain("cp2b_apply_v4.sql")
    expect(source).toContain("from './cp2b_command_launcher_v3.mjs'")
    expect(source).toContain('runSupabaseCliV3')
    expect(source).not.toMatch(/const applyPath = .*cp2b_apply\.sql/iu)
    expect(source).not.toMatch(/spawnSync/u)
  })

  it('verifies every V4, V3, V2 and original hash plus the frozen migration', () => {
    const manifest = JSON.parse(read('scripts/client-portal/cp2b_qa_package_v4.manifest.json'))
    expect(verifyManifestV4(manifest)).toBe(true)
    expect(manifest.artifacts.length).toBeGreaterThanOrEqual(4)
    expect(manifest.reusedV3Artifacts).toHaveLength(5)
    expect(manifest.reusedV2Artifacts).toHaveLength(8)
    expect(manifest.reusedOriginalArtifacts).toHaveLength(16)
    expect(manifest.migrationSha256).toBe(MIGRATION_SHA256)
    expect(sha256('supabase/migrations/20260723160000_client_portal_security_boundary.sql'))
      .toBe(MIGRATION_SHA256)
  })

  it('rejects tampering, production and execution without V4 authorization', () => {
    const manifest = JSON.parse(read('scripts/client-portal/cp2b_qa_package_v4.manifest.json'))
    const tampered = structuredClone(manifest)
    tampered.artifacts[0].sha256 = '0'.repeat(64)
    expect(() => verifyManifestV4(tampered)).toThrow('v4_manifest_hash_mismatch')
    expect(() => assertExecutionGateV4({
      environment: { CP2B_PROJECT_REF: PRODUCTION_REF },
      manifest,
      gitHead: 'head',
      clean: true,
    })).toThrow('execution_not_authorized')
    expect(() => assertExecutionGateV4({
      environment: { CP2B_EXECUTION_AUTHORIZED: 'true', CP2B_PROJECT_REF: PRODUCTION_REF },
      manifest,
      gitHead: 'head',
      clean: true,
    })).toThrow('production_target_rejected')
  })

  it('rejects an invalid private backup after all prior V4 gates pass', () => {
    const manifest = JSON.parse(read('scripts/client-portal/cp2b_qa_package_v4.manifest.json'))
    expect(() => assertExecutionGateV4({
      environment: {
        CP2B_EXECUTION_AUTHORIZED: 'true',
        CP2B_PROJECT_REF: QA_REF,
        CP2B_V4_AUTHORIZATION_ID: 'CP2B-V4-AUTHORIZATION-PENDING',
        CP2B_V4_AUTHORIZED_HEAD: 'authorized-head',
        CP2B_QA_DATABASE_URL: ['postgresql:', '//private@', QA_REF, '.example.invalid/postgres']
          .join(''),
        CP2B_ACTIVE_STAFF_USER_ID: '00000000-0000-4000-8000-000000000001',
        SUPABASE_ACCESS_TOKEN: 'private-proof-token',
        SUPABASE_URL: `https://${QA_REF}.supabase.co`,
        SUPABASE_ANON_KEY: 'private-proof-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'private-proof-service-role',
        PORTAL_INVITATION_PEPPER: 'private-proof-invitation-pepper',
        PORTAL_RATE_LIMIT_PEPPER: 'private-proof-rate-limit-pepper',
        PORTAL_ALLOWED_ORIGIN: 'https://app.costacleanbcn.com',
        CP2B_PRIVATE_BACKUP_MANIFEST: 'missing-private-proof-manifest',
      },
      manifest,
      gitHead: 'authorized-head',
      clean: true,
    })).toThrow('private_backup_missing')
  })

  it('offers only non-mutating plan/preflight and blocks an unauthorized execute', () => {
    expect(planV4()).toMatchObject({
      gate: 'CP-2B-V4',
      status: 'NOT_AUTHORIZED',
      remoteWrites: 0,
    })
    expect(preflightV4({ CP2B_PROJECT_REF: QA_REF })).toMatchObject({
      gate: 'CP-2B-V4',
      remoteWrites: 0,
      projectRef: 'QA_MATCH',
      production: 'PRODUCTION_REJECTED',
      manifest: 'PASS',
    })
    const execution = runner(['--execute'], {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
    })
    expect(execution.status).not.toBe(0)
    expect(execution.stderr).toContain('BLOCKED: execution_not_authorized')
  })

  it('does not expose secrets through the V4 source or command arguments', () => {
    const source = read('scripts/client-portal/run-cp2b-qa-v4.mjs')
    expect(source).not.toMatch(/console\.(log|error)\([^)]*(TOKEN|KEY|PEPPER|DATABASE_URL)/iu)
    expect(source).toContain('redactFailure: true')
    expect(source).toContain('CP2B_PRIVATE_BACKUP_MANIFEST')
    expect(source).toContain('CP2B_V4_AUTHORIZED_HEAD')
  })
})
