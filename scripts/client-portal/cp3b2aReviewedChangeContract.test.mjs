import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const MIGRATION = 'supabase/migrations/20260728160000_portal_reviewed_change_contract.sql'
const CP2B = 'supabase/migrations/20260723160000_client_portal_security_boundary.sql'
const CP3B0 = 'supabase/migrations/20260728120000_portal_self_access_context.sql'
const QA_RUNNER = 'scripts/client-portal/run-cp3b2a-qa.mjs'
const MATRIX = 'scripts/client-portal/cp3b2a_reviewed_change_matrix.sql'
const MANIFEST = 'scripts/client-portal/cp3b2a_reviewed_change.manifest.json'
const sha256 = (filePath) => createHash('sha256')
  .update(readFileSync(filePath))
  .digest('hex')

describe('CP-3B.2A reviewed change contract', () => {
  it('adds one forward-only migration without altering frozen migrations', () => {
    const names = readdirSync('supabase/migrations')
    expect(names.filter((name) => name.startsWith('20260728160000_'))).toEqual([
      '20260728160000_portal_reviewed_change_contract.sql',
    ])
    expect(sha256(CP2B)).toBe(
      'ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277',
    )
    expect(sha256(CP3B0)).toBe(
      'c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731',
    )
  })

  it('uses nullable no-default compatibility columns and partial uniqueness', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    expect(source.match(/add column idempotency_key uuid/gu)).toHaveLength(2)
    expect(source.match(/add column public_reference text/gu)).toHaveLength(2)
    expect(source).not.toMatch(/idempotency_key uuid\s+(not null|default)/iu)
    expect(source).not.toMatch(/public_reference text\s+(not null|default)/iu)
    expect(source.match(/where idempotency_key is not null/gu).length).toBeGreaterThanOrEqual(4)
    expect(source.match(/where public_reference is not null/gu).length).toBeGreaterThanOrEqual(2)
    expect(source).not.toMatch(/\bupdate\s+public\.(client_portal_profile|client_portal_property)/iu)
    expect(source.match(/00000000-0000-0000-0000-000000000000/gu)).toHaveLength(2)
  })

  it('defines four narrow auth.uid-only public contracts', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    for (const signature of [
      'portal_submit_profile_change_request_v2',
      'portal_submit_property_change_request_v2',
      'portal_list_own_profile_change_requests_v2',
      'portal_list_own_property_change_requests_v2',
    ]) {
      expect(source).toContain(`public.${signature}`)
    }
    expect(source).toContain('v_user_id uuid := auth.uid()')
    expect(source).not.toMatch(/auth\.jwt|user_metadata|raw_user_meta_data|\bp_user_id\b/iu)
    expect(source).not.toMatch(/\bexecute\s+(format|\()/iu)
    expect(source.match(/security definer/giu).length).toBeGreaterThanOrEqual(7)
    expect(source.match(/set search_path = pg_catalog/giu).length).toBeGreaterThanOrEqual(7)
  })

  it('freezes the strict field allowlists and deterministic normalization', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    for (const field of [
      'fullName', 'phone', 'email', 'taxId', 'billingAddress',
      'name', 'propertyType', 'address', 'city', 'postalCode',
    ]) {
      expect(source).toContain(`'${field}'`)
    }
    for (const forbidden of ['deletedAt', 'archivedAt', 'clientId', 'userId']) {
      expect(source).not.toContain(`'${forbidden}'`)
    }
    expect(source).toContain("v_value ~ '[[:cntrl:]]'")
    expect(source).toContain("v_value ~ '[<>]'")
    expect(source).toContain('lower(v_value)')
    expect(source).toContain('upper(v_value)')
  })

  it('uses atomic idempotency and persisted authoritative receipts', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    expect(source.match(/on conflict \(requested_by, idempotency_key\)/gu)).toHaveLength(2)
    expect(source.match(/returning \* into v_created/gu)).toHaveLength(2)
    expect(source).toContain("'reference', p_reference")
    expect(source).toContain("'status', p_status")
    expect(source).toContain("'requestedAt', p_requested_at")
    expect(source).toContain("'changedFields'")
    expect(source).toContain("'requestType'")
    expect(source).not.toMatch(/return jsonb_build_object\(\s*'ok'/iu)
  })

  it('denies archived/deleted/non-owned property targets neutrally', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    const propertySubmit = source.slice(
      source.indexOf('public.portal_submit_property_change_request_v2'),
      source.indexOf('public.portal_list_own_profile_change_requests_v2'),
    )
    expect(propertySubmit).toContain('client_id = p_client_id')
    expect(propertySubmit).toContain("status = 'active'")
    expect(propertySubmit).toContain('deleted_at is null')
    expect(propertySubmit).toContain('archived_at is null')
    expect(propertySubmit).toContain('for share')
    expect(propertySubmit).toContain("'resource_not_found'")
  })

  it('removes broad customer table visibility and retires legacy Edge writes', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    expect(source).toContain('drop policy "Portal reads same-client profile requests"')
    expect(source).toContain('drop policy "Portal reads same-client property requests"')
    expect(source).toMatch(
      /portal_submit_profile_change_trusted[\s\S]*from service_role/iu,
    )
    expect(source).toMatch(
      /portal_submit_property_change_trusted[\s\S]*from service_role/iu,
    )
    expect(source).not.toMatch(/\bgrant\s+(select|insert|update|delete)\s+on table/iu)
  })

  it('grants new public execution only to authenticated', () => {
    const source = readFileSync(MIGRATION, 'utf8')
    expect(source.match(/from public, anon, authenticated, service_role/gu).length)
      .toBeGreaterThanOrEqual(7)
    expect(source.match(/to authenticated;/gu).length).toBeGreaterThanOrEqual(4)
    expect(source).not.toMatch(/grant execute[\s\S]{0,180}\bto (anon|service_role|public)\b/iu)
  })

  it('ships a broad local security/retry matrix', () => {
    const source = readFileSync(MATRIX, 'utf8')
    for (const evidence of [
      'same_client_cross_user_hidden',
      'cross_client_accepted',
      'suspended_accepted',
      'revoked_accepted',
      'unverified_user_accepted',
      'ineligible_property_accepted',
      'profile_retry_same_receipt',
      'profile_retry_no_audit',
      'property_target_conflict_accepted',
      'list_hides_review_and_payload',
    ]) {
      expect(source).toContain(evidence)
    }
    expect(source.trimEnd()).toContain('rollback;')
  })

  it('has a plan/read-only-only QA runner and no npm execute alias', () => {
    const source = readFileSync(QA_RUNNER, 'utf8')
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(source).not.toContain('--execute')
    expect(source).toContain('begin transaction read only')
    expect(source).toContain('rollback;')
    expect(source).toContain('exact_qa_database_target_required')
    expect(source).toContain("parsed.searchParams.set('sslmode', 'require')")
    expect(Object.keys(packageJson.scripts).filter((name) => name.includes('cp3b2a'))).toEqual([])
  })

  it('rejects spoofed and production database targets before transport', () => {
    const spoofed = spawnSync(process.execPath, [QA_RUNNER, '--preflight'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CP2B_QA_DATABASE_URL:
          'postgresql://postgres.kpvvydthlxupjjqqdpxy:masked@evil.invalid:6543/postgres',
      },
    })
    expect(spoofed.status).toBe(1)
    expect(spoofed.stderr).toContain('exact_qa_database_target_required')

    const production = spawnSync(process.execPath, [QA_RUNNER, '--preflight'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CP2B_QA_DATABASE_URL:
          'postgresql://postgres.wfxnwfcdjainpojhbdri:masked@aws.pooler.supabase.com:6543/postgres',
      },
    })
    expect(production.status).toBe(1)
    expect(production.stderr).toContain('production_target_rejected')
  })

  it('produces a sanitized source-only plan', () => {
    const result = spawnSync(process.execPath, [QA_RUNNER, '--plan'], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'PREPARED_NOT_AUTHORIZED',
      executeAlias: false,
      remoteWrites: 0,
      authorizationRequired: true,
    })
  })

  it('freezes all declared artifacts and effects in the manifest', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    expect(manifest.status).toBe('PREPARED_NOT_AUTHORIZED')
    expect(manifest.executeAlias).toBe(false)
    expect(manifest.migrationSha256).toBe(sha256(MIGRATION))
    expect(manifest.expectedRemoteEffectsIfLaterAuthorized).toMatchObject({
      authUsersChanged: 0,
      canonicalClientRowsChanged: 0,
      canonicalPropertyRowsChanged: 0,
      edgeFunctionsChanged: 0,
      storageObjectsChanged: 0,
    })
    for (const artifact of manifest.artifacts) {
      expect(sha256(artifact.path), artifact.path).toBe(artifact.sha256)
    }
  })
})
