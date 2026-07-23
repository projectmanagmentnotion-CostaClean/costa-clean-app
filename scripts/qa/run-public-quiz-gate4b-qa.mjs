import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const qaRef = 'kpvvydthlxupjjqqdpxy'
const productionRef = 'wfxnwfcdjainpojhbdri'
const functionSlug = 'submit-public-gym-manual-quiz'
const migrationName = '20260722171428_public_quiz_providerless_abuse_protection.sql'
const expectedMigrationHash = '8FE5E78E6BCFBCF15E3537CBDEBD8A3E852FBCA04209650E47FCFBF9DB3D9EF3'
const execute = process.argv.includes(`--execute=${qaRef}`)
const privateDir = path.join(repoRoot, '.project-agent/private/gate4b-public-quiz')
const qaEnvPath = path.join(repoRoot, '.env.qa.local')
const dbUrlPath = path.join(repoRoot, '.project-agent/private/schema-export/qa-db-url.txt')
const linkedRefPath = path.join(repoRoot, 'supabase/.temp/project-ref')
const migrationPath = path.join(repoRoot, 'supabase/migrations', migrationName)
const beforePath = path.join(privateDir, 'qa-before.json')
const afterPath = path.join(privateDir, 'qa-after.json')
const schemaBeforePath = path.join(privateDir, 'qa-public-schema-before.sql')
const schemaAfterPath = path.join(privateDir, 'qa-public-schema-after.sql')
const rollbackPath = path.join(privateDir, 'qa-rollback.sql')
const matrixPath = path.join(privateDir, 'qa-synthetic-matrix.json')
const logsPath = path.join(privateDir, 'qa-log-privacy-summary.json')
const publicTables = [
  'annual_closings', 'audit_events', 'clients', 'expenses', 'intake_submissions',
  'invoice_lines', 'invoices', 'job_lines', 'jobs', 'lead_drafts', 'leads',
  'payments', 'properties', 'public_gym_manual_quiz_attempts',
  'quarterly_closings', 'quote_lines', 'quotes',
]

function fail(message) {
  throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function parseEnvFile(filePath) {
  const values = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u)
    if (!match || match[1].startsWith('#')) continue
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, '$2')
  }
  return values
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      DO_NOT_TRACK: '1',
      SUPABASE_TELEMETRY_DISABLED: '1',
      ...options.env,
    },
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    windowsHide: true,
  })
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || 'unknown command failure').trim()
    fail(`${path.basename(command)} failed: ${detail}`)
  }
  return result.stdout
}

function findPostgresTool(name) {
  const exact = `C:/Program Files/PostgreSQL/17/bin/${name}.exe`
  if (!existsSync(exact)) fail(`PostgreSQL 17 ${name} is unavailable`)
  return exact
}

function runSupabase(args) {
  return run(process.execPath, [path.join(repoRoot, 'node_modules/supabase/dist/supabase.js'), ...args])
}

function psql(pgEnv, sql) {
  return run(findPostgresTool('psql'), ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { env: pgEnv, input: sql }).trim()
}

function dumpPublicSchema(pgEnv) {
  return run(findPostgresTool('pg_dump'), [
    '--schema-only', '--schema=public', '--no-owner', '--no-privileges',
    '--restrict-key=Gate4BPublicQuiz20260722',
  ], { env: pgEnv })
}

function assertLocalInputs() {
  for (const required of [qaEnvPath, dbUrlPath, linkedRefPath, migrationPath]) {
    if (!existsSync(required)) fail(`Required private or linked input is missing: ${path.basename(required)}`)
  }
  const actualHash = sha256(readFileSync(migrationPath))
  if (actualHash !== expectedMigrationHash) fail('Reviewed migration SHA-256 mismatch')
  const migrationSql = readFileSync(migrationPath, 'utf8')
  const boundaries = migrationSql.match(/^\s*(?:begin|commit);\s*$/gimu) ?? []
  if (boundaries.length !== 2 || !/^\s*begin;/iu.test(migrationSql) || !/commit;\s*$/iu.test(migrationSql)) {
    fail('Migration is not bounded by exactly one explicit transaction')
  }

  const qaEnv = parseEnvFile(qaEnvPath)
  const publicUrl = new URL(qaEnv.VITE_SUPABASE_URL)
  if (qaEnv.QA_SANDBOX_PROJECT_REF !== qaRef || publicUrl.hostname !== `${qaRef}.supabase.co`) {
    fail('Public QA identity does not match the authorized project')
  }
  if (publicUrl.hostname.includes(productionRef)) fail('Production public target detected')
  const linkedRef = readFileSync(linkedRefPath, 'utf8').trim()
  if (linkedRef !== qaRef || linkedRef === productionRef) fail('Linked Supabase ref is not the exact QA ref')

  const dbUrlRaw = readFileSync(dbUrlPath, 'utf8').trim()
  if (dbUrlRaw.includes(productionRef)) fail('Production ref detected in private database configuration')
  const dbUrl = new URL(dbUrlRaw)
  if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)
    || !dbUrl.hostname.endsWith('.pooler.supabase.com')
    || decodeURIComponent(dbUrl.username) !== `postgres.${qaRef}`
    || !dbUrl.password
    || dbUrl.pathname !== '/postgres') {
    fail('Private QA database identity is not exact')
  }

  const projects = JSON.parse(runSupabase(['projects', 'list', '--output', 'json']))
  if (!projects.some((project) => project.id === qaRef)) fail('Authenticated CLI cannot see the authorized QA project')

  return {
    qaEnv,
    pgEnv: {
      PGHOST: dbUrl.hostname,
      PGPORT: dbUrl.port || '6543',
      PGDATABASE: 'postgres',
      PGUSER: decodeURIComponent(dbUrl.username),
      PGPASSWORD: decodeURIComponent(dbUrl.password),
      PGSSLMODE: 'require',
    },
  }
}

function qLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function snapshot(pgEnv) {
  const counts = publicTables.map((table) => `${qLiteral(table)}, (select count(*) from public.${table})`).join(',')
  const base = JSON.parse(psql(pgEnv, `
    select jsonb_build_object(
      'currentUser', current_user,
      'currentDatabase', current_database(),
      'serverMajor', current_setting('server_version_num')::integer / 10000,
      'publicTableNames', (select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public'),
      'rowCounts', jsonb_build_object(${counts}),
      'attemptRows', (select count(*) from public.public_gym_manual_quiz_attempts),
      'syntheticAttemptRows', (select count(*) from public.public_gym_manual_quiz_attempts where nombre_trabajador like 'QA-GATE4B-%'),
      'guardTableExists', to_regclass('public.public_quiz_submission_guards') is not null,
      'privateRpcExists', to_regprocedure('public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)') is not null,
      'anonLegacyRpcExecute', has_function_privilege('anon', 'public.submit_public_gym_manual_quiz_attempt(jsonb)', 'EXECUTE'),
      'authenticatedLegacyRpcExecute', has_function_privilege('authenticated', 'public.submit_public_gym_manual_quiz_attempt(jsonb)', 'EXECUTE'),
      'historyVersions', (select coalesce(jsonb_agg(version order by version), '[]'::jsonb) from supabase_migrations.schema_migrations),
      'anonymousHistorySelectPolicyCount', (select count(*) from pg_policies where schemaname='public' and tablename='public_gym_manual_quiz_attempts' and roles && array['public'::name,'anon'::name] and cmd='SELECT')
    );
  `))
  if (!['postgres', `postgres.${qaRef}`].includes(base.currentUser)
    || base.currentDatabase !== 'postgres' || base.serverMajor !== 17) {
    fail('Live PostgreSQL QA identity/version check failed')
  }
  base.guardRows = base.guardTableExists
    ? Number(psql(pgEnv, 'select count(*) from public.public_quiz_submission_guards;'))
    : 0
  base.anonPrivateRpcExecute = base.privateRpcExists
    ? psql(pgEnv, "select has_function_privilege('anon', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE');") === 't'
    : false
  base.authenticatedPrivateRpcExecute = base.privateRpcExists
    ? psql(pgEnv, "select has_function_privilege('authenticated', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE');") === 't'
    : false
  base.serviceRolePrivateRpcExecute = base.privateRpcExists
    ? psql(pgEnv, "select has_function_privilege('service_role', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE');") === 't'
    : false
  base.publicSchemaSql = dumpPublicSchema(pgEnv)
  base.publicSchemaSha256 = sha256(base.publicSchemaSql)
  return base
}

function publicSnapshot(snapshotValue) {
  const { publicSchemaSql, ...safe } = snapshotValue
  return safe
}

function assertBefore(before) {
  if (before.guardTableExists || before.privateRpcExists) fail('Gate 4B database objects already exist before apply')
  if (before.syntheticAttemptRows !== 0) fail('Pre-existing Gate 4B synthetic attempts were found')
  if (before.anonymousHistorySelectPolicyCount !== 0) fail('Anonymous quiz history policy is present')
}

function assertAfter(after, before) {
  if (!after.guardTableExists || !after.privateRpcExists) fail('Gate 4B database objects are missing after apply')
  if (after.anonLegacyRpcExecute || after.authenticatedLegacyRpcExecute
    || after.anonPrivateRpcExecute || after.authenticatedPrivateRpcExecute
    || !after.serviceRolePrivateRpcExecute) {
    fail('Quiz RPC grants do not match the reviewed private contract')
  }
  if (after.anonymousHistorySelectPolicyCount !== 0) fail('Anonymous quiz history policy was reopened')
  if (JSON.stringify(after.rowCounts) !== JSON.stringify(before.rowCounts) || after.guardRows !== 0) {
    fail('Migration apply changed business row counts or created guard data')
  }
  if (JSON.stringify(after.historyVersions) !== JSON.stringify(before.historyVersions)) {
    fail('Migration history changed even though history writes are prohibited')
  }
}

function writePrivate(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, value, { mode: 0o600 })
}

function rollbackSql() {
  return `-- QA-only Gate 4B rollback artifact. Production is forbidden.\n` +
    `begin;\nset local lock_timeout='4s';\nset local statement_timeout='60s';\n` +
    `do $$ begin if current_user not in ('postgres','postgres.${qaRef}') then raise exception 'QA identity guard failed'; end if; end $$;\n` +
    `drop function if exists public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text);\n` +
    `drop table if exists public.public_quiz_submission_guards;\n` +
    `grant execute on function public.submit_public_gym_manual_quiz_attempt(jsonb) to anon, authenticated;\ncommit;\n`
}

function applyMigration(pgEnv) {
  run(findPostgresTool('psql'), [
    '-X', '--set=ON_ERROR_STOP=1', '--file', migrationPath,
  ], { env: pgEnv })
}

function setSecret(pepper) {
  const tempPath = path.join(privateDir, `.gate4b-secret-${randomUUID()}.env`)
  writePrivate(tempPath, `PUBLIC_QUIZ_FINGERPRINT_PEPPER=${pepper}\n`)
  try {
    runSupabase(['secrets', 'set', '--project-ref', qaRef, '--env-file', tempPath, '--yes'])
  } finally {
    rmSync(tempPath, { force: true })
  }
}

function deployFunction() {
  runSupabase([
    'functions', 'deploy', functionSlug,
    '--project-ref', qaRef, '--no-verify-jwt', '--use-api',
  ])
  const functions = JSON.parse(runSupabase(['functions', 'list', '--project-ref', qaRef, '--output', 'json']))
  const deployed = functions.find((item) => item.slug === functionSlug || item.name === functionSlug)
  if (!deployed) fail('Edge Function deployment is not visible in QA')
  return {
    slug: deployed.slug ?? deployed.name,
    status: deployed.status ?? null,
    version: deployed.version ?? null,
    verifyJwt: deployed.verify_jwt ?? deployed.verifyJwt ?? false,
    updatedAt: deployed.updated_at ?? deployed.updatedAt ?? null,
  }
}

function requestPayload(workerName, nonce, now = Date.now()) {
  return {
    workerName,
    quizVersion: 'gym-manual-2026-07-22-v1',
    answers: {
      q01: 'b', q02: 'c', q03: 'd', q04: 'a', q05: 'c', q06: 'b', q07: 'd', q08: 'a', q09: 'b', q10: 'c',
      q11: 'a', q12: 'd', q13: 'b', q14: 'c', q15: 'a', q16: 'd', q17: 'b', q18: 'c', q19: 'b', q20: 'c',
    },
    honeypot: '',
    interactionStartedAt: now - 31_000,
    interactionDurationMs: 31_000,
    requestNonce: nonce,
  }
}

async function invoke(url, anonKey, body, options = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': options.contentType ?? 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const responseText = await response.text()
  if (/SQL|PostgREST|service_role|fingerprint|nonce_hash|stack trace/iu.test(responseText)) {
    fail('A public response exposed internal details')
  }
  return { status: response.status, body: responseText }
}

function expectStatus(label, actual, expected) {
  if (!expected.includes(actual)) fail(`${label} returned HTTP ${actual}; expected ${expected.join('/')}`)
  return { case: label, status: actual, expected: expected.join('/') }
}

async function restRequest(url, anonKey, init) {
  const response = await fetch(url, {
    ...init,
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', ...init.headers },
  })
  return response.status
}

function hmac(pepper, value) {
  return createHmac('sha256', pepper).update(value).digest('hex')
}

async function runSyntheticMatrix(qaEnv, pgEnv, pepper) {
  const runId = randomBytes(6).toString('hex').toUpperCase()
  const workerName = `QA-GATE4B-${runId}`
  const nonce = randomUUID()
  const cooldownNonce = randomUUID()
  const payload = requestPayload(workerName, nonce)
  const endpoint = `${qaEnv.VITE_SUPABASE_URL}/functions/v1/${functionSlug}`
  const rest = `${qaEnv.VITE_SUPABASE_URL}/rest/v1`
  const anonKey = qaEnv.VITE_SUPABASE_ANON_KEY
  const startedAt = new Date().toISOString()
  const matrix = []
  let attemptId = null
  try {
    matrix.push(expectStatus('malformed', (await invoke(endpoint, anonKey, '{')).status, [400]))
    matrix.push(expectStatus('oversized', (await invoke(endpoint, anonKey, JSON.stringify({ padding: 'x'.repeat(17_000) }))).status, [413]))
    matrix.push(expectStatus('unknown-field', (await invoke(endpoint, anonKey, { ...payload, forgedScore: 20 })).status, [400]))
    matrix.push(expectStatus('honeypot', (await invoke(endpoint, anonKey, { ...payload, honeypot: 'bot' })).status, [400]))
    matrix.push(expectStatus('too-fast', (await invoke(endpoint, anonKey, { ...payload, interactionStartedAt: Date.now() - 100, interactionDurationMs: 100 })).status, [400]))

    const legitimate = await invoke(endpoint, anonKey, payload)
    matrix.push(expectStatus('legitimate', legitimate.status, [200]))
    const legitimateBody = JSON.parse(legitimate.body)
    if (legitimateBody?.ok !== true || legitimateBody?.result?.score !== 20 || legitimateBody?.result?.percentage !== 100) {
      fail('Legitimate response is not the compact authoritative result')
    }
    attemptId = psql(pgEnv, `select id::text from public.public_gym_manual_quiz_attempts where nombre_trabajador=${qLiteral(workerName)};`)
    if (!/^[0-9a-f-]{36}$/iu.test(attemptId)) fail('Legitimate submission did not reconcile to exactly one attempt')

    matrix.push(expectStatus('replay', (await invoke(endpoint, anonKey, payload)).status, [429]))
    matrix.push(expectStatus('cooldown', (await invoke(endpoint, anonKey, { ...payload, requestNonce: cooldownNonce })).status, [429]))

    const privateRpcStatus = await restRequest(`${rest}/rpc/submit_public_gym_manual_quiz_attempt_private`, anonKey, {
      method: 'POST', body: JSON.stringify({ p_request: payload, p_fingerprint_hash: 'a'.repeat(64), p_nonce_hash: 'b'.repeat(64) }),
    })
    matrix.push(expectStatus('anonymous-private-rpc', privateRpcStatus, [401, 403, 404]))
    const legacyRpcStatus = await restRequest(`${rest}/rpc/submit_public_gym_manual_quiz_attempt`, anonKey, {
      method: 'POST', body: JSON.stringify({ p_attempt: {} }),
    })
    matrix.push(expectStatus('anonymous-legacy-rpc', legacyRpcStatus, [401, 403, 404]))
    const historyStatus = await restRequest(`${rest}/public_gym_manual_quiz_attempts?select=id&limit=1`, anonKey, { method: 'GET' })
    matrix.push(expectStatus('anonymous-history-read', historyStatus, [401, 403]))
    const directInsertStatus = await restRequest(`${rest}/public_gym_manual_quiz_attempts`, anonKey, {
      method: 'POST', body: JSON.stringify({ nombre_trabajador: workerName, puntuacion: 20, porcentaje: 100, aprobado: true, total_preguntas: 20 }),
    })
    matrix.push(expectStatus('anonymous-direct-insert', directInsertStatus, [401, 403]))

    return { runId, workerName, nonce, cooldownNonce, attemptId, startedAt, matrix }
  } catch (error) {
    error.synthetic = { runId, workerName, nonce, cooldownNonce, attemptId, startedAt, matrix }
    throw error
  }
}

function cleanupSynthetic(pgEnv, pepper, synthetic) {
  if (!synthetic) return { attemptRows: 0, guardRows: 0, residue: 0 }
  const nonceHashes = [synthetic.nonce, synthetic.cooldownNonce].map((nonce) => hmac(pepper, `nonce:${nonce}`))
  const cleanup = JSON.parse(psql(pgEnv, `
    begin;
    do $$ begin if current_user not in ('postgres','postgres.${qaRef}') then raise exception 'QA cleanup identity guard failed'; end if; end $$;
    with deleted as (
      delete from public.public_gym_manual_quiz_attempts
      where nombre_trabajador=${qLiteral(synthetic.workerName)}
        ${synthetic.attemptId ? `and id=${qLiteral(synthetic.attemptId)}::uuid` : ''}
      returning id
    ) select count(*) from deleted;
    with deleted as (
      delete from public.public_quiz_submission_guards
      where nonce_hash in (${nonceHashes.map(qLiteral).join(',')})
      returning nonce_hash
    ) select count(*) from deleted;
    commit;
    select jsonb_build_object(
      'attemptRows', (select count(*) from public.public_gym_manual_quiz_attempts where nombre_trabajador=${qLiteral(synthetic.workerName)}),
      'guardRows', (select count(*) from public.public_quiz_submission_guards where nonce_hash in (${nonceHashes.map(qLiteral).join(',')})),
      'allSyntheticAttempts', (select count(*) from public.public_gym_manual_quiz_attempts where nombre_trabajador like 'QA-GATE4B-%')
    );
  `).split(/\r?\n/u).filter(Boolean).at(-1))
  if (cleanup.attemptRows !== 0 || cleanup.guardRows !== 0 || cleanup.allSyntheticAttempts !== 0) {
    fail('Synthetic cleanup did not prove zero residue')
  }
  return cleanup
}

async function inspectFunctionLogs(startedAt, forbiddenValues) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) fail('Supabase access token is unavailable for the privacy-safe log query')
  const endedAt = new Date().toISOString()
  const sql = `select datetime(timestamp) as logged_at, event_message from function_logs where event_message like '%submission_%' or event_message like '%configuration_denied%' or event_message like '%handler_error%' order by timestamp desc limit 100`
  const url = new URL(`https://api.supabase.com/v1/projects/${qaRef}/analytics/endpoints/logs.all`)
  url.searchParams.set('sql', sql)
  url.searchParams.set('iso_timestamp_start', startedAt)
  url.searchParams.set('iso_timestamp_end', endedAt)
  let rows = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) fail(`QA function log query failed with HTTP ${response.status}`)
    const body = await response.json()
    rows = Array.isArray(body?.result) ? body.result : Array.isArray(body) ? body : []
    if (rows.length > 0) break
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
  const text = JSON.stringify(rows)
  const forbiddenPatterns = [/bearer\s/iu, /authorization/iu, /user-agent/iu, /x-forwarded-for/iu, /"workerName"/u, /"answers"/u, /\b(?:\d{1,3}\.){3}\d{1,3}\b/u]
  if (forbiddenPatterns.some((pattern) => pattern.test(text)) || forbiddenValues.some((value) => value && text.includes(value))) {
    fail('Function custom logs contain prohibited request or identity material')
  }
  return { startedAt, endedAt, matchedEvents: rows.length, privacyViolations: 0, scope: 'function_logs event_message' }
}

async function main() {
  mkdirSync(privateDir, { recursive: true })
  const { qaEnv, pgEnv } = assertLocalInputs()
  const before = snapshot(pgEnv)
  if (before.guardTableExists || before.privateRpcExists) {
    if (execute) fail('Gate 4B is already applied; repeat remote mutation is blocked')
    if (!existsSync(beforePath)) fail('Saved pre-apply evidence is missing')
    const savedBefore = JSON.parse(readFileSync(beforePath, 'utf8'))
    assertAfter(before, savedBefore)
    if (before.syntheticAttemptRows !== 0 || before.guardRows !== 0) fail('Post-apply verification found synthetic residue')
    let settledLogs = null
    if (existsSync(matrixPath)) {
      const savedMatrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
      settledLogs = await inspectFunctionLogs(savedMatrix.startedAt, [savedMatrix.workerName, qaEnv.VITE_SUPABASE_ANON_KEY])
      writePrivate(logsPath, `${JSON.stringify(settledLogs, null, 2)}\n`)
    }
    console.log('Gate 4B QA post-apply verification: PASS')
    console.log(`Target checks: public=${qaRef}, linked=${qaRef}, private/live=${qaRef}`)
    console.log(`Migration: ${migrationName}`)
    console.log(`Migration SHA-256: ${expectedMigrationHash}`)
    console.log(`Current public schema SHA-256: ${before.publicSchemaSha256}`)
    console.log('Synthetic residue: 0 attempts; 0 guards')
    if (settledLogs) console.log(`Custom log privacy: PASS (${settledLogs.matchedEvents} matching events; 0 violations)`)
    console.log('Remote mutation: NO')
    return
  }
  assertBefore(before)
  writePrivate(beforePath, `${JSON.stringify(publicSnapshot(before), null, 2)}\n`)
  writePrivate(schemaBeforePath, before.publicSchemaSql)
  writePrivate(rollbackPath, rollbackSql())

  console.log('Gate 4B QA preflight: PASS')
  console.log(`Target checks: public=${qaRef}, linked=${qaRef}, private/live=${qaRef}`)
  console.log(`Migration: ${migrationName}`)
  console.log(`Migration SHA-256: ${expectedMigrationHash}`)
  console.log(`Pre-apply public schema SHA-256: ${before.publicSchemaSha256}`)
  if (!execute) {
    console.log(`Remote mutation: NO (pass --execute=${qaRef} for the separately authorized run)`)
    return
  }

  const pepper = randomBytes(48).toString('base64url')
  let synthetic = null
  let cleanup = null
  try {
    setSecret(pepper)
    applyMigration(pgEnv)
    const afterApply = snapshot(pgEnv)
    assertAfter(afterApply, before)
    const deployment = deployFunction()
    synthetic = await runSyntheticMatrix(qaEnv, pgEnv, pepper)
    const logs = await inspectFunctionLogs(synthetic.startedAt, [synthetic.workerName, synthetic.nonce, qaEnv.VITE_SUPABASE_ANON_KEY])
    writePrivate(logsPath, `${JSON.stringify(logs, null, 2)}\n`)
    cleanup = cleanupSynthetic(pgEnv, pepper, synthetic)
    const after = snapshot(pgEnv)
    assertAfter(after, before)
    if (after.syntheticAttemptRows !== 0 || after.guardRows !== 0) fail('Post-cleanup snapshot contains synthetic residue')
    writePrivate(afterPath, `${JSON.stringify(publicSnapshot(after), null, 2)}\n`)
    writePrivate(schemaAfterPath, after.publicSchemaSql)
    writePrivate(matrixPath, `${JSON.stringify({ ...synthetic, nonce: '[redacted]', cooldownNonce: '[redacted]', cleanup, deployment }, null, 2)}\n`)

    console.log('Gate 4B QA execution: PASS')
    console.log(`Post-apply public schema SHA-256: ${after.publicSchemaSha256}`)
    console.log(`Edge Function: ${deployment.slug}; status=${deployment.status ?? 'deployed'}; version=${deployment.version ?? 'n/a'}`)
    console.log(`Synthetic matrix: ${synthetic.matrix.length}/${synthetic.matrix.length} PASS`)
    console.log('Synthetic residue: 0 attempts; 0 guards')
    console.log(`Custom log privacy: PASS (${logs.matchedEvents} matching events; 0 violations)`)
    console.log('Production modified: NO')
  } catch (error) {
    synthetic ??= error.synthetic ?? null
    try {
      cleanup = cleanupSynthetic(pgEnv, pepper, synthetic)
      console.error(`Emergency cleanup residue: attempts=${cleanup.attemptRows}; guards=${cleanup.guardRows}`)
    } catch (cleanupError) {
      console.error(`Emergency cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`)
    }
    throw error
  }
}

try {
  await main()
} catch (error) {
  console.error(`Gate 4B QA runner: FAIL - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
