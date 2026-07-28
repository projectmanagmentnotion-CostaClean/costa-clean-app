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
  'cp3b2a_reviewed_change.manifest.json',
)
const frozenManifests = [
  'scripts/client-portal/cp2b_qa_package_v5.manifest.json',
  'scripts/client-portal/cp3b0_self_access_context.manifest.json',
]

function fail(message) {
  throw new Error(message)
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function verifyFrozenManifest(relativePath) {
  const manifestPathToCheck = path.join(repoRoot, relativePath)
  const manifest = JSON.parse(readFileSync(manifestPathToCheck, 'utf8'))
  const artifacts = [
    ...(manifest.artifacts ?? []),
    ...(manifest.reusedV4Artifacts ?? []),
    ...(manifest.reusedV3Artifacts ?? []),
    ...(manifest.reusedV2Artifacts ?? []),
    ...(manifest.reusedOriginalArtifacts ?? []),
  ]

  for (const artifact of artifacts) {
    const artifactPath = path.join(repoRoot, artifact.path)
    if (sha256(artifactPath) !== artifact.sha256) {
      fail(`frozen_hash_mismatch:${artifact.path}`)
    }
  }

  return sha256(manifestPathToCheck)
}

function readAndVerifyManifest() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    manifest.status !== 'PREPARED_NOT_AUTHORIZED'
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.executeAlias !== false
  ) {
    fail('manifest_identity_rejected')
  }

  for (const artifact of manifest.artifacts) {
    if (sha256(path.join(repoRoot, artifact.path)) !== artifact.sha256) {
      fail(`manifest_hash_mismatch:${artifact.path}`)
    }
  }

  const frozenHashes = Object.fromEntries(
    frozenManifests.map((relativePath) => [relativePath, verifyFrozenManifest(relativePath)]),
  )
  if (
    frozenHashes[frozenManifests[0]] !== manifest.frozen.cp2bV5ManifestSha256
    || frozenHashes[frozenManifests[1]] !== manifest.frozen.cp3b0ManifestSha256
  ) {
    fail('frozen_manifest_hash_mismatch')
  }

  return manifest
}

function exactQaEnvironment(databaseUrl) {
  if (!databaseUrl) fail('private_qa_database_url_required')
  if (databaseUrl.includes(PRODUCTION_REF)) fail('production_target_rejected')

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    fail('qa_database_url_invalid')
  }

  const username = decodeURIComponent(parsed.username)
  const direct = (
    parsed.hostname === `db.${QA_REF}.supabase.co`
    && username === 'postgres'
    && (parsed.port === '' || parsed.port === '5432')
  )
  const pooler = (
    /^[a-z0-9-]+\.pooler\.supabase\.com$/u.test(parsed.hostname)
    && username === `postgres.${QA_REF}`
    && ['5432', '6543'].includes(parsed.port)
  )
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.pathname !== '/postgres'
    || (!direct && !pooler)
  ) {
    fail('exact_qa_database_target_required')
  }

  parsed.searchParams.set('sslmode', 'require')
  return {
    ...process.env,
    CP2B_QA_DATABASE_URL: parsed.toString(),
  }
}

function plan() {
  const manifest = readAndVerifyManifest()
  return {
    gate: 'CP-3B.2A',
    status: 'PREPARED_NOT_AUTHORIZED',
    qaProjectRef: manifest.qaProjectRef,
    prohibitedProductionRef: manifest.prohibitedProductionRef,
    migration: manifest.migration,
    migrationSha256: manifest.migrationSha256,
    allowedCommands: [
      'node scripts/client-portal/run-cp3b2a-qa.mjs --plan',
      'node scripts/client-portal/run-cp3b2a-qa.mjs --preflight',
    ],
    executeAlias: false,
    remoteWrites: 0,
    authorizationRequired: true,
  }
}

function preflight() {
  const manifest = readAndVerifyManifest()
  const databaseUrl = process.env.CP2B_QA_DATABASE_URL
  const qaEnvironment = exactQaEnvironment(databaseUrl)

  const proposedFunctions = manifest.functions.map((name) => `'${name}'`).join(',')
  const sql = [
    'begin transaction read only;',
    'select jsonb_build_object(',
    "'cp2bContextPresent', to_regprocedure('public.portal_get_account_context(text)') is not null,",
    "'cp3b0ContextPresent', to_regprocedure('public.portal_resolve_self_access_context()') is not null,",
    "'requestTablesPresent', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace",
    "where n.nspname='public' and c.relkind='r' and c.relname in",
    "('client_portal_profile_change_requests','client_portal_property_change_requests')),",
    "'newColumnsPresent', (select count(*) from information_schema.columns",
    "where table_schema='public' and table_name in",
    "('client_portal_profile_change_requests','client_portal_property_change_requests')",
    "and column_name in ('idempotency_key','public_reference')),",
    "'newIndexesPresent', (select count(*) from pg_indexes where schemaname='public'",
    "and indexname like 'client_portal_%_v2_%'),",
    "'newFunctionsPresent', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace",
    `where n.nspname='public' and p.proname in (${proposedFunctions})),`,
    "'profileRows', (select count(*) from public.client_portal_profile_change_requests),",
    "'propertyRows', (select count(*) from public.client_portal_property_change_requests),",
    "'legacyProfileServiceExecute', has_function_privilege('service_role',",
    "'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)','EXECUTE'),",
    "'legacyPropertyServiceExecute', has_function_privilege('service_role',",
    "'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)','EXECUTE'),",
    "'broadCustomerPolicies', (select count(*) from pg_policies where schemaname='public'",
    "and policyname in ('Portal reads same-client profile requests','Portal reads same-client property requests')),",
    "'migrationHistoryDigest', coalesce((select md5(string_agg(version,',' order by version))",
    "from supabase_migrations.schema_migrations), 'unavailable'),",
    "'policyDigest', (select md5(coalesce(string_agg(tablename||':'||policyname||':'||coalesce(qual,''),'|'",
    "order by tablename,policyname),'')) from pg_policies where schemaname='public'),",
    "'grantDigest', (select md5(coalesce(string_agg(table_name||':'||grantee||':'||privilege_type,'|'",
    "order by table_name,grantee,privilege_type),'')) from information_schema.role_table_grants",
    "where table_schema='public'));",
    'rollback;',
  ].join(' ')

  const result = runPsqlV5(
    ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { environment: qaEnvironment, cwd: repoRoot },
  )
  const catalog = JSON.parse(result.stdout.trim())
  if (
    catalog.cp2bContextPresent !== true
    || catalog.cp3b0ContextPresent !== true
    || catalog.requestTablesPresent !== 2
    || catalog.newColumnsPresent !== 0
    || catalog.newIndexesPresent !== 0
    || catalog.newFunctionsPresent !== 0
    || catalog.legacyProfileServiceExecute !== true
    || catalog.legacyPropertyServiceExecute !== true
    || catalog.broadCustomerPolicies !== 2
  ) {
    fail('qa_prestate_rejected')
  }

  return {
    gate: 'CP-3B.2A QA READ-ONLY PREFLIGHT',
    status: 'READY_FOR_CP3B2A_QA_PACKAGE',
    databaseTarget: 'QA_MATCH',
    prerequisites: 'PASS',
    contractGap: 'REPRODUCED',
    proposedNameCollisions: 0,
    profileRequestRows: catalog.profileRows,
    propertyRequestRows: catalog.propertyRows,
    catalogDigestsCaptured: true,
    manifestArtifacts: manifest.artifacts.length,
    transactionMode: 'READ_ONLY_ROLLBACK',
    remoteWrites: 0,
    productionWrites: 0,
    authorizationStatus: 'NOT_AUTHORIZED',
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
