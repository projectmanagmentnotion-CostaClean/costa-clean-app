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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_package_v2.manifest.json')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260723160000_client_portal_security_boundary.sql',
)
const applyPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_apply.sql')
const fixturesPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_fixtures_v2.sql')
const matrixPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_authorization_matrix_v2.sql')
const cleanupPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_cleanup_v2.sql')
const recoveryPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_failure_recovery_v2.sql',
)
const snapshotPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_catalog_snapshot.sql',
)
const psql = process.platform === 'win32'
  ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
  : 'psql'
const cli = process.platform === 'win32'
  ? path.join(repoRoot, 'node_modules', '.bin', 'supabase.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'supabase')

const privateInputNames = [
  'CP2B_QA_DATABASE_URL',
  'CP2B_ACTIVE_STAFF_USER_ID',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
  'PORTAL_ALLOWED_ORIGIN',
]

export function privateInputStatus(environment) {
  return Object.fromEntries(privateInputNames.map((name) => [
    name,
    environment[name]?.trim() ? 'PRESENT' : 'MISSING',
  ]))
}

export function assertExecutionGate({ environment, manifest, gitHead, clean }) {
  if (environment.CP2B_EXECUTION_AUTHORIZED !== 'true') throw new Error('execution_not_authorized')
  if (environment.CP2B_PROJECT_REF !== QA_REF) throw new Error('qa_target_required')
  if (environment.CP2B_PROJECT_REF === PRODUCTION_REF) throw new Error('production_target_rejected')
  if (environment.CP2B_V2_AUTHORIZATION_ID !== manifest.authorizationId) {
    throw new Error('v2_authorization_mismatch')
  }
  if (!environment.CP2B_V2_AUTHORIZED_HEAD
    || environment.CP2B_V2_AUTHORIZED_HEAD !== gitHead
    || !clean) {
    throw new Error('git_authorization_mismatch')
  }
  if (Object.values(privateInputStatus(environment)).includes('MISSING')) {
    throw new Error('private_input_missing')
  }
  validateQaTarget({
    projectRef: environment.CP2B_PROJECT_REF,
    supabaseUrl: environment.SUPABASE_URL,
  })
  if (!environment.CP2B_QA_DATABASE_URL.includes(QA_REF)
    || environment.CP2B_QA_DATABASE_URL.includes(PRODUCTION_REF)) {
    throw new Error('database_target_rejected')
  }
  verifyPrivateBackup(environment.CP2B_PRIVATE_BACKUP_MANIFEST, gitHead)
}

export function verifyPrivateBackup(backupManifestPath, gitHead) {
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

export function verifyManifest(manifest) {
  if (manifest.version !== 2
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.status !== 'PREPARED_NOT_AUTHORIZED'
    || !Array.isArray(manifest.artifacts)) {
    throw new Error('invalid_v2_manifest')
  }
  for (const artifact of manifest.artifacts) {
    const filePath = path.join(repoRoot, artifact.path)
    if (!existsSync(filePath) || sha256(filePath) !== artifact.sha256) {
      throw new Error('v2_manifest_hash_mismatch')
    }
  }
  if (sha256(migrationPath) !== manifest.migrationSha256) {
    throw new Error('migration_hash_mismatch')
  }
  return true
}

function plan() {
  const manifest = readManifestIfPresent()
  return {
    gate: 'CP-2B-V2',
    mode: 'plan',
    status: 'NOT_AUTHORIZED',
    qaProjectRef: QA_REF,
    productionRejected: true,
    remoteWrites: 0,
    manifestPresent: Boolean(manifest),
    stages: manifest?.expectedStages ?? [],
    requiredPrivateInputs: privateInputNames,
  }
}

function preflight(environment) {
  const manifest = readManifestIfPresent()
  const projectRef = environment.CP2B_PROJECT_REF
  if (projectRef === PRODUCTION_REF) throw new Error('production_target_rejected')
  if (projectRef && projectRef !== QA_REF) throw new Error('qa_target_required')
  if (manifest) verifyManifest(manifest)
  return {
    gate: 'CP-2B-V2',
    mode: 'preflight',
    remoteWrites: 0,
    projectRef: projectRef === QA_REF ? 'QA_MATCH' : 'MISSING',
    production: 'PRODUCTION_REJECTED',
    manifest: manifest ? 'PASS' : 'MISSING',
    privateInputs: privateInputStatus(environment),
  }
}

async function execute(environment) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  verifyManifest(manifest)
  const gitHead = run('git', ['rev-parse', 'HEAD'])
  const clean = run('git', ['status', '--porcelain']) === ''
  assertExecutionGate({ environment, manifest, gitHead, clean })
  assertTripleIdentity(environment)

  const runId = createRunId()
  const ledgerPath = path.join(repoRoot, '.git', 'cp2b-private', `${runId}.ledger.json`)
  const secretEnvPath = path.join(repoRoot, '.git', 'cp2b-private', `${runId}.edge.env`)
  const catalogSnapshotPath = path.join(
    repoRoot,
    '.git',
    'cp2b-private',
    `${runId}.catalog-before.json`,
  )
  createEmptyLedger(ledgerPath, runId)
  transitionLedger(ledgerPath, 'backup_complete')

  let authRuntime
  let migrationApplied = false
  try {
    authRuntime = await createSyntheticAuthUsers({
      supabaseUrl: environment.SUPABASE_URL,
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      projectRef: QA_REF,
      runId,
      ledgerPath,
    })
    const rowIds = createRowIds()
    const objectKeys = [
      `${rowIds.document_a_id}/${randomUUID()}.pdf`,
      `${rowIds.document_b_id}/${randomUUID()}.pdf`,
    ]
    recordLedgerIdentifiers(ledgerPath, {
      rowIds,
      storageObjectKeys: objectKeys,
    })

    assertTripleIdentity(environment)
    writeFileSync(
      catalogSnapshotPath,
      `${psqlCaptureFile(environment.CP2B_QA_DATABASE_URL, snapshotPath)}\n`,
      { encoding: 'utf8', mode: 0o600 },
    )
    psqlFile(environment.CP2B_QA_DATABASE_URL, applyPath, {
      project_ref: QA_REF,
      active_staff_user_id: environment.CP2B_ACTIVE_STAFF_USER_ID,
      suspended_staff_user_id: authRuntime.ids.suspended_staff,
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
    psqlFile(environment.CP2B_QA_DATABASE_URL, fixturesPath, variables)
    transitionLedger(ledgerPath, 'fixtures_created')

    writePrivateEdgeEnvironment(secretEnvPath, environment)
    cliRun(['secrets', 'set', '--project-ref', QA_REF, '--env-file', secretEnvPath])
    for (const functionName of [
      'portal-account-actions',
      'portal-service-actions',
      'portal-member-actions',
      'portal-invoice-download',
    ]) {
      assertTripleIdentity(environment)
      cliRun([
        'functions', 'deploy', functionName,
        '--project-ref', QA_REF,
        '--no-verify-jwt',
      ])
    }
    transitionLedger(ledgerPath, 'edge_deployed')

    await uploadDummyDocuments({
      environment,
      objectKeys,
    })
    transitionLedger(ledgerPath, 'storage_verified')

    await runHttpEdgeDenialMatrix({
      environment,
      credentials: authRuntime.credentials,
      rowIds,
    })
    psqlFile(environment.CP2B_QA_DATABASE_URL, matrixPath, variables)
    transitionLedger(ledgerPath, 'matrix_passed')

    transitionLedger(ledgerPath, 'cleanup_started')
    await deleteDummyDocuments({ environment, objectKeys })
    await assertDummyDocumentsAbsent({ environment, objectKeys })
    psqlFile(environment.CP2B_QA_DATABASE_URL, cleanupPath, variables)
    transitionLedger(ledgerPath, 'cleanup_complete')
    await deleteSyntheticAuthUsers({
      supabaseUrl: environment.SUPABASE_URL,
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      projectRef: QA_REF,
      ledgerPath,
    })
    transitionLedger(ledgerPath, 'zero_residue_verified')
    transitionLedger(ledgerPath, 'completed')
    return { status: 'PASS', runId: 'REDACTED', remoteTarget: QA_REF }
  } catch (error) {
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
    throw error
  } finally {
    rmSync(secretEnvPath, { force: true })
  }
}

function assertTripleIdentity(environment) {
  const localRef = readFileSync(path.join(repoRoot, 'supabase', '.temp', 'project-ref'), 'utf8').trim()
  if (localRef !== QA_REF || localRef === PRODUCTION_REF) throw new Error('local_link_rejected')
  if (!environment.CP2B_QA_DATABASE_URL.includes(QA_REF)
    || environment.CP2B_QA_DATABASE_URL.includes(PRODUCTION_REF)) {
    throw new Error('database_target_rejected')
  }
  const projects = JSON.parse(cliRun(['projects', 'list', '--output', 'json']))
  if (!projects.some((project) => project.id === QA_REF && project.linked === true)) {
    throw new Error('cli_target_rejected')
  }
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

function psqlFile(databaseUrl, filePath, variables) {
  const args = [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1']
  for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
  args.push('-f', filePath)
  run(psql, args, { redactFailure: true, timeout: 120_000 })
}

function psqlCaptureFile(databaseUrl, filePath) {
  return run(psql, [
    databaseUrl,
    '-X', '-v', 'ON_ERROR_STOP=1',
    '-At', '-f', filePath,
  ], { redactFailure: true, timeout: 120_000 })
}

function cliRun(args) {
  const neutralDir = path.join(process.env.TEMP ?? process.env.TMPDIR ?? repoRoot, 'cp2b-cli-neutral')
  return run(cli, ['--workdir', repoRoot, ...args], {
    cwd: neutralDir,
    redactFailure: true,
    timeout: 120_000,
  })
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
  if (!response.ok && response.status !== 404) throw new Error('dummy_document_cleanup_failed')
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
  const crossClientPayload = {
    action: 'downloadInvoice',
    clientId: rowIds.client_b_id,
    invoiceId: rowIds.invoice_b_id,
    documentId: rowIds.document_b_id,
  }
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
      payload: crossClientPayload,
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
        psqlFile(environment.CP2B_QA_DATABASE_URL, recoveryPath, variables)
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

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 30_000,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    const detail = options.redactFailure
      ? 'redacted'
      : [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`command_failed:${path.basename(executable)}:${detail}`)
  }
  return (result.stdout ?? '').trim()
}

async function main() {
  if (process.argv.includes('--plan')) {
    process.stdout.write(`${JSON.stringify(plan(), null, 2)}\n`)
    return
  }
  if (process.argv.includes('--preflight')) {
    process.stdout.write(`${JSON.stringify(preflight(process.env), null, 2)}\n`)
    return
  }
  if (process.argv.includes('--execute')) {
    const result = await execute(process.env)
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
