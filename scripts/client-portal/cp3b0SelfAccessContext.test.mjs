import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const CP2B_MIGRATION = 'supabase/migrations/20260723160000_client_portal_security_boundary.sql'
const CP3B0_MIGRATION = 'supabase/migrations/20260728120000_portal_self_access_context.sql'
const MANIFEST = 'scripts/client-portal/cp3b0_self_access_context.manifest.json'
const sha256 = (filePath) => createHash('sha256')
  .update(readFileSync(filePath))
  .digest('hex')

describe('CP-3B.0 self access context contract', () => {
  it('reproduces the original self-discovery block from frozen source', () => {
    const source = readFileSync(CP2B_MIGRATION, 'utf8')
    const start = source.indexOf('create or replace function public.portal_get_account_context')
    const end = source.indexOf(
      'create or replace function public.portal_get_client_profile',
      start,
    )
    const originalFunction = source.slice(start, end)

    expect(originalFunction).toContain('portal_get_account_context(p_client_id text)')
    expect(originalFunction).toContain("m.status = 'active'")
    expect(originalFunction).not.toContain("m.status = 'suspended'")
    expect(originalFunction).not.toContain("m.status = 'revoked'")
    expect(source).not.toContain('portal_get_account_context()')
    expect(source).not.toContain('portal_resolve_self_access_context')
  })

  it('proves the CP-3A frontend cannot safely infer the missing context', () => {
    const portalSources = [
      'src/portal/contracts.ts',
      'src/portal/adapters/portalFoundationAdapter.ts',
    ].map((filePath) => readFileSync(filePath, 'utf8')).join('\n')

    expect(portalSources).not.toMatch(/\.from\s*\(/u)
    expect(portalSources).not.toMatch(/user_metadata|email.*client|client.*email/iu)
    expect(portalSources).toContain('clientContextId')
  })

  it('adds exactly one unique forward-only migration version', () => {
    const names = readdirSync('supabase/migrations')
    expect(names.filter((name) => name.startsWith('20260728120000_'))).toEqual([
      '20260728120000_portal_self_access_context.sql',
    ])
    expect(readFileSync(CP2B_MIGRATION, 'utf8')).not.toContain(
      'portal_resolve_self_access_context',
    )
  })

  it('defines the exact zero-parameter stable security-definer contract', () => {
    const source = readFileSync(CP3B0_MIGRATION, 'utf8')

    expect(source).toContain('public.portal_resolve_self_access_context()')
    expect(source).toMatch(/returns jsonb[\s\S]*stable[\s\S]*security definer/iu)
    expect(source).toContain('set search_path = pg_catalog')
    expect(source).toContain('v_user_id uuid := auth.uid()')
    expect(source).not.toMatch(/auth\.jwt|user_metadata|raw_user_meta_data/iu)
    expect(source).not.toMatch(/\bp_user_id\b|\bp_client_id\b/iu)
    expect(source).not.toMatch(/\bexecute\s+format\s*\(/iu)
  })

  it('returns only the approved states and minimal shape', () => {
    const source = readFileSync(CP3B0_MIGRATION, 'utf8')
    const states = [
      'active_member',
      'client_selection_required',
      'pending_review',
      'suspended',
      'revoked',
      'authenticated_without_access',
    ]

    for (const state of states) expect(source).toContain(`'${state}'`)
    for (const key of [
      'state',
      'selectedClientId',
      'memberships',
      'applicationStatus',
      'clientId',
      'membershipId',
      'role',
      'status',
    ]) {
      expect(source).toContain(`'${key}'`)
    }
    expect(source).not.toMatch(/client_portal_invitations|full_name|phone|tax_id|billing_address/iu)
  })

  it('keeps active precedence, deterministic ordering and inactive minimization', () => {
    const source = readFileSync(CP3B0_MIGRATION, 'utf8')

    expect(source.indexOf('if v_active_count = 1')).toBeLessThan(
      source.indexOf("m.status = 'suspended'"),
    )
    expect(source).toContain('order by m.client_id')
    expect(source).toMatch(/v_state := 'suspended'[\s\S]*v_state := 'revoked'/u)
    expect(source).toContain("v_memberships := '[]'::jsonb")
    expect(source).toContain('v_selected_client_id := null')
  })

  it('revokes broadly and grants execute only to authenticated', () => {
    const source = readFileSync(CP3B0_MIGRATION, 'utf8')

    expect(source).toContain(
      'from public, anon, authenticated, service_role',
    )
    expect(source).toContain(
      'grant execute on function public.portal_resolve_self_access_context()',
    )
    expect(source).toMatch(/grant execute[\s\S]*to authenticated/iu)
    expect(source).toContain(
      'alter function public.portal_resolve_self_access_context() owner to postgres',
    )
    expect(source).toContain('comment on function')
  })

  it('ships no execute alias and keeps QA commands plan/read-only', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    const qaRunner = readFileSync('scripts/client-portal/run-cp3b0-qa.mjs', 'utf8')
    const cp3b0Scripts = Object.entries(packageJson.scripts)
      .filter(([name]) => name.includes('cp3b0'))

    expect(cp3b0Scripts.map(([name]) => name).sort()).toEqual([
      'qa:client-portal:cp3b0-plan',
      'qa:client-portal:cp3b0-preflight',
      'qa:client-portal:cp3b0-proof',
    ])
    expect(qaRunner).not.toContain('--execute')
    expect(qaRunner).toContain('begin transaction read only')
    expect(qaRunner).toContain('rollback;')
  })

  it('produces a sanitized source-only QA plan', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/client-portal/run-cp3b0-qa.mjs', '--plan'],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'PREPARED_NOT_AUTHORIZED',
      executeAlias: false,
      remoteWrites: 0,
      authorizationRequired: true,
    })
  })

  it('freezes every declared artifact at its exact SHA-256', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

    expect(manifest.status).toBe('PREPARED_NOT_AUTHORIZED')
    expect(manifest.migrationSha256).toBe(sha256(CP3B0_MIGRATION))
    for (const artifact of manifest.artifacts) {
      expect(sha256(artifact.path), artifact.path).toBe(artifact.sha256)
    }
  })

  it('preserves the complete frozen CP-2B V5 chain', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    const frozen = JSON.parse(
      readFileSync('scripts/client-portal/cp2b_qa_package_v5.manifest.json', 'utf8'),
    )
    const frozenArtifacts = [
      ...frozen.artifacts,
      ...frozen.reusedV4Artifacts,
      ...frozen.reusedV3Artifacts,
      ...frozen.reusedV2Artifacts,
      ...frozen.reusedOriginalArtifacts,
    ]

    expect(manifest.cp2bV5ManifestSha256).toBe(
      sha256('scripts/client-portal/cp2b_qa_package_v5.manifest.json'),
    )
    for (const artifact of frozenArtifacts) {
      expect(sha256(artifact.path), artifact.path).toBe(artifact.sha256)
    }
  })
})
