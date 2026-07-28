import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPsqlV5 } from './cp2b_postgres_transport_v5.mjs'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp3b0_self_access_context.manifest.json',
)
const cp2bManifestPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_package_v5.manifest.json',
)

function fail(message) {
  throw new Error(message)
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function readAndVerifyManifest() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (
    manifest.status !== 'PREPARED_NOT_AUTHORIZED'
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
  ) {
    fail('manifest_identity_rejected')
  }

  for (const artifact of manifest.artifacts) {
    const filePath = path.join(repoRoot, artifact.path)
    if (sha256(filePath) !== artifact.sha256) {
      fail(`manifest_hash_mismatch:${artifact.path}`)
    }
  }

  if (sha256(cp2bManifestPath) !== manifest.cp2bV5ManifestSha256) {
    fail('cp2b_v5_manifest_hash_mismatch')
  }

  const cp2bManifest = JSON.parse(readFileSync(cp2bManifestPath, 'utf8'))
  const cp2bArtifacts = [
    ...cp2bManifest.artifacts,
    ...cp2bManifest.reusedV4Artifacts,
    ...cp2bManifest.reusedV3Artifacts,
    ...cp2bManifest.reusedV2Artifacts,
    ...cp2bManifest.reusedOriginalArtifacts,
  ]
  for (const artifact of cp2bArtifacts) {
    const filePath = path.join(repoRoot, artifact.path)
    if (sha256(filePath) !== artifact.sha256) {
      fail(`cp2b_frozen_hash_mismatch:${artifact.path}`)
    }
  }

  return manifest
}

function plan() {
  const manifest = readAndVerifyManifest()
  return {
    gate: 'CP-3B.0 QA APPLICATION',
    status: 'PREPARED_NOT_AUTHORIZED',
    qaProjectRef: manifest.qaProjectRef,
    prohibitedProductionRef: manifest.prohibitedProductionRef,
    migration: manifest.migration,
    migrationSha256: manifest.migrationSha256,
    allowedCommands: [
      'npm run qa:client-portal:cp3b0-plan',
      'npm run qa:client-portal:cp3b0-preflight',
    ],
    executeAlias: false,
    remoteWrites: 0,
    authorizationRequired: true,
  }
}

function preflight() {
  const manifest = readAndVerifyManifest()
  const databaseUrl = process.env.CP2B_QA_DATABASE_URL

  if (!databaseUrl) fail('private_qa_database_url_required')
  if (databaseUrl.includes(PRODUCTION_REF)) fail('production_target_rejected')
  if (!databaseUrl.includes(QA_REF)) fail('qa_target_required')

  const sql = [
    'begin transaction read only;',
    'select jsonb_build_object(',
    "'cp2bAccountContextPresent', to_regprocedure('public.portal_get_account_context(text)') is not null,",
    "'selfContextPresent', to_regprocedure('public.portal_resolve_self_access_context()') is not null,",
    "'portalTables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace",
    "where n.nspname = 'public' and c.relkind = 'r' and c.relname = any (array[",
    "'internal_staff_memberships','client_portal_invitations','client_portal_memberships',",
    "'client_portal_applications','client_portal_profile_change_requests',",
    "'client_portal_property_change_requests','client_service_requests',",
    "'client_portal_audit_events','client_portal_rate_limits',",
    "'invoice_document_records','client_portal_legal_acceptances'])),",
    "'cp2bAuthenticatedExecute', has_function_privilege(",
    "'authenticated','public.portal_get_account_context(text)','EXECUTE'),",
    "'cp2bAnonExecute', has_function_privilege(",
    "'anon','public.portal_get_account_context(text)','EXECUTE'));",
    'rollback;',
  ].join(' ')

  const result = runPsqlV5(
    ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { environment: process.env, cwd: repoRoot },
  )
  const catalog = JSON.parse(result.stdout.trim())

  if (
    catalog.cp2bAccountContextPresent !== true
    || catalog.selfContextPresent !== false
    || catalog.portalTables !== 11
    || catalog.cp2bAuthenticatedExecute !== true
    || catalog.cp2bAnonExecute !== false
  ) {
    fail('qa_prestate_rejected')
  }

  return {
    gate: 'CP-3B.0 QA READ-ONLY PREFLIGHT',
    status: 'PASS',
    databaseTarget: 'QA_MATCH',
    cp2bPrerequisite: 'PASS',
    newRpcPrestate: 'ABSENT',
    manifestArtifacts: manifest.artifacts.length,
    transactionMode: 'READ_ONLY_ROLLBACK',
    remoteWrites: 0,
    productionWrites: 0,
    authorizationStatus: 'AWAITING_EXPLICIT_AUTHORIZATION',
  }
}

function main() {
  const mode = process.argv[2]

  if (mode === '--plan') {
    console.log(JSON.stringify(plan(), null, 2))
    return
  }

  if (mode === '--preflight') {
    console.log(JSON.stringify(preflight(), null, 2))
    return
  }

  fail('only_plan_or_read_only_preflight_supported')
}

try {
  main()
} catch (error) {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
