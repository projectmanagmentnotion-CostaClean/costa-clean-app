import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const productionRef = 'wfxnwfcdjainpojhbdri'
const forbiddenQaRef = 'kpvvydthlxupjjqqdpxy'
const functionSlug = 'submit-public-gym-manual-quiz'
const migrationName = '20260722171428_public_quiz_providerless_abuse_protection.sql'
const migrationHash = '8FE5E78E6BCFBCF15E3537CBDEBD8A3E852FBCA04209650E47FCFBF9DB3D9EF3'
const completionFlag = `--complete=${productionRef}`
const complete = process.argv.includes(completionFlag)
const forbiddenMutationFlags = process.argv.filter((argument) => (
  argument.startsWith('--execute=')
  || argument === '--deploy'
  || argument === '--apply'
  || argument === '--set-secret'
))
const privateDir = path.join(repoRoot, '.project-agent/private/gate4c-public-quiz')
const envPath = path.join(repoRoot, '.env.local')
const dbUrlPath = path.join(repoRoot, '.project-agent/private/schema-export/prod-db-url.txt')
const linkedRefPath = path.join(repoRoot, 'supabase/.temp/project-ref')
const migrationPath = path.join(repoRoot, 'supabase/migrations', migrationName)
const rollbackPath = path.join(privateDir, 'prod-rollback.sql')
const rollbackPlanPath = path.join(privateDir, 'prod-rollback-plan.json')
const beforePath = path.join(privateDir, 'prod-completion-before.json')
const afterPath = path.join(privateDir, 'prod-completion-after.json')
const matrixPath = path.join(privateDir, 'prod-synthetic-matrix.json')
const logsPath = path.join(privateDir, 'prod-log-privacy-summary.json')
const publicTables = [
  'annual_closings', 'audit_events', 'clients', 'expenses', 'intake_submissions',
  'invoice_lines', 'invoices', 'job_lines', 'jobs', 'lead_drafts', 'leads',
  'payments', 'properties', 'public_gym_manual_quiz_attempts',
  'public_quiz_submission_guards', 'quarterly_closings', 'quote_lines', 'quotes',
]
const financialTables = new Set([
  'annual_closings', 'expenses', 'invoice_lines', 'invoices',
  'payments', 'quarterly_closings',
])

function fail(message) {
  throw new Error(message)
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function qLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function writePrivate(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, value, { mode: 0o600 })
}

function parseEnv(filePath) {
  const result = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u)
    if (!match || match[1].startsWith('#')) continue
    result[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, '$2')
  }
  return result
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      DO_NOT_TRACK: '1',
      NO_UPDATE_NOTIFIER: '1',
      ...options.env,
    },
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
    windowsHide: true,
  })
  if (result.status !== 0) {
    fail(`${path.basename(command)} failed: ${(result.stderr || result.stdout || 'unknown failure').trim()}`)
  }
  return { stdout: result.stdout, stderr: result.stderr }
}

function postgresTool(name) {
  const tool = `C:/Program Files/PostgreSQL/17/bin/${name}.exe`
  if (!existsSync(tool)) fail(`PostgreSQL 17 ${name} is unavailable`)
  return tool
}

function psql(pgEnv, sql) {
  return run(postgresTool('psql'), ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    env: pgEnv,
    input: sql,
  }).stdout.trim()
}

function vercelCommand() {
  const command = path.join(process.env.APPDATA ?? '', 'npm', 'vercel.cmd')
  if (!existsSync(command)) fail('Vercel CLI is unavailable')
  return command
}

function runVercel(args) {
  const commandLine = `${vercelCommand()} ${args.join(' ')}`
  return run(process.env.ComSpec ?? 'C:/Windows/System32/cmd.exe', [
    '/d', '/s', '/c', commandLine,
  ])
}

function currentVercelDeployment() {
  const output = runVercel(['ls', '--yes']).stdout
  const match = output.match(/https:\/\/costa-clean-[a-z0-9-]+\.vercel\.app/iu)
  if (!match) fail('Current Vercel production deployment could not be identified')
  return match[0]
}

async function managementMetadata() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) fail('SUPABASE_ACCESS_TOKEN is unavailable in the process')
  const headers = { Authorization: `Bearer ${token}` }
  const [projectResponse, functionsResponse, secretsResponse] = await Promise.all([
    fetch(`https://api.supabase.com/v1/projects/${productionRef}`, { headers }),
    fetch(`https://api.supabase.com/v1/projects/${productionRef}/functions`, { headers }),
    fetch(`https://api.supabase.com/v1/projects/${productionRef}/secrets`, { headers }),
  ])
  if (!projectResponse.ok || !functionsResponse.ok || !secretsResponse.ok) {
    fail(`Supabase management metadata read failed (${projectResponse.status}/${functionsResponse.status}/${secretsResponse.status})`)
  }
  const project = await projectResponse.json()
  const functions = await functionsResponse.json()
  const secrets = await secretsResponse.json()
  const edge = functions.find((item) => item.slug === functionSlug || item.name === functionSlug)
  const pepperPresent = secrets.some((item) => item.name === 'PUBLIC_QUIZ_FINGERPRINT_PEPPER')
  if (project.ref !== productionRef || project.status !== 'ACTIVE_HEALTHY'
    || !edge || edge.status !== 'ACTIVE' || edge.verify_jwt !== false || !pepperPresent) {
    fail('Production project, Edge Function, or named secret metadata does not match Gate 4C')
  }
  return {
    project: { ref: project.ref, status: project.status, region: project.region },
    edge: {
      slug: edge.slug ?? edge.name,
      status: edge.status,
      version: edge.version,
      verifyJwt: edge.verify_jwt,
      updatedAt: edge.updated_at,
      bundleSha256: edge.ezbr_sha256,
    },
    pepperNamePresent: true,
  }
}

async function validateFrontend() {
  const domainUrl = 'https://app.costacleanbcn.com'
  const response = await fetch(domainUrl)
  if (response.status !== 200) fail(`Production domain returned HTTP ${response.status}`)
  const html = await response.text()
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js(?:\?[^" ]*)?)"/giu)]
    .map((match) => new URL(match[1], domainUrl).href)
  const seen = new Set()
  let productionRefPresent = false
  let forbiddenQaRefPresent = false
  while (queue.length > 0 && seen.size < 200) {
    const assetUrl = queue.shift()
    if (seen.has(assetUrl)) continue
    seen.add(assetUrl)
    const assetResponse = await fetch(assetUrl)
    if (!assetResponse.ok) fail(`Frontend asset returned HTTP ${assetResponse.status}`)
    const source = await assetResponse.text()
    productionRefPresent ||= source.includes(productionRef)
    forbiddenQaRefPresent ||= source.includes(forbiddenQaRef)
    for (const match of source.matchAll(/["']([^"']+\.js)["']/gu)) {
      const nestedUrl = new URL(match[1], assetUrl)
      if (nestedUrl.origin === new URL(domainUrl).origin && !seen.has(nestedUrl.href)) {
        queue.push(nestedUrl.href)
      }
    }
  }
  if (!productionRefPresent || forbiddenQaRefPresent) {
    fail('Deployed frontend Supabase identity is not exclusively production')
  }
  return {
    deploymentUrl: currentVercelDeployment(),
    domainUrl,
    domainStatus: response.status,
    inspectedJavaScriptAssets: seen.size,
    productionRefPresent,
    forbiddenQaRefPresent,
  }
}

async function validatePreflight() {
  const response = await fetch(
    `https://${productionRef}.supabase.co/functions/v1/${functionSlug}`,
    {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.costacleanbcn.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,apikey,content-type',
      },
    },
  )
  if (response.status !== 204
    || response.headers.get('access-control-allow-origin') !== '*'
    || !response.headers.get('access-control-allow-methods')?.includes('POST')) {
    fail(`Production Edge preflight failed with HTTP ${response.status}`)
  }
  return { status: response.status, allowOrigin: '*', postAllowed: true }
}

function assertInputs() {
  if (forbiddenMutationFlags.length > 0) {
    fail('Mutation flags are forbidden: Gate 4C completion never applies, deploys, or sets secrets')
  }
  for (const required of [envPath, dbUrlPath, linkedRefPath, migrationPath, rollbackPath, rollbackPlanPath]) {
    if (!existsSync(required)) fail(`Required private, linked, or rollback input is missing: ${path.basename(required)}`)
  }
  if (hash(readFileSync(migrationPath)) !== migrationHash) fail('Reviewed migration SHA-256 mismatch')
  const migrationSql = readFileSync(migrationPath, 'utf8')
  const boundaries = migrationSql.match(/^\s*(?:begin|commit);\s*$/gimu) ?? []
  if (boundaries.length !== 2 || !/^\s*begin;/iu.test(migrationSql) || !/commit;\s*$/iu.test(migrationSql)) {
    fail('Migration is not bounded by one explicit transaction')
  }
  if (/invoice_number|display_code|payments|expenses|closings/iu.test(migrationSql)) {
    fail('Migration touches a protected financial or fiscal identifier')
  }

  const publicEnv = parseEnv(envPath)
  const publicUrl = new URL(publicEnv.VITE_SUPABASE_URL)
  if (publicUrl.hostname !== `${productionRef}.supabase.co`
    || publicUrl.hostname.includes(forbiddenQaRef)
    || !publicEnv.VITE_SUPABASE_ANON_KEY) {
    fail('Public production identity is not exact')
  }
  const linkedRef = readFileSync(linkedRefPath, 'utf8').trim()
  if (linkedRef !== productionRef || linkedRef === forbiddenQaRef) fail('Supabase link is not exact production')

  const dbUrl = new URL(readFileSync(dbUrlPath, 'utf8').trim())
  if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)
    || !dbUrl.hostname.endsWith('.pooler.supabase.com')
    || decodeURIComponent(dbUrl.username) !== `postgres.${productionRef}`
    || !dbUrl.password || dbUrl.pathname !== '/postgres') {
    fail('Private PostgreSQL identity is not exact production')
  }
  return {
    publicEnv,
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

function tableDigest(pgEnv, table) {
  const line = psql(pgEnv, `
    begin read only;
    select jsonb_build_object(
      'count', count(*),
      'digest', md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by to_jsonb(t)::text), ''))
    ) from public.${table} t;
    commit;
  `).split(/\r?\n/u).find((value) => value.startsWith('{'))
  return JSON.parse(line)
}

function snapshot(pgEnv) {
  const line = psql(pgEnv, `
    begin read only;
    select jsonb_build_object(
      'currentUserOk', current_user in ('postgres','postgres.${productionRef}'),
      'currentDatabaseOk', current_database()='postgres',
      'serverMajor', current_setting('server_version_num')::integer / 10000,
      'tables', (select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public'),
      'historyVersions', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
      'guardTableExists', to_regclass('public.public_quiz_submission_guards') is not null,
      'privateRpcExists', to_regprocedure('public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)') is not null,
      'legacyAnonExecute', has_function_privilege('anon', 'public.submit_public_gym_manual_quiz_attempt(jsonb)', 'EXECUTE'),
      'legacyAuthenticatedExecute', has_function_privilege('authenticated', 'public.submit_public_gym_manual_quiz_attempt(jsonb)', 'EXECUTE'),
      'privateAnonExecute', has_function_privilege('anon', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE'),
      'privateAuthenticatedExecute', has_function_privilege('authenticated', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE'),
      'privateServiceRoleExecute', has_function_privilege('service_role', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE'),
      'anonymousHistoryPolicyCount', (
        select count(*) from pg_policies
        where schemaname='public' and tablename='public_gym_manual_quiz_attempts'
          and roles && array['public'::name,'anon'::name] and cmd='SELECT'
      ),
      'attemptsTotal', (select count(*) from public.public_gym_manual_quiz_attempts),
      'realAttempts', (
        select count(*) from public.public_gym_manual_quiz_attempts
        where nombre_trabajador not like 'PROD-GATE4C-%'
      ),
      'syntheticAttempts', (
        select count(*) from public.public_gym_manual_quiz_attempts
        where nombre_trabajador like 'PROD-GATE4C-%'
      ),
      'guardRows', (select count(*) from public.public_quiz_submission_guards)
    );
    commit;
  `).split(/\r?\n/u).find((value) => value.startsWith('{'))
  const base = JSON.parse(line)
  if (!base.currentUserOk || !base.currentDatabaseOk || base.serverMajor !== 17) {
    fail('Live PostgreSQL production identity/version check failed')
  }
  if (JSON.stringify(base.tables) !== JSON.stringify(publicTables)) {
    fail('Production public table inventory diverged from the reviewed Gate 4C inventory')
  }
  base.data = Object.fromEntries(base.tables.map((table) => [table, tableDigest(pgEnv, table)]))
  base.financialDataSha256 = hash(JSON.stringify(
    Object.fromEntries([...financialTables].map((table) => [table, base.data[table]])),
  ))
  const sequenceState = psql(pgEnv, `
    begin read only;
    select coalesce(jsonb_agg(to_jsonb(s) order by schemaname, sequencename), '[]'::jsonb)
    from pg_sequences s where schemaname='public';
    commit;
  `).split(/\r?\n/u).find((value) => value.startsWith('['))
  base.sequenceStateSha256 = hash(sequenceState)
  return base
}

function assertReleasedState(value) {
  if (!value.guardTableExists || !value.privateRpcExists
    || value.legacyAnonExecute || value.legacyAuthenticatedExecute
    || value.privateAnonExecute || value.privateAuthenticatedExecute
    || !value.privateServiceRoleExecute || value.anonymousHistoryPolicyCount !== 0) {
    fail('Production quiz objects or grants do not match the released private contract')
  }
}

function assertCleanBaseline(value) {
  assertReleasedState(value)
  if (value.attemptsTotal !== 6 || value.realAttempts !== 6
    || value.syntheticAttempts !== 0 || value.guardRows !== 0) {
    fail('Production attempt or guard baseline is not exactly 6 real / 0 synthetic / 0 guards')
  }
}

function assertStableData(after, before) {
  if (JSON.stringify(after.data) !== JSON.stringify(before.data)
    || after.financialDataSha256 !== before.financialDataSha256
    || after.sequenceStateSha256 !== before.sequenceStateSha256
    || JSON.stringify(after.historyVersions) !== JSON.stringify(before.historyVersions)) {
    fail('Postflight detected changed real data, financial/fiscal data, sequences, or migration history')
  }
}

function payload(workerName, nonce, now = Date.now()) {
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

async function invoke(url, anonKey, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await response.text()
  if (/SQL|PostgREST|service_role|fingerprint|nonce_hash|stack trace/iu.test(text)) {
    fail('Public response exposed internal details')
  }
  return { status: response.status, body: text }
}

function expectStatus(label, actual, expected) {
  if (!expected.includes(actual)) fail(`${label} returned HTTP ${actual}; expected ${expected.join('/')}`)
  return { case: label, status: actual, expected: expected.join('/') }
}

async function restStatus(url, anonKey, method, body) {
  const response = await fetch(url, {
    method,
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return response.status
}

function guardHashes(pgEnv) {
  const line = psql(pgEnv, `
    begin read only;
    select coalesce(jsonb_agg(nonce_hash order by nonce_hash), '[]'::jsonb)
    from public.public_quiz_submission_guards;
    commit;
  `).split(/\r?\n/u).find((value) => value.startsWith('['))
  const values = JSON.parse(line)
  if (!values.every((value) => /^[0-9a-f]{64}$/u.test(value))) fail('Invalid guard hash material found')
  return values
}

function storedAttempt(pgEnv, workerName) {
  const line = psql(pgEnv, `
    begin read only;
    select jsonb_build_object(
      'id', id,
      'score', puntuacion,
      'percentage', porcentaje,
      'passed', aprobado,
      'totalQuestions', total_preguntas,
      'incorrectCount', jsonb_array_length(errores_json)
    )
    from public.public_gym_manual_quiz_attempts
    where nombre_trabajador=${qLiteral(workerName)};
    commit;
  `).split(/\r?\n/u).find((value) => value.startsWith('{'))
  if (!line) fail('Legitimate production synthetic attempt was not persisted')
  return JSON.parse(line)
}

async function syntheticMatrix(publicEnv, pgEnv) {
  const runId = randomBytes(6).toString('hex').toUpperCase()
  const workerName = `PROD-GATE4C-${runId}`
  const nonce = randomUUID()
  const cooldownNonce = randomUUID()
  const request = payload(workerName, nonce)
  const endpoint = `${publicEnv.VITE_SUPABASE_URL}/functions/v1/${functionSlug}`
  const rest = `${publicEnv.VITE_SUPABASE_URL}/rest/v1`
  const key = publicEnv.VITE_SUPABASE_ANON_KEY
  const startedAt = new Date().toISOString()
  const matrix = []
  const synthetic = {
    runId, workerName, nonce, cooldownNonce, attemptId: null,
    guardHashes: [], startedAt, matrix,
  }
  try {
    matrix.push(expectStatus('malformed', (await invoke(endpoint, key, '{')).status, [400]))
    matrix.push(expectStatus('oversized', (await invoke(endpoint, key, JSON.stringify({ padding: 'x'.repeat(17_000) }))).status, [413]))
    matrix.push(expectStatus('unknown-field', (await invoke(endpoint, key, { ...request, forgedScore: 0 })).status, [400]))
    matrix.push(expectStatus('honeypot', (await invoke(endpoint, key, { ...request, honeypot: 'bot' })).status, [400]))
    matrix.push(expectStatus('too-fast', (await invoke(endpoint, key, {
      ...request,
      interactionStartedAt: Date.now() - 100,
      interactionDurationMs: 100,
    })).status, [400]))

    const legitimate = await invoke(endpoint, key, request)
    matrix.push(expectStatus('legitimate', legitimate.status, [200]))
    const result = JSON.parse(legitimate.body)
    if (result?.ok !== true || result?.result?.score !== 20
      || result?.result?.percentage !== 100 || result?.result?.passed !== true
      || result?.result?.totalQuestions !== 20
      || result?.result?.incorrectQuestionIds?.length !== 0) {
      fail('Legitimate response is not server-authoritative 20/20')
    }
    const persisted = storedAttempt(pgEnv, workerName)
    if (!/^[0-9a-f-]{36}$/iu.test(persisted.id)
      || persisted.score !== 20 || persisted.percentage !== 100
      || persisted.passed !== true || persisted.totalQuestions !== 20
      || persisted.incorrectCount !== 0) {
      fail('Stored production synthetic attempt does not reconcile to server scoring')
    }
    synthetic.attemptId = persisted.id
    synthetic.guardHashes = guardHashes(pgEnv)
    if (synthetic.guardHashes.length !== 1) {
      fail('Expected exactly one guard immediately after the legitimate submission')
    }

    matrix.push(expectStatus('replay', (await invoke(endpoint, key, request)).status, [429]))
    matrix.push(expectStatus('cooldown', (await invoke(endpoint, key, {
      ...request,
      requestNonce: cooldownNonce,
    })).status, [429]))
    const twoGuards = guardHashes(pgEnv)
    if (twoGuards.length !== 2 || !synthetic.guardHashes.every((value) => twoGuards.includes(value))) {
      fail('Expected exactly one additional guard after the cooldown case')
    }
    synthetic.guardHashes = twoGuards

    matrix.push(expectStatus('anonymous-private-rpc', await restStatus(
      `${rest}/rpc/submit_public_gym_manual_quiz_attempt_private`, key, 'POST',
      { p_request: request, p_fingerprint_hash: 'a'.repeat(64), p_nonce_hash: 'b'.repeat(64) },
    ), [401, 403, 404]))
    matrix.push(expectStatus('anonymous-legacy-rpc', await restStatus(
      `${rest}/rpc/submit_public_gym_manual_quiz_attempt`, key, 'POST', { p_attempt: {} },
    ), [401, 403, 404]))
    matrix.push(expectStatus('anonymous-history-read', await restStatus(
      `${rest}/public_gym_manual_quiz_attempts?select=id&limit=1`, key, 'GET',
    ), [401, 403]))
    matrix.push(expectStatus('anonymous-direct-insert', await restStatus(
      `${rest}/public_gym_manual_quiz_attempts`, key, 'POST',
      { nombre_trabajador: workerName, puntuacion: 0, porcentaje: 0, aprobado: false, total_preguntas: 20 },
    ), [401, 403]))
    return synthetic
  } catch (error) {
    error.synthetic = synthetic
    throw error
  }
}

function cleanup(pgEnv, synthetic) {
  if (!synthetic?.attemptId || synthetic.guardHashes.length !== 2) {
    fail('Exact cleanup requires one reconciled attempt id and exactly two captured guard hashes')
  }
  const lines = psql(pgEnv, `
    begin;
    do $$ begin
      if current_user not in ('postgres','postgres.${productionRef}') then
        raise exception 'Production cleanup identity guard failed';
      end if;
    end $$;
    with deleted as (
      delete from public.public_gym_manual_quiz_attempts
      where nombre_trabajador=${qLiteral(synthetic.workerName)}
        and id=${qLiteral(synthetic.attemptId)}::uuid
      returning id
    ) select count(*) from deleted;
    with deleted as (
      delete from public.public_quiz_submission_guards
      where nonce_hash in (${synthetic.guardHashes.map(qLiteral).join(',')})
      returning nonce_hash
    ) select count(*) from deleted;
    commit;
    select jsonb_build_object(
      'attemptRows', (
        select count(*) from public.public_gym_manual_quiz_attempts
        where nombre_trabajador=${qLiteral(synthetic.workerName)}
      ),
      'guardRows', (select count(*) from public.public_quiz_submission_guards),
      'allSyntheticAttempts', (
        select count(*) from public.public_gym_manual_quiz_attempts
        where nombre_trabajador like 'PROD-GATE4C-%'
      ),
      'realAttempts', (
        select count(*) from public.public_gym_manual_quiz_attempts
        where nombre_trabajador not like 'PROD-GATE4C-%'
      )
    );
  `).split(/\r?\n/u).filter(Boolean)
  const deletedCounts = lines.filter((line) => /^\d+$/u.test(line)).map(Number)
  const result = JSON.parse(lines.find((line) => line.startsWith('{')))
  if (deletedCounts[0] !== 1 || deletedCounts[1] !== 2
    || result.attemptRows !== 0 || result.guardRows !== 0
    || result.allSyntheticAttempts !== 0 || result.realAttempts !== 6) {
    fail(`Exact synthetic cleanup failed (attempts=${deletedCounts[0]}; guards=${deletedCounts[1]})`)
  }
  return { deletedAttempts: deletedCounts[0], deletedGuards: deletedCounts[1], ...result }
}

async function inspectLogs(startedAt, forbiddenValues) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) fail('SUPABASE_ACCESS_TOKEN is unavailable for log privacy verification')
  const sql = `select datetime(timestamp) as logged_at, event_message from function_logs where event_message like '%submission_%' or event_message like '%configuration_denied%' or event_message like '%handler_error%' order by timestamp desc limit 100`
  const url = new URL(`https://api.supabase.com/v1/projects/${productionRef}/analytics/endpoints/logs.all`)
  url.searchParams.set('sql', sql)
  url.searchParams.set('iso_timestamp_start', startedAt)
  let rows = []
  let endedAt = new Date().toISOString()
  for (let attempt = 0; attempt < 6; attempt += 1) {
    endedAt = new Date().toISOString()
    url.searchParams.set('iso_timestamp_end', endedAt)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) fail(`Production function log query failed with HTTP ${response.status}`)
    const body = await response.json()
    rows = Array.isArray(body?.result) ? body.result : Array.isArray(body) ? body : []
    if (rows.length >= 3) break
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
  if (rows.length < 3) fail(`Expected at least 3 privacy-safe custom events; found ${rows.length}`)
  const text = JSON.stringify(rows)
  const patterns = [
    /bearer\s/iu, /authorization/iu, /user-agent/iu, /x-forwarded-for/iu,
    /"workerName"/u, /"answers"/u, /\b(?:\d{1,3}\.){3}\d{1,3}\b/u,
  ]
  if (patterns.some((pattern) => pattern.test(text))
    || forbiddenValues.some((value) => value && text.includes(value))) {
    fail('Production custom logs contain prohibited request or identity material')
  }
  return {
    startedAt,
    endedAt,
    matchedEvents: rows.length,
    privacyViolations: 0,
    scope: 'function_logs event_message',
  }
}

async function main() {
  mkdirSync(privateDir, { recursive: true })
  const { publicEnv, pgEnv } = assertInputs()
  const [metadata, frontend, preflight] = await Promise.all([
    managementMetadata(),
    validateFrontend(),
    validatePreflight(),
  ])
  const before = snapshot(pgEnv)
  assertCleanBaseline(before)
  writePrivate(beforePath, `${JSON.stringify(before, null, 2)}\n`)

  console.log('Gate 4C post-release read-only verification: PASS')
  console.log(`Target checks: public=${productionRef}, linked=${productionRef}, private/live=${productionRef}`)
  console.log(`Edge Function: ${metadata.edge.slug}; status=${metadata.edge.status}; version=${metadata.edge.version}`)
  console.log('Edge secret: PUBLIC_QUIZ_FINGERPRINT_PEPPER present by name')
  console.log(`Frontend deployment: ${frontend.deploymentUrl}`)
  console.log(`Domain: HTTP ${frontend.domainStatus}; Edge preflight: HTTP ${preflight.status}`)
  console.log('Baseline: 6 real attempts; 0 synthetic attempts; 0 guards')
  console.log('Repeated migration, secret installation, Edge deploy, and frontend deploy: BLOCKED')
  console.log('Rollback: PREPARED in ignored private storage')
  if (!complete) {
    console.log(`Synthetic execution: NO (pass ${completionFlag} for the authorized completion matrix)`)
    return
  }

  let synthetic = null
  let cleaned = null
  try {
    synthetic = await syntheticMatrix(publicEnv, pgEnv)
    const logs = await inspectLogs(synthetic.startedAt, [
      synthetic.workerName,
      synthetic.nonce,
      synthetic.cooldownNonce,
      publicEnv.VITE_SUPABASE_ANON_KEY,
    ])
    writePrivate(logsPath, `${JSON.stringify(logs, null, 2)}\n`)
    cleaned = cleanup(pgEnv, synthetic)
    const after = snapshot(pgEnv)
    assertCleanBaseline(after)
    assertStableData(after, before)
    writePrivate(afterPath, `${JSON.stringify(after, null, 2)}\n`)
    writePrivate(matrixPath, `${JSON.stringify({
      runId: synthetic.runId,
      workerName: '[redacted]',
      nonce: '[redacted]',
      cooldownNonce: '[redacted]',
      attemptId: '[redacted]',
      guardHashes: '[redacted]',
      startedAt: synthetic.startedAt,
      matrix: synthetic.matrix,
      authoritativeScoring: {
        response: '20/20, 100%, passed',
        persisted: '20/20, 100%, passed',
      },
      cleanup: cleaned,
      edgeFunction: metadata.edge,
      edgeSecretNamePresent: metadata.pepperNamePresent,
      frontendDeployment: frontend,
      preflight,
      logPrivacy: logs,
    }, null, 2)}\n`)

    console.log('Gate 4C production completion: PASS')
    console.log(`Synthetic matrix: ${synthetic.matrix.length}/${synthetic.matrix.length} PASS`)
    console.log('Authoritative scoring: response and persisted row reconciled at 20/20, 100%, passed')
    console.log('Anonymous denials: private RPC, legacy RPC, history, direct insert PASS')
    console.log(`Custom log privacy: PASS (${logs.matchedEvents} matching events; 0 violations)`)
    console.log('Synthetic cleanup: exactly 1 attempt and 2 guards deleted; residue 0/0')
    console.log('Real attempts: 6 before / 6 after')
    console.log('Financial/fiscal data, real data, sequences, and migration history: UNCHANGED')
  } catch (error) {
    synthetic ??= error.synthetic ?? null
    if (!cleaned && synthetic?.attemptId && synthetic.guardHashes.length === 2) {
      try {
        const emergency = cleanup(pgEnv, synthetic)
        console.error(`Emergency exact cleanup: attempts=${emergency.deletedAttempts}; guards=${emergency.deletedGuards}; residue=0/0`)
      } catch (cleanupError) {
        console.error(`Emergency exact cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`)
      }
    }
    throw error
  }
}

try {
  await main()
} catch (error) {
  console.error(`Gate 4C production completion runner: FAIL - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
