import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createEmptyLedger,
  createRunId,
  createSyntheticAuthUsers,
  deleteSyntheticAuthUsers,
  PRODUCTION_REF,
  QA_REF,
  readLedger,
  recordLedgerIdentifiers,
  transitionLedger,
  validateQaTarget,
} from './cp2b_qa_auth_fixtures_v2.mjs'
import { runSupabaseCliV3 } from './cp2b_command_launcher_v3.mjs'
import {
  preparePostgresEnvironmentV5,
  runPsqlV5,
} from './cp2b_postgres_transport_v5.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_package_v5.manifest.json')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260723160000_client_portal_security_boundary.sql',
)
const applyPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_apply_v4.sql')
const fixturesPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_fixtures_v2.sql')
const matrixPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_authorization_matrix_v2.sql')
const cleanupPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_cleanup_v2.sql')
const recoveryPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_failure_recovery_v2.sql',
)
const snapshotPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_catalog_snapshot.sql')
const V5_AUTHORIZATION_ID = 'CP2B-V5-AUTHORIZATION-PENDING'
const portalFunctionNames = Object.freeze([
  'portal-account-actions',
  'portal-service-actions',
  'portal-member-actions',
  'portal-invoice-download',
])
const privateInputNames = Object.freeze([
  'CP2B_QA_DATABASE_URL',
  'CP2B_ACTIVE_STAFF_USER_ID',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
  'PORTAL_ALLOWED_ORIGIN',
])

export function privateInputStatusV5(environment) {
  return Object.fromEntries(privateInputNames.map((name) => [
    name,
    environment[name]?.trim() ? 'PRESENT' : 'MISSING',
  ]))
}

export function verifyPrivateBackupV5(backupManifestPath, gitHead) {
  if (!backupManifestPath || !existsSync(backupManifestPath)) {
    throw new Error('private_backup_missing')
  }
  let backup
  try {
    backup = JSON.parse(readFileSync(backupManifestPath, 'utf8'))
  } catch {
    throw new Error('private_backup_invalid')
  }
  if (backup.version !== 1
    || backup.status !== 'COMPLETE'
    || backup.projectRef !== QA_REF
    || backup.gitHead !== gitHead
    || !Array.isArray(backup.artifacts)
    || backup.artifacts.length === 0) {
    throw new Error('private_backup_invalid')
  }
  for (const artifact of backup.artifacts) {
    if (!artifact?.path || !/^[0-9a-f]{64}$/u.test(artifact.sha256)
      || !existsSync(artifact.path) || sha256(artifact.path) !== artifact.sha256) {
      throw new Error('private_backup_invalid')
    }
  }
  return true
}

export function assertExecutionGateV5({ environment, manifest, gitHead, clean }) {
  if (environment.CP2B_EXECUTION_AUTHORIZED !== 'true') {
    throw new Error('execution_not_authorized')
  }
  if (environment.CP2B_PROJECT_REF === PRODUCTION_REF) {
    throw new Error('production_target_rejected')
  }
  if (environment.CP2B_PROJECT_REF !== QA_REF) throw new Error('qa_target_required')
  if (environment.CP2B_V5_AUTHORIZATION_ID !== manifest.authorizationId) {
    throw new Error('v5_authorization_mismatch')
  }
  if (!environment.CP2B_V5_AUTHORIZED_HEAD
    || environment.CP2B_V5_AUTHORIZED_HEAD !== gitHead
    || !clean) {
    throw new Error('git_authorization_mismatch')
  }
  if (Object.values(privateInputStatusV5(environment)).includes('MISSING')) {
    throw new Error('private_input_missing')
  }
  validateQaTarget({
    projectRef: environment.CP2B_PROJECT_REF,
    supabaseUrl: environment.SUPABASE_URL,
  })
  preparePostgresEnvironmentV5(environment)
  verifyPrivateBackupV5(environment.CP2B_PRIVATE_BACKUP_MANIFEST, gitHead)
  return true
}

export function verifyManifestV5(manifest) {
  if (manifest.version !== 5
    || manifest.status !== 'PREPARED_NOT_AUTHORIZED'
    || manifest.authorizationId !== V5_AUTHORIZATION_ID
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || !Array.isArray(manifest.artifacts)
    || !Array.isArray(manifest.reusedV4Artifacts)
    || !Array.isArray(manifest.reusedV3Artifacts)
    || !Array.isArray(manifest.reusedV2Artifacts)
    || !Array.isArray(manifest.reusedOriginalArtifacts)
    || !Array.isArray(manifest.supportedPlatforms)
    || !manifest.supportedPlatforms.includes(process.platform)) {
    throw new Error('invalid_v5_manifest')
  }
  for (const artifact of [
    ...manifest.artifacts,
    ...manifest.reusedV4Artifacts,
    ...manifest.reusedV3Artifacts,
    ...manifest.reusedV2Artifacts,
    ...manifest.reusedOriginalArtifacts,
  ]) {
    const filePath = path.join(repoRoot, artifact.path)
    if (!existsSync(filePath) || sha256(filePath) !== artifact.sha256) {
      throw new Error('v5_manifest_hash_mismatch')
    }
  }
  if (sha256(migrationPath) !== manifest.migrationSha256) {
    throw new Error('migration_hash_mismatch')
  }
  return true
}

export function planV5() {
  const manifest = readManifestIfPresent()
  return {
    gate: 'CP-2B-V5',
    mode: 'plan',
    status: 'NOT_AUTHORIZED',
    qaProjectRef: QA_REF,
    productionRejected: true,
    remoteWrites: 0,
    manifestPresent: Boolean(manifest),
    authorizationId: manifest?.authorizationId ?? V5_AUTHORIZATION_ID,
    stages: manifest?.expectedStages ?? [],
    preEffectOrder: manifest?.preEffectOrder ?? [],
    requiredPrivateInputs: privateInputNames,
  }
}

export async function preflightV5(environment, dependencies = {}) {
  const manifest = readManifestIfPresent()
  const projectRef = environment.CP2B_PROJECT_REF
  if (projectRef === PRODUCTION_REF) throw new Error('production_target_rejected')
  if (projectRef && projectRef !== QA_REF) throw new Error('qa_target_required')
  if (manifest) verifyManifestV5(manifest)
  const statuses = privateInputStatusV5(environment)
  const base = {
    gate: 'CP-2B-V5',
    mode: 'preflight',
    status: 'PREPARED_NOT_AUTHORIZED',
    remoteWrites: 0,
    projectRef: projectRef === QA_REF ? 'QA_MATCH' : 'MISSING',
    production: 'PRODUCTION_REJECTED',
    manifest: manifest ? 'PASS' : 'MISSING',
    privateInputs: statuses,
  }
  if (Object.values(statuses).includes('MISSING') || projectRef !== QA_REF) {
    return {
      ...base,
      liveQaRead: 'NOT_RUN',
      executionAuthorization: 'NOT_GRANTED',
    }
  }
  const prestate = await runPreEffectChecksV5(environment, dependencies)
  return {
    ...base,
    liveQaRead: 'PASS',
    databaseTarget: 'QA_MATCH',
    activeStaffId: 'MANUALLY_CONFIRMED',
    portalTables: prestate.portalTables,
    portalSchema: prestate.portalSchema === 0 ? 'ABSENT' : 'PRESENT',
    syntheticAuthUsers: prestate.syntheticAuthUsers,
    portalEdgeFunctions: `${prestate.portalEdgeFunctions}/${portalFunctionNames.length}`,
    portalBucket: prestate.portalBucket === 0 ? 'ABSENT' : 'PRESENT',
    syntheticStorageObjects: prestate.syntheticStorageObjects,
    executionAuthorization: 'NOT_GRANTED',
  }
}

export async function runPreEffectChecksV5(environment, dependencies = {}) {
  preparePostgresEnvironmentV5(environment)
  const cli = dependencies.cliRun ?? ((args) => cliRun(args, environment))
  assertCliIdentityV5(environment, cli)

  const functionsBody = JSON.parse(cli([
    'functions',
    'list',
    '--project-ref',
    QA_REF,
    '--output',
    'json',
  ]))
  const functions = Array.isArray(functionsBody) ? functionsBody : functionsBody.functions
  if (!Array.isArray(functions)) throw new Error('edge_catalog_invalid')
  const portalEdgeFunctions = functions.filter(
    (entry) => portalFunctionNames.includes(entry.name),
  ).length

  const psqlRunner = dependencies.runPsql ?? runPsqlV5
  const result = psqlRunner([
    '-X',
    '-Atq',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    `active_staff_user_id=${environment.CP2B_ACTIVE_STAFF_USER_ID}`,
  ], {
    environment,
    cwd: repoRoot,
    timeout: 120_000,
    input: preEffectSql(),
  })
  let databaseState
  try {
    databaseState = JSON.parse(result.stdout.trim())
  } catch {
    throw new Error('postgres_prestate_invalid')
  }
  const prestate = {
    ...databaseState,
    portalEdgeFunctions,
  }
  if (prestate.liveRead !== 1
    || prestate.activeStaff !== 1
    || prestate.portalTables !== 0
    || prestate.portalSchema !== 0
    || prestate.portalBucket !== 0
    || prestate.syntheticAuthUsers !== 0
    || prestate.syntheticStorageObjects !== 0
    || prestate.portalEdgeFunctions !== 0) {
    throw new Error('portal_prestate_rejected')
  }
  return prestate
}

function assertCliIdentityV5(environment, cli = (args) => cliRun(args, environment)) {
  const localRef = readFileSync(
    path.join(repoRoot, 'supabase', '.temp', 'project-ref'),
    'utf8',
  ).trim()
  if (localRef !== QA_REF || localRef === PRODUCTION_REF) {
    throw new Error('local_link_rejected')
  }

  const projects = JSON.parse(cli(['projects', 'list', '--output', 'json']))
  const qaLinked = projects.some((project) => project.id === QA_REF && project.linked === true)
  const productionLinked = projects.some(
    (project) => project.id === PRODUCTION_REF && project.linked === true,
  )
  if (!qaLinked || productionLinked) throw new Error('cli_target_rejected')
  return true
}

export async function runPreEffectOrderedV5({
  preEffectCheck,
  createLedger,
  createAuth,
  onStage = () => {},
}) {
  const prestate = await preEffectCheck()
  onStage('postgres_pre_effect_check')
  const ledger = await createLedger()
  onStage('ledger_create')
  const auth = await createAuth(ledger)
  onStage('auth_create')
  return { prestate, ledger, auth }
}

export async function executeV5(environment, dependencies = {}) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  verifyManifestV5(manifest)
  const gitHead = gitRun(['rev-parse', 'HEAD'])
  const clean = gitRun(['status', '--porcelain']) === ''
  assertExecutionGateV5({ environment, manifest, gitHead, clean })

  const runId = createRunId()
  const ledgerPath = path.join(repoRoot, '.git', 'cp2b-private', `${runId}.ledger.json`)
  const secretEnvPath = path.join(repoRoot, '.git', 'cp2b-private', `${runId}.edge.env`)
  const catalogSnapshotPath = path.join(
    repoRoot,
    '.git',
    'cp2b-private',
    `${runId}.catalog-before.json`,
  )
  let ledgerCreated = false
  let authRuntime
  let migrationApplied = false
  try {
    let started
    try {
      started = await runPreEffectOrderedV5({
        preEffectCheck: () => runPreEffectChecksV5(environment, dependencies),
        createLedger: () => {
          createEmptyLedger(ledgerPath, runId)
          ledgerCreated = true
          transitionLedger(ledgerPath, 'backup_complete')
          return ledgerPath
        },
        createAuth: () => createSyntheticAuthUsers({
          supabaseUrl: environment.SUPABASE_URL,
          serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
          projectRef: QA_REF,
          runId,
          ledgerPath,
        }),
        onStage: dependencies.onStage,
      })
    } catch (error) {
      if (!ledgerCreated) throw new Error('BLOCKED_BEFORE_REMOTE_EFFECTS')
      throw error
    }
    authRuntime = started.auth

    const rowIds = createRowIds()
    const objectKeys = [
      `${rowIds.document_a_id}/${randomUUID()}.pdf`,
      `${rowIds.document_b_id}/${randomUUID()}.pdf`,
    ]
    recordLedgerIdentifiers(ledgerPath, {
      rowIds,
      storageObjectKeys: objectKeys,
    })
    writeFileSync(
      catalogSnapshotPath,
      `${psqlCaptureFile(environment, snapshotPath)}\n`,
      { encoding: 'utf8', mode: 0o600 },
    )
    psqlFile(environment, applyPath, {
      project_ref: QA_REF,
      active_staff_user_id: environment.CP2B_ACTIVE_STAFF_USER_ID,
    })
    migrationApplied = true
    transitionLedger(ledgerPath, 'migration_applied')
    transitionLedger(ledgerPath, 'staff_membership_verified')

    const variables = buildSqlVariables({
      environment,
      runId,
      authIds: authRuntime.ids,
      rowIds,
      objectKeys,
    })
    psqlFile(environment, fixturesPath, variables)
    transitionLedger(ledgerPath, 'fixtures_created')

    writePrivateEdgeEnvironment(secretEnvPath, environment)
    cliRun(['secrets', 'set', '--project-ref', QA_REF, '--env-file', secretEnvPath], environment)
    for (const functionName of portalFunctionNames) {
      assertCliIdentityV5(environment)
      cliRun([
        'functions',
        'deploy',
        functionName,
        '--project-ref',
        QA_REF,
        '--no-verify-jwt',
      ], environment)
    }
    transitionLedger(ledgerPath, 'edge_deployed')

    await uploadDummyDocuments({ environment, objectKeys })
    transitionLedger(ledgerPath, 'storage_verified')
    await runHttpEdgeDenialMatrix({
      environment,
      credentials: authRuntime.credentials,
      rowIds,
    })
    psqlFile(environment, matrixPath, variables)
    transitionLedger(ledgerPath, 'matrix_passed')

    transitionLedger(ledgerPath, 'cleanup_started')
    await deleteDummyDocuments({ environment, objectKeys })
    await assertDummyDocumentsAbsent({ environment, objectKeys })
    psqlFile(environment, cleanupPath, variables)
    transitionLedger(ledgerPath, 'cleanup_complete')
    await deleteSyntheticAuthUsers({
      supabaseUrl: environment.SUPABASE_URL,
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      projectRef: QA_REF,
      ledgerPath,
    })
    transitionLedger(ledgerPath, 'zero_residue_verified')
    transitionLedger(ledgerPath, 'completed')
    return {
      status: 'PASS',
      runId: 'REDACTED',
      remoteTarget: QA_REF,
      runnerVersion: 5,
    }
  } catch (error) {
    if (ledgerCreated) {
      if (readLedger(ledgerPath).state !== 'blocked') {
        transitionLedger(
          ledgerPath,
          migrationApplied || authRuntime ? 'rollback_required' : 'blocked',
        )
      }
      await recover({
        environment,
        ledgerPath,
        authRuntime,
        migrationApplied,
      })
    }
    throw error
  } finally {
    rmSync(secretEnvPath, { force: true })
  }
}

function preEffectSql() {
  return String.raw`
BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
  'liveRead', 1,
  'activeStaff', (
    SELECT count(*)::int
    FROM auth.users
    WHERE id = :'active_staff_user_id'::uuid
  ),
  'portalTables', (
    SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND c.relname = ANY (ARRAY[
        'internal_staff_memberships',
        'client_portal_invitations',
        'client_portal_memberships',
        'client_portal_applications',
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests',
        'client_service_requests',
        'client_portal_audit_events',
        'client_portal_rate_limits',
        'invoice_document_records',
        'client_portal_legal_acceptances'
      ])
  ),
  'portalSchema', (
    SELECT count(*)::int FROM pg_namespace WHERE nspname = 'portal_private'
  ),
  'portalBucket', (
    SELECT count(*)::int FROM storage.buckets WHERE id = 'invoice-documents'
  ),
  'syntheticAuthUsers', (
    SELECT count(*)::int
    FROM auth.users
    WHERE email LIKE '%.cp2b-%@example.invalid'
  ),
  'syntheticStorageObjects', (
    SELECT count(*)::int
    FROM storage.objects
    WHERE bucket_id = 'invoice-documents'
  )
);
ROLLBACK;`.replace(/\s+/gu, ' ').trim()
}

function createRowIds() {
  const names = [
    'client_a_id', 'client_b_id', 'property_a_id', 'property_b_id',
    'quote_a_id', 'quote_b_id', 'job_a_id', 'job_b_id',
    'invoice_a_id', 'invoice_b_id', 'invoice_line_a_id', 'invoice_line_b_id',
    'membership_admin_a_id', 'membership_member_a_id',
    'membership_admin_b_id', 'membership_member_b_id',
    'membership_suspended_id', 'membership_revoked_id',
    'application_id', 'invitation_active_id', 'invitation_expired_id',
    'invitation_revoked_id', 'invitation_used_id',
    'service_request_a_id', 'service_request_b_id',
    'service_idempotency_a', 'service_idempotency_b',
    'document_a_id', 'document_b_id', 'profile_change_id',
    'property_change_id', 'legal_acceptance_id', 'audit_event_id',
    'correlation_id', 'matrix_idempotency_key', 'random_record_id',
  ]
  return Object.fromEntries(names.map((name) => [name, randomUUID()]))
}

function buildSqlVariables({ environment, runId, authIds, rowIds, objectKeys }) {
  return {
    project_ref: QA_REF,
    cp2b_run_id: runId,
    active_staff_user_id: environment.CP2B_ACTIVE_STAFF_USER_ID,
    suspended_staff_user_id: authIds.suspended_staff,
    admin_a_user_id: authIds.client_admin_a,
    member_a_user_id: authIds.client_member_a,
    admin_b_user_id: authIds.client_admin_b,
    member_b_user_id: authIds.client_member_b,
    pending_user_id: authIds.pending,
    suspended_member_user_id: authIds.suspended_member,
    revoked_member_user_id: authIds.revoked_member,
    unverified_user_id: authIds.unverified,
    invitee_user_id: authIds.invitee,
    ...rowIds,
    document_a_object_key: objectKeys[0],
    document_b_object_key: objectKeys[1],
  }
}

function psqlFile(environment, filePath, variables) {
  const args = ['-X', '-v', 'ON_ERROR_STOP=1']
  for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
  args.push('-f', filePath)
  runPsqlV5(args, {
    environment,
    cwd: repoRoot,
    timeout: 120_000,
  })
}

function psqlCaptureFile(environment, filePath) {
  return runPsqlV5([
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-f',
    filePath,
  ], {
    environment,
    cwd: repoRoot,
    timeout: 120_000,
  }).stdout.trim()
}

function cliRun(args, environment) {
  return runSupabaseCliV3(['--workdir', repoRoot, ...args], {
    repoRoot,
    cwd: process.env.TEMP ?? process.env.TMPDIR ?? repoRoot,
    environment,
    redactFailure: true,
    timeout: 120_000,
  }).stdout.trim()
}

function writePrivateEdgeEnvironment(filePath, environment) {
  const names = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PORTAL_INVITATION_PEPPER',
    'PORTAL_RATE_LIMIT_PEPPER',
    'PORTAL_ALLOWED_ORIGIN',
  ]
  writeFileSync(filePath, `${names.map((name) => `${name}=${environment[name]}`).join('\n')}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}

async function uploadDummyDocuments({ environment, objectKeys }) {
  const body = new TextEncoder().encode('%PDF-1.4\n% CP2B synthetic non-fiscal\n%%EOF\n')
  for (const objectKey of objectKeys) {
    const response = await fetch(
      `${environment.SUPABASE_URL}/storage/v1/object/invoice-documents/${objectKey}`,
      {
        method: 'POST',
        headers: {
          apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/pdf',
          'x-upsert': 'false',
        },
        body,
      },
    )
    if (!response.ok) throw new Error('dummy_document_upload_failed')
  }
}

async function deleteDummyDocuments({ environment, objectKeys }) {
  const response = await fetch(`${environment.SUPABASE_URL}/storage/v1/object/invoice-documents`, {
    method: 'DELETE',
    headers: {
      apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: objectKeys }),
  })
  if (!response.ok && response.status !== 404) {
    throw new Error('dummy_document_cleanup_failed')
  }
}

async function assertDummyDocumentsAbsent({ environment, objectKeys }) {
  for (const objectKey of objectKeys) {
    const response = await fetch(
      `${environment.SUPABASE_URL}/storage/v1/object/invoice-documents/${objectKey}`,
      {
        method: 'HEAD',
        headers: {
          apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    if (response.status !== 404 && response.status !== 400) {
      throw new Error('dummy_document_cleanup_not_verified')
    }
  }
}

async function runHttpEdgeDenialMatrix({ environment, credentials, rowIds }) {
  const tokens = {}
  for (const role of ['client_member_a', 'suspended_member']) {
    const response = await fetch(
      `${environment.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: environment.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials[role].email,
          password: credentials[role].password,
        }),
      },
    )
    const body = await response.json().catch(() => null)
    if (!response.ok || typeof body?.access_token !== 'string') {
      throw new Error('edge_authentication_failed')
    }
    tokens[role] = body.access_token
  }

  const endpoint = `${environment.SUPABASE_URL}/functions/v1/portal-invoice-download`
  const ownClientPayload = {
    action: 'downloadInvoice',
    clientId: rowIds.client_a_id,
    invoiceId: rowIds.invoice_a_id,
    documentId: rowIds.document_a_id,
  }
  const cases = [
    { bearer: null, payload: ownClientPayload, expectedStatus: 401 },
    {
      bearer: tokens.client_member_a,
      payload: {
        action: 'downloadInvoice',
        clientId: rowIds.client_b_id,
        invoiceId: rowIds.invoice_b_id,
        documentId: rowIds.document_b_id,
      },
      expectedStatus: 404,
    },
    {
      bearer: tokens.suspended_member,
      payload: ownClientPayload,
      expectedStatus: 404,
    },
  ]
  for (const testCase of cases) {
    const headers = {
      apikey: environment.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Origin: environment.PORTAL_ALLOWED_ORIGIN,
    }
    if (testCase.bearer) headers.Authorization = `Bearer ${testCase.bearer}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(testCase.payload),
    })
    const body = await response.json().catch(() => null)
    if (response.status !== testCase.expectedStatus
      || body?.error?.code !== 'request_unavailable') {
      throw new Error('edge_denial_matrix_failed')
    }
  }
}

async function recover({ environment, ledgerPath, authRuntime, migrationApplied }) {
  const ledger = readLedger(ledgerPath)
  const variables = authRuntime
    ? buildSqlVariables({
        environment,
        runId: ledger.runId,
        authIds: ledger.created.authUserIds,
        rowIds: ledger.created.rowIds,
        objectKeys: ledger.created.storageObjectKeys,
      })
    : null
  if (variables) {
    if (migrationApplied) {
      try {
        await deleteDummyDocuments({
          environment,
          objectKeys: ledger.created.storageObjectKeys,
        })
        psqlFile(environment, recoveryPath, variables)
      } catch {}
    }
    try {
      await deleteSyntheticAuthUsers({
        supabaseUrl: environment.SUPABASE_URL,
        serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
        projectRef: QA_REF,
        ledgerPath,
      })
    } catch {}
  }
  if (readLedger(ledgerPath).state !== 'blocked') {
    transitionLedger(ledgerPath, 'blocked')
  }
}

function readManifestIfPresent() {
  return existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function gitRun(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  })
  if (result.status !== 0) throw new Error('git_command_failed')
  return result.stdout.trim()
}

async function main() {
  if (process.argv.includes('--plan')) {
    process.stdout.write(`${JSON.stringify(planV5(), null, 2)}\n`)
    return
  }
  if (process.argv.includes('--preflight')) {
    process.stdout.write(`${JSON.stringify(await preflightV5(process.env), null, 2)}\n`)
    return
  }
  if (process.argv.includes('--execute')) {
    const result = await executeV5(process.env)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  throw new Error('mode_required')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}\n`)
    process.exitCode = 1
  })
}
