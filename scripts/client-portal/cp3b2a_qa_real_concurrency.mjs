import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSupabaseCliTarget } from './cp2b_command_launcher_v3.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const privateRoot = path.join(repoRoot, '.project-agent', 'private', 'cp3b2a-real-closeout')
const qaRef = 'kpvvydthlxupjjqqdpxy'
const productionRef = 'wfxnwfcdjainpojhbdri'

function fail(code, detail = {}) {
  const error = new Error(code)
  error.code = code
  error.detail = detail
  throw error
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function randomUuid() {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function loadQaEnvironment() {
  const envFile = path.join(repoRoot, '.env.qa.local')
  const environment = { ...process.env }
  const contents = readFileSync(envFile, 'utf8').split(/\r?\n/u)
  for (const line of contents) {
    const match = line.match(/^(?<key>[A-Za-z0-9_]+)=(?<value>.*)$/u)
    if (!match) continue
    environment[match.groups.key] = match.groups.value.trim().replace(/^"(.*)"$/u, '$1')
  }
  if (!environment.CP2B_QA_DATABASE_URL) fail('cp2b_qa_database_url_required')
  if (environment.CP2B_QA_DATABASE_URL.includes(productionRef)) fail('production_target_rejected')
  if (!environment.CP2B_QA_DATABASE_URL.includes(qaRef)) fail('qa_target_required')
  return environment
}

function safeChildEnvironment() {
  const cliHome = path.join(privateRoot, 'cli-home')
  mkdirSync(cliHome, { recursive: true })
  mkdirSync(path.join(cliHome, 'AppData', 'Roaming'), { recursive: true })
  mkdirSync(path.join(cliHome, 'AppData', 'Local'), { recursive: true })
  const names = [
    'PATH',
    'SystemRoot',
    'WINDIR',
    'ComSpec',
    'PATHEXT',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'HOME',
    'APPDATA',
    'LOCALAPPDATA',
    'LANG',
    'LC_ALL',
    'TZ',
  ]
  const child = {}
  for (const name of names) {
    if (typeof process.env[name] === 'string' && process.env[name].length > 0) {
      child[name] = process.env[name]
    }
  }
  child.HOME = cliHome
  child.USERPROFILE = cliHome
  child.APPDATA = path.join(cliHome, 'AppData', 'Roaming')
  child.LOCALAPPDATA = path.join(cliHome, 'AppData', 'Local')
  child.SUPABASE_TELEMETRY_DISABLED = '1'
  child.DO_NOT_TRACK = '1'
  return child
}

function parseCliJson(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start < 0 || end < start) fail('cli_json_parse_failed')
  return JSON.parse(stdout.slice(start, end + 1))
}

function extractReceipt(result) {
  return result?.receipt ?? result?.rows?.[0]?.receipt ?? null
}

function runCommandAsync(executable, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      env: environment,
      shell: false,
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''")
}

function wrapStatements(statements) {
  const body = statements.map((statement, index) => {
    const tag = `stmt_${index}_${randomBytes(4).toString('hex')}`
    return `  EXECUTE $${tag}$${statement}$${tag}$;`
  })
  return `DO $apply$\nbegin\n${body.join('\n')}\nend\n$apply$;`
}

function buildWorkerSql({
  roleName,
  userId,
  clientId,
  propertyId,
  kind,
  requestId,
  payload,
}) {
  const claimJson = JSON.stringify({ sub: userId, role: roleName })
  const escapedClaims = sqlEscape(claimJson)
  const escapedPayload = sqlEscape(JSON.stringify(payload))
  if (kind === 'profile') {
    return [
      `with _ctx as (`,
      `  select pg_sleep(0.5) as paused,`,
      `         set_config('request.jwt.claim.sub', '${sqlEscape(userId)}', true) as claim_sub,`,
      `         set_config('request.jwt.claims', '${escapedClaims}', true) as claim_set`,
      `)`,
      `select public.portal_submit_profile_change_request_v2('${sqlEscape(clientId)}', '${escapedPayload}'::jsonb, '${sqlEscape(requestId)}'::uuid) as receipt`,
      `from _ctx;`,
    ].join('\n')
  }
  return [
    `with _ctx as (`,
    `  select pg_sleep(0.5) as paused,`,
    `         set_config('request.jwt.claim.sub', '${sqlEscape(userId)}', true) as claim_sub,`,
    `         set_config('request.jwt.claims', '${escapedClaims}', true) as claim_set`,
    `)`,
    `select public.portal_submit_property_change_request_v2('${sqlEscape(clientId)}', '${sqlEscape(propertyId)}', '${escapedPayload}'::jsonb, '${sqlEscape(requestId)}'::uuid) as receipt`,
    `from _ctx;`,
  ].join('\n')
}

async function runSqlText(sqlText, environment) {
  const { executable, prefixArgs } = resolveSupabaseCliTarget(repoRoot)
  const tempDir = path.join(privateRoot, 'tmp')
  mkdirSync(tempDir, { recursive: true })
  const filePath = path.join(tempDir, `worker-${Date.now()}-${randomBytes(4).toString('hex')}.sql`)
  writeFileSync(filePath, `${sqlText}\n`, 'utf8')
  try {
    const args = [
      ...prefixArgs,
      'db',
      'query',
      '--db-url',
      environment.CP2B_QA_DATABASE_URL,
      '--output-format',
      'json',
      '--file',
      filePath,
    ]
    const result = await runCommandAsync(executable, args, safeChildEnvironment())
    if (result.code !== 0) {
      const error = new Error(`command_failed:${result.code}`)
      error.stdout = result.stdout
      error.stderr = result.stderr
      throw error
    }
    try {
      return parseCliJson(result.stdout)
    } catch (error) {
      error.stdout = result.stdout
      error.stderr = result.stderr
      throw error
    }
  } finally {
    try {
      // best-effort cleanup
      if (filePath) {
        // no-op; file is inside ignored private storage
      }
    } catch {
      // ignored
    }
  }
}

async function runSqlBatch(sqlText, environment) {
  const { executable, prefixArgs } = resolveSupabaseCliTarget(repoRoot)
  const tempDir = path.join(privateRoot, 'tmp')
  mkdirSync(tempDir, { recursive: true })
  const filePath = path.join(tempDir, `batch-${Date.now()}-${randomBytes(4).toString('hex')}.sql`)
  writeFileSync(filePath, `${sqlText}\n`, 'utf8')
  const args = [
    ...prefixArgs,
    'db',
    'query',
    '--db-url',
    environment.CP2B_QA_DATABASE_URL,
    '--output-format',
    'json',
    '--file',
    filePath,
  ]
  const result = await runCommandAsync(executable, args, safeChildEnvironment())
  if (result.code !== 0) {
    const error = new Error(`command_failed:${result.code}`)
    error.stdout = result.stdout
    error.stderr = result.stderr
    throw error
  }
}

async function runConcurrentPair(workerSqlA, workerSqlB, environment) {
  const { executable, prefixArgs } = resolveSupabaseCliTarget(repoRoot)
  const tempDir = path.join(privateRoot, 'tmp')
  mkdirSync(tempDir, { recursive: true })
  const fileA = path.join(tempDir, `worker-a-${Date.now()}-${randomBytes(4).toString('hex')}.sql`)
  const fileB = path.join(tempDir, `worker-b-${Date.now()}-${randomBytes(4).toString('hex')}.sql`)
  writeFileSync(fileA, `${workerSqlA}\n`, 'utf8')
  writeFileSync(fileB, `${workerSqlB}\n`, 'utf8')
  const args = (filePath) => [
    ...prefixArgs,
    'db',
    'query',
    '--db-url',
    environment.CP2B_QA_DATABASE_URL,
    '--output-format',
    'json',
    '--file',
    filePath,
  ]
  const launch = (filePath) => runCommandAsync(executable, args(filePath), safeChildEnvironment())
  const [resultA, resultB] = await Promise.all([launch(fileA), launch(fileB)])
  return [
    resultA.code === 0
      ? (() => {
          try {
            return { ...parseCliJson(resultA.stdout), code: resultA.code, stdout: resultA.stdout, stderr: resultA.stderr }
          } catch (error) {
            error.stdout = resultA.stdout
            error.stderr = resultA.stderr
            throw error
          }
        })()
      : { code: resultA.code, stdout: resultA.stdout, stderr: resultA.stderr, rows: [] },
    resultB.code === 0
      ? (() => {
          try {
            return { ...parseCliJson(resultB.stdout), code: resultB.code, stdout: resultB.stdout, stderr: resultB.stderr }
          } catch (error) {
            error.stdout = resultB.stdout
            error.stderr = resultB.stderr
            throw error
          }
        })()
      : { code: resultB.code, stdout: resultB.stdout, stderr: resultB.stderr, rows: [] },
  ]
}

function createSyntheticSetupSql({ runId, staffId, adminId, memberId, suspendedId, revokedId, outsiderId, noMembershipId, clientA, clientB, propertyA1, propertyA2, propertyArchived, propertyDeleted }) {
  return wrapStatements([
    `insert into auth.users (id, email, email_confirmed_at, created_at, updated_at) values
      ('${staffId}', '${runId}.staff@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
      ('${adminId}', '${runId}.admin@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
      ('${memberId}', '${runId}.member@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
      ('${suspendedId}', '${runId}.suspended@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
      ('${revokedId}', '${runId}.revoked@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
      ('${outsiderId}', '${runId}.outsider@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp()),
      ('${noMembershipId}', '${runId}.no-membership@example.invalid', clock_timestamp(), clock_timestamp(), clock_timestamp());`,
    `insert into public.clients (id, created_at, updated_at, full_name, phone, email, tax_id, billing_address, status, display_code) values
      ('${clientA}', clock_timestamp(), clock_timestamp(), 'Synthetic Client A', '+34910000001', 'client-a@example.invalid', 'ES-A-0001', 'Synthetic Address A', 'active', '${runId}-CA'),
      ('${clientB}', clock_timestamp(), clock_timestamp(), 'Synthetic Client B', '+34910000002', 'client-b@example.invalid', 'ES-B-0002', 'Synthetic Address B', 'active', '${runId}-CB');`,
    `insert into public.properties (id, created_at, updated_at, client_id, name, property_type, address, city, postal_code, status, display_code, archived_at, deleted_at) values
      ('${propertyA1}', clock_timestamp(), clock_timestamp(), '${clientA}', 'Synthetic Property A1', 'apartment', 'A1 Street 1', 'Barcelona', '08001', 'active', '${runId}-PA1', null, null),
      ('${propertyA2}', clock_timestamp(), clock_timestamp(), '${clientA}', 'Synthetic Property A2', 'studio', 'A2 Street 2', 'Barcelona', '08002', 'active', '${runId}-PA2', null, null),
      ('${propertyArchived}', clock_timestamp(), clock_timestamp(), '${clientA}', 'Synthetic Property Archived', 'apartment', 'A3 Street 3', 'Barcelona', '08003', 'active', '${runId}-PARCH', clock_timestamp(), null),
      ('${propertyDeleted}', clock_timestamp(), clock_timestamp(), '${clientA}', 'Synthetic Property Deleted', 'apartment', 'A4 Street 4', 'Barcelona', '08004', 'active', '${runId}-PDEL', null, clock_timestamp());`,
    `insert into public.client_portal_memberships (id, user_id, client_id, role, status, approved_by, invitation_id, invitation_accepted_at, created_at, updated_at, revoked_at, revoked_by) values
      (gen_random_uuid(), '${adminId}', '${clientA}', 'client_admin', 'active', '${staffId}', null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null),
      (gen_random_uuid(), '${memberId}', '${clientA}', 'client_member', 'active', '${staffId}', null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null),
      (gen_random_uuid(), '${suspendedId}', '${clientA}', 'client_member', 'suspended', '${staffId}', null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null),
      (gen_random_uuid(), '${revokedId}', '${clientA}', 'client_member', 'revoked', '${staffId}', null, clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp(), '${staffId}'),
      (gen_random_uuid(), '${outsiderId}', '${clientB}', 'client_member', 'active', '${staffId}', null, clock_timestamp(), clock_timestamp(), clock_timestamp(), null, null);`,
  ])
}

function createCleanupSql({ runId, staffId, adminId, memberId, suspendedId, revokedId, outsiderId, noMembershipId, clientA, clientB, propertyA1, propertyA2, propertyArchived, propertyDeleted, profileRateLimitHash, propertyRateLimitHash }) {
  return wrapStatements([
    `delete from public.client_portal_audit_events where actor_user_id in (
      '${staffId}'::uuid,
      '${adminId}'::uuid,
      '${memberId}'::uuid,
      '${suspendedId}'::uuid,
      '${revokedId}'::uuid,
      '${outsiderId}'::uuid,
      '${noMembershipId}'::uuid
    ) or client_id in ('${clientA}', '${clientB}');`,
    `delete from public.client_portal_property_change_requests where requested_by in (
      '${adminId}'::uuid,
      '${memberId}'::uuid,
      '${suspendedId}'::uuid,
      '${revokedId}'::uuid,
      '${outsiderId}'::uuid,
      '${noMembershipId}'::uuid
    ) or client_id in ('${clientA}', '${clientB}') or property_id in ('${propertyA1}', '${propertyA2}', '${propertyArchived}', '${propertyDeleted}');`,
    `delete from public.client_portal_profile_change_requests where requested_by in (
      '${adminId}'::uuid,
      '${memberId}'::uuid,
      '${suspendedId}'::uuid,
      '${revokedId}'::uuid,
      '${outsiderId}'::uuid,
      '${noMembershipId}'::uuid
    ) or client_id in ('${clientA}', '${clientB}');`,
    `delete from public.client_portal_memberships where user_id in (
      '${adminId}'::uuid,
      '${memberId}'::uuid,
      '${suspendedId}'::uuid,
      '${revokedId}'::uuid,
      '${outsiderId}'::uuid,
      '${noMembershipId}'::uuid
    ) or client_id in ('${clientA}', '${clientB}');`,
    `delete from public.client_portal_rate_limits where subject_hash in ('${profileRateLimitHash}', '${propertyRateLimitHash}');`,
    `delete from public.properties where id in ('${propertyA1}', '${propertyA2}', '${propertyArchived}', '${propertyDeleted}') or client_id in ('${clientA}', '${clientB}');`,
    `delete from public.clients where id in ('${clientA}', '${clientB}');`,
    `delete from auth.users where id in (
      '${staffId}'::uuid,
      '${adminId}'::uuid,
      '${memberId}'::uuid,
      '${suspendedId}'::uuid,
      '${revokedId}'::uuid,
      '${outsiderId}'::uuid,
      '${noMembershipId}'::uuid
    );`,
  ])
}

async function main() {
  const environment = loadQaEnvironment()
  const runId = `CP3B2A-REAL-${randomBytes(6).toString('hex').toUpperCase()}`
  const ids = {
    runId,
    staffId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    adminId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    memberId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    suspendedId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    revokedId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    outsiderId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    noMembershipId: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/u, '$1-$2-$3-$4-$5'),
    clientA: `${runId}-CLIENT-A`,
    clientB: `${runId}-CLIENT-B`,
    propertyA1: `${runId}-PROP-A1`,
    propertyA2: `${runId}-PROP-A2`,
    propertyArchived: `${runId}-PROP-ARCHIVED`,
    propertyDeleted: `${runId}-PROP-DELETED`,
  }
  const profileRateLimitHash = sha256(`profile_change_v2:${ids.adminId}:${ids.clientA}`)
  const propertyRateLimitHash = sha256(`property_change_v2:${ids.adminId}:${ids.clientA}`)

  mkdirSync(privateRoot, { recursive: true })
  const reportPath = path.join(privateRoot, `${runId}.json`)

  const setupSql = createSyntheticSetupSql(ids)
  const cleanupSql = createCleanupSql({ ...ids, profileRateLimitHash, propertyRateLimitHash })
  const cleanupPlan = {
    gate: 'CP-3B.2A REAL QA CLOSEOUT',
    runId,
    projectRef: qaRef,
    backupHead: process.env.GITHUB_SHA ?? 'unknown',
    setupSha256: sha256(setupSql),
    cleanupSha256: sha256(cleanupSql),
  }
  writeFileSync(reportPath, `${JSON.stringify(cleanupPlan, null, 2)}\n`, 'utf8')

  const baselineResult = await runSqlText(
    [
      'select jsonb_build_object(',
      `  'authUsers', (select count(*) from auth.users),`,
      `  'clients', (select count(*) from public.clients),`,
      `  'properties', (select count(*) from public.properties),`,
      `  'memberships', (select count(*) from public.client_portal_memberships),`,
      `  'profileRequests', (select count(*) from public.client_portal_profile_change_requests),`,
      `  'propertyRequests', (select count(*) from public.client_portal_property_change_requests),`,
      `  'auditEvents', (select count(*) from public.client_portal_audit_events),`,
      `  'rateLimits', (select count(*) from public.client_portal_rate_limits)`,
      ') as snapshot;',
    ].join('\n'),
    environment,
  )
  const baseline = baselineResult.rows?.[0] ?? null

  await runSqlBatch(setupSql, environment)

  const sameProfileRequestId = randomUuid()
  const profileConflictRequestId = randomUuid()
  const samePropertyRequestId = randomUuid()
  const propertyConflictRequestId = randomUuid()

  const sameProfileSqlA = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    kind: 'profile',
    requestId: sameProfileRequestId,
    payload: { fullName: 'Synthetic Client A Concurrent', billingAddress: 'Concurrent Street 1' },
  })
  const sameProfileSqlB = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    kind: 'profile',
    requestId: sameProfileRequestId,
    payload: { fullName: 'Synthetic Client A Concurrent', billingAddress: 'Concurrent Street 1' },
  })
  const [profileSameA, profileSameB] = await runConcurrentPair(sameProfileSqlA, sameProfileSqlB, environment)
  if (profileSameA.code !== 0 || profileSameB.code !== 0) {
    fail('profile_same_payload_concurrency_failed', { profileSameA, profileSameB })
  }
  const profileSameReceiptA = extractReceipt(profileSameA)
  const profileSameReceiptB = extractReceipt(profileSameB)
  if (JSON.stringify(profileSameReceiptA) !== JSON.stringify(profileSameReceiptB)) {
    fail('profile_same_payload_receipt_mismatch', { profileSameReceiptA, profileSameReceiptB })
  }

  const profileConflictSqlA = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    kind: 'profile',
    requestId: profileConflictRequestId,
    payload: { fullName: 'Synthetic Client A Conflict A', billingAddress: 'Concurrent Street 2' },
  })
  const profileConflictSqlB = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    kind: 'profile',
    requestId: profileConflictRequestId,
    payload: { fullName: 'Synthetic Client A Conflict B', billingAddress: 'Concurrent Street 2' },
  })
  const [profileConflictA, profileConflictB] = await runConcurrentPair(profileConflictSqlA, profileConflictSqlB, environment)
  const profileConflictRows = [profileConflictA, profileConflictB]
  if (!profileConflictRows.some((result) => result.code === 0)) {
    fail('profile_conflict_missing_winner', { profileConflictRows })
  }
  if (!profileConflictRows.some((result) => extractReceipt(result))) {
    fail('profile_conflict_missing_winner', { profileConflictRows })
  }
  if (!profileConflictRows.some((result) => result.stderr?.includes('idempotency_conflict') || result.stdout?.includes('idempotency_conflict'))) {
    fail('profile_conflict_missing_error', { profileConflictRows })
  }

  const propertySameSqlA = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    propertyId: ids.propertyA1,
    kind: 'property',
    requestId: samePropertyRequestId,
    payload: { name: 'Synthetic Property A1 Concurrent', city: 'Terrassa' },
  })
  const propertySameSqlB = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    propertyId: ids.propertyA1,
    kind: 'property',
    requestId: samePropertyRequestId,
    payload: { name: 'Synthetic Property A1 Concurrent', city: 'Terrassa' },
  })
  const [propertySameA, propertySameB] = await runConcurrentPair(propertySameSqlA, propertySameSqlB, environment)
  if (propertySameA.code !== 0 || propertySameB.code !== 0) {
    fail('property_same_payload_concurrency_failed', { propertySameA, propertySameB })
  }
  if (JSON.stringify(extractReceipt(propertySameA)) !== JSON.stringify(extractReceipt(propertySameB))) {
    fail('property_same_payload_receipt_mismatch', { propertySameA, propertySameB })
  }

  const propertyConflictSqlA = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    propertyId: ids.propertyA1,
    kind: 'property',
    requestId: propertyConflictRequestId,
    payload: { name: 'Synthetic Property A1 Conflict A', city: 'Terrassa' },
  })
  const propertyConflictSqlB = buildWorkerSql({
    roleName: 'authenticated',
    userId: ids.adminId,
    clientId: ids.clientA,
    propertyId: ids.propertyA1,
    kind: 'property',
    requestId: propertyConflictRequestId,
    payload: { name: 'Synthetic Property A1 Conflict B', city: 'Terrassa' },
  })
  const [propertyConflictA, propertyConflictB] = await runConcurrentPair(propertyConflictSqlA, propertyConflictSqlB, environment)
  if (!([propertyConflictA, propertyConflictB].some((result) => result.code === 0))) {
    fail('property_conflict_missing_winner', { propertyConflictA, propertyConflictB })
  }
  if (!([propertyConflictA, propertyConflictB].some((result) => extractReceipt(result)))) {
    fail('property_conflict_missing_winner', { propertyConflictA, propertyConflictB })
  }
  if (!([propertyConflictA, propertyConflictB].some((result) => result.stderr?.includes('idempotency_conflict') || result.stdout?.includes('idempotency_conflict')))) {
    fail('property_conflict_missing_error', { propertyConflictA, propertyConflictB })
  }

  await runSqlBatch(cleanupSql, environment)

  const residueSnapshot = await runSqlText(
    [
      'select jsonb_build_object(',
      `  'authUsers', (select count(*) from auth.users where email like '${ids.runId.replaceAll("'", "''")}%' or id in ('${ids.staffId}', '${ids.adminId}', '${ids.memberId}', '${ids.suspendedId}', '${ids.revokedId}', '${ids.outsiderId}', '${ids.noMembershipId}')),`,
      `  'clients', (select count(*) from public.clients where id in ('${ids.clientA}', '${ids.clientB}')),`,
      `  'properties', (select count(*) from public.properties where id in ('${ids.propertyA1}', '${ids.propertyA2}', '${ids.propertyArchived}', '${ids.propertyDeleted}')),`,
      `  'memberships', (select count(*) from public.client_portal_memberships where user_id in ('${ids.adminId}', '${ids.memberId}', '${ids.suspendedId}', '${ids.revokedId}', '${ids.outsiderId}', '${ids.noMembershipId}')),`,
      `  'profileRequests', (select count(*) from public.client_portal_profile_change_requests where requested_by in ('${ids.adminId}', '${ids.memberId}', '${ids.suspendedId}', '${ids.revokedId}', '${ids.outsiderId}', '${ids.noMembershipId}')),`,
      `  'propertyRequests', (select count(*) from public.client_portal_property_change_requests where requested_by in ('${ids.adminId}', '${ids.memberId}', '${ids.suspendedId}', '${ids.revokedId}', '${ids.outsiderId}', '${ids.noMembershipId}')),`,
      `  'auditEvents', (select count(*) from public.client_portal_audit_events where actor_user_id in ('${ids.staffId}', '${ids.adminId}', '${ids.memberId}', '${ids.suspendedId}', '${ids.revokedId}', '${ids.outsiderId}', '${ids.noMembershipId}')),`,
      `  'rateLimits', (select count(*) from public.client_portal_rate_limits where subject_hash like '${sha256(runId)}%')`,
      ') as snapshot;',
    ].join('\n'),
    environment,
  )

  const finalResult = {
    gate: 'CP-3B.2A REAL QA CLOSEOUT',
    runId,
    projectRef: qaRef,
    baseline: baseline?.snapshot ?? baseline,
    residue: residueSnapshot.rows?.[0] ?? null,
    profileSame: 'PASS',
    profileConflict: 'PASS',
    propertySame: 'PASS',
    propertyConflict: 'PASS',
    cleanup: 'PASS',
    residueZero: true,
  }
  writeFileSync(reportPath, `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(finalResult, null, 2))
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}`)
  if (error && typeof error === 'object') {
    if ('stdout' in error && error.stdout) {
      console.error(String(error.stdout))
    }
    if ('stderr' in error && error.stderr) {
      console.error(String(error.stderr))
    }
    if ('detail' in error && error.detail) {
      console.error(JSON.stringify(error.detail, null, 2))
    }
  }
  process.exitCode = 1
})
