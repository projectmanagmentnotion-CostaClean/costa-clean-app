import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
export const CONCURRENCY_OUTCOME = 'PASS_CLEANED'
export const FIXTURE_STATES_V5 = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  TRANSACTION_STARTED: 'TRANSACTION_STARTED',
  COMMIT_REQUESTED: 'COMMIT_REQUESTED',
  COMMIT_CONFIRMED: 'COMMIT_CONFIRMED',
  COMMIT_NOT_APPLIED: 'COMMIT_NOT_APPLIED',
  COMMIT_AMBIGUOUS: 'COMMIT_AMBIGUOUS',
  CLEANUP_STARTED: 'CLEANUP_STARTED',
  CLEANUP_CONFIRMED: 'CLEANUP_CONFIRMED',
  MANUAL_VERIFICATION_REQUIRED: 'MANUAL_VERIFICATION_REQUIRED',
})

export class ConcurrencyV5Error extends Error {
  constructor(code, detail = {}) {
    super(code)
    this.name = 'ConcurrencyV5Error'
    this.code = code
    this.detail = detail
  }
}

function fail(code, detail) {
  throw new ConcurrencyV5Error(code, detail)
}

function psqlExecutable() {
  return process.platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
    : 'psql'
}

function minimalEnvironment(environment) {
  const allowed = [
    'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC',
    'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME',
  ]
  return Object.fromEntries(
    allowed
      .filter((name) => typeof environment[name] === 'string')
      .map((name) => [name, environment[name]]),
  )
}

export function databaseEnvironmentV5(databaseUrl, environment = process.env, options = {}) {
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    fail('V5_DATABASE_TARGET_REJECTED')
  }
  const username = decodeURIComponent(parsed.username)
  const qaDirect = parsed.hostname === `db.${QA_REF}.supabase.co`
    && username === 'postgres'
    && (parsed.port === '' || parsed.port === '5432')
  const qaPooler = /^[a-z0-9-]+[.]pooler[.]supabase[.]com$/u.test(parsed.hostname)
    && username === `postgres.${QA_REF}`
    && ['5432', '6543'].includes(parsed.port)
  const local = options.allowLocal === true
    && ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
    && username === 'postgres'
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.pathname !== '/postgres'
    || (!local && parsed.searchParams.get('sslmode') !== 'require')
    || (!qaDirect && !qaPooler && !local)
    || databaseUrl.includes(PRODUCTION_REF)
    || (!local && !parsed.password)
  ) fail('V5_DATABASE_TARGET_REJECTED')
  const childEnvironment = minimalEnvironment(environment)
  Object.assign(childEnvironment, {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGDATABASE: 'postgres',
    PGUSER: username,
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGSSLMODE: local ? 'disable' : 'require',
  })
  return { childEnvironment, target: local ? 'LOCAL_LOOPBACK' : 'QA_MATCH' }
}

function baseArgs() {
  return ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
}

function runPsql(connection, sql, options = {}) {
  const result = spawnSync(psqlExecutable(), baseArgs(), {
    cwd: options.cwd,
    env: { ...connection.childEnvironment, PGAPPNAME: options.applicationName ?? 'cp3b2a-v5' },
    input: sql,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 60_000,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    fail('V5_POSTGRES_COMMAND_FAILED', {
      stage: options.stage ?? 'postgres',
      exitCode: result.status ?? null,
      timedOut: result.error?.code === 'ETIMEDOUT',
    })
  }
  return String(result.stdout ?? '').trim()
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function startPsql(connection, sql, applicationName) {
  const child = spawn(psqlExecutable(), baseArgs(), {
    env: { ...connection.childEnvironment, PGAPPNAME: applicationName },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdin.setDefaultEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.stdin.write(sql)
  child.stdin.end()
  const completed = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }))
  })
  return { child, completed, output: () => ({ stdout, stderr }) }
}

function startCoordinator(connection, tableName, applicationName) {
  const child = spawn(psqlExecutable(), baseArgs(), {
    env: { ...connection.childEnvironment, PGAPPNAME: applicationName },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdin.setDefaultEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  let stdout = ''
  let stderr = ''
  let readyResolve
  let readyReject
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    const match = stdout.match(/V5_BARRIER_READY:([0-9]+)/u)
    if (match) readyResolve(Number(match[1]))
  })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('error', readyReject)
  child.on('close', (code) => {
    if (!stdout.includes('V5_BARRIER_READY:')) {
      readyReject(new ConcurrencyV5Error('V5_BARRIER_COORDINATOR_FAILED', { exitCode: code }))
    }
  })
  child.stdin.write(
    `begin;\nlock table ${tableName} in share mode;\n`
    + `select 'V5_BARRIER_READY:' || pg_backend_pid();\n`,
  )
  return {
    child,
    ready,
    release() {
      child.stdin.write('commit;\n\\q\n')
      child.stdin.end()
    },
    abort() {
      if (!child.killed) child.kill()
    },
    output: () => ({ stdout, stderr }),
  }
}

async function waitForTwoBlockedWorkers(connection, tableName, applicationNames, coordinatorPid) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const rows = runPsql(connection, String.raw`
      select coalesce(jsonb_agg(jsonb_build_object(
        'pid', a.pid,
        'applicationName', a.application_name,
        'state', a.state,
        'waitEventType', a.wait_event_type,
        'mode', l.mode,
        'granted', l.granted,
        'blockedByCoordinator', ${coordinatorPid} = any(pg_blocking_pids(a.pid))
      ) order by a.application_name), '[]'::jsonb)::text
      from pg_stat_activity a
      join pg_locks l on l.pid = a.pid
      where a.application_name in (
        ${applicationNames.map(sqlLiteral).join(',')}
      )
        and l.relation = ${sqlLiteral(tableName)}::regclass
        and l.mode = 'RowExclusiveLock'
        and not l.granted;
    `, { stage: 'barrier_observer' })
    const evidence = JSON.parse(rows || '[]')
    if (
      evidence.length === 2
      && new Set(evidence.map((row) => row.pid)).size === 2
      && evidence.every((row) => (
        row.state === 'active'
        && row.waitEventType === 'Lock'
        && row.mode === 'RowExclusiveLock'
        && row.granted === false
        && row.blockedByCoordinator === true
      ))
    ) return evidence
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  fail('V5_REAL_BARRIER_NOT_PROVEN')
}

function workerSql({ userId, kind, clientId, propertyId, payload, key }) {
  const rpc = kind === 'profile'
    ? `public.portal_submit_profile_change_request_v2(`
      + `${sqlLiteral(clientId)},${sqlLiteral(JSON.stringify(payload))}::jsonb,`
      + `${sqlLiteral(key)}::uuid)`
    : `public.portal_submit_property_change_request_v2(`
      + `${sqlLiteral(clientId)},${sqlLiteral(propertyId)},`
      + `${sqlLiteral(JSON.stringify(payload))}::jsonb,${sqlLiteral(key)}::uuid)`
  return `begin;\nset local statement_timeout='45s';\nset local lock_timeout='45s';\n`
    + `set local role authenticated;\n`
    + `select set_config('request.jwt.claim.sub',${sqlLiteral(userId)},true);\n`
    + `select 'V5_RECEIPT:' || (${rpc})::text;\ncommit;\n`
}

export async function awaitWorkersV5(workers, timeoutMs = 50_000) {
  let timer
  try {
    return await Promise.race([
      Promise.all(workers.map((worker) => worker.completed)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          for (const worker of workers) {
            if (!worker.child.killed) worker.child.kill()
          }
          reject(new ConcurrencyV5Error('V5_WORKER_COMPLETION_TIMEOUT'))
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function parseWorker(result) {
  if (result.code === 0) {
    const receipts = result.stdout
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('V5_RECEIPT:'))
    if (receipts.length !== 1) fail('V5_WORKER_RECEIPT_REJECTED')
    return { status: 'receipt', receipt: JSON.parse(receipts[0].slice(11)) }
  }
  if (/23505/iu.test(result.stderr) && /idempotency_conflict/iu.test(result.stderr)) {
    return { status: 'conflict', sqlState: '23505' }
  }
  if (/40P01|deadlock/iu.test(result.stderr)) fail('V5_CONCURRENCY_DEADLOCK')
  fail('V5_WORKER_INTERNAL_ERROR', { exitCode: result.code })
}

export function validateRaceEvidenceV5({ mode, workers, requestCount, auditCount, rateDelta }) {
  if (requestCount !== 1) fail('V5_REQUEST_CARDINALITY_REJECTED')
  if (auditCount !== 1) fail('V5_AUDIT_CARDINALITY_REJECTED')
  if (rateDelta !== 1) fail('V5_RATE_DOUBLE_CONSUMPTION')
  if (mode === 'retry') {
    if (workers.some((worker) => worker.status !== 'receipt')) {
      fail('V5_RETRY_WORKER_REJECTED')
    }
    const [first, second] = workers.map((worker) => JSON.stringify(worker.receipt))
    if (first !== second) fail('V5_AUTHORITATIVE_RECEIPT_MISMATCH')
  } else {
    if (
      workers.filter((worker) => worker.status === 'receipt').length !== 1
      || workers.filter(
        (worker) => worker.status === 'conflict' && worker.sqlState === '23505',
      ).length !== 1
    ) fail('V5_DETERMINISTIC_CONFLICT_REJECTED')
  }
  return true
}

export function annotateCleanupFailureV5(cleanupError, primaryError = null) {
  const target = primaryError ?? cleanupError
  target.detail = {
    ...(target.detail ?? {}),
    recovery: 'MANUAL_VERIFICATION_REQUIRED',
  }
  return target
}

function rateCount(connection, action, subjectHash) {
  const output = runPsql(connection, `
    select coalesce(sum(request_count),0)::integer
    from public.client_portal_rate_limits
    where action=${sqlLiteral(action)} and subject_hash=${sqlLiteral(subjectHash)};
  `, { stage: 'rate_count' })
  return Number(output)
}

async function runRace(connection, fixture, spec) {
  const tableName = spec.kind === 'profile'
    ? 'public.client_portal_profile_change_requests'
    : 'public.client_portal_property_change_requests'
  const action = `${spec.kind}_change_v2`
  const subjectHash = createHash('sha256')
    .update(`${action}:${fixture.userId}:${fixture.clientId}`)
    .digest('hex')
  const beforeRate = rateCount(connection, action, subjectHash)
  const suffix = `${spec.kind}-${spec.mode}-${fixture.runId.slice(-6)}`.toLowerCase()
  const applicationNames = [`cp3b2a-v5-a-${suffix}`, `cp3b2a-v5-b-${suffix}`]
  const coordinator = startCoordinator(
    connection,
    tableName,
    `cp3b2a-v5-barrier-${suffix}`,
  )
  const workers = []
  try {
    const coordinatorPid = await Promise.race([
      coordinator.ready,
      new Promise((_, reject) => setTimeout(
        () => reject(new ConcurrencyV5Error('V5_BARRIER_COORDINATOR_TIMEOUT')),
        10_000,
      )),
    ])
    workers.push(
      startPsql(connection, workerSql({
        ...fixture,
        kind: spec.kind,
        payload: spec.payloads[0],
        key: spec.key,
      }), applicationNames[0]),
      startPsql(connection, workerSql({
        ...fixture,
        kind: spec.kind,
        payload: spec.payloads[1],
        key: spec.key,
      }), applicationNames[1]),
    )
    const barrierEvidence = await waitForTwoBlockedWorkers(
      connection,
      tableName,
      applicationNames,
      coordinatorPid,
    )
    coordinator.release()
    const results = await awaitWorkersV5(workers)
    const parsed = results.map(parseWorker)
    const requestTable = spec.kind === 'profile'
      ? 'public.client_portal_profile_change_requests'
      : 'public.client_portal_property_change_requests'
    const requestCount = Number(runPsql(connection, `
      select count(*) from ${requestTable}
      where requested_by=${sqlLiteral(fixture.userId)}::uuid
        and idempotency_key=${sqlLiteral(spec.key)}::uuid;
    `, { stage: 'race_request_count' }))
    const auditCount = Number(runPsql(connection, `
      select count(*) from public.client_portal_audit_events
      where actor_user_id=${sqlLiteral(fixture.userId)}::uuid
        and client_id=${sqlLiteral(fixture.clientId)}
        and event_type=${sqlLiteral(`${spec.kind}_change_requested`)}
        and target_id in (
          select id from ${requestTable}
          where requested_by=${sqlLiteral(fixture.userId)}::uuid
            and idempotency_key=${sqlLiteral(spec.key)}::uuid
        );
    `, { stage: 'race_audit_count' }))
    const rateDelta = rateCount(connection, action, subjectHash) - beforeRate
    validateRaceEvidenceV5({
      mode: spec.mode,
      workers: parsed,
      requestCount,
      auditCount,
      rateDelta,
    })
    if (spec.mode === 'conflict') {
      const stored = JSON.parse(runPsql(connection, `
        select proposed_changes::text from ${requestTable}
        where requested_by=${sqlLiteral(fixture.userId)}::uuid
          and idempotency_key=${sqlLiteral(spec.key)}::uuid;
      `, { stage: 'conflict_payload' }))
      const candidates = spec.payloads.map((payload) => JSON.stringify(payload))
      if (!candidates.includes(JSON.stringify(stored))) {
        fail('V5_CONFLICT_PAYLOAD_MIXED')
      }
    }
    return {
      kind: spec.kind,
      mode: spec.mode,
      separateBackendCount: 2,
      barrierWaiters: barrierEvidence.length,
      requestCount,
      auditCount,
      rateDelta,
      authoritativeReceipt: spec.mode === 'retry',
      deterministicConflict: spec.mode === 'conflict',
    }
  } finally {
    coordinator.abort()
    for (const worker of workers) {
      if (!worker.child.killed) worker.child.kill()
    }
  }
}

function globalState(connection, stage) {
  const output = runPsql(connection, String.raw`
    select jsonb_build_object(
      'authCount',(select count(*) from auth.users),
      'authDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from auth.users r),
      'clientCount',(select count(*) from public.clients),
      'clientDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from public.clients r),
      'propertyCount',(select count(*) from public.properties),
      'propertyDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from public.properties r),
      'membershipCount',(select count(*) from public.client_portal_memberships),
      'membershipDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from public.client_portal_memberships r),
      'profileCount',(select count(*) from public.client_portal_profile_change_requests),
      'profileDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from public.client_portal_profile_change_requests r),
      'propertyRequestCount',(select count(*) from public.client_portal_property_change_requests),
      'propertyRequestDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from public.client_portal_property_change_requests r),
      'auditCount',(select count(*) from public.client_portal_audit_events),
      'auditDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.id),'')) from public.client_portal_audit_events r),
      'rateCount',(select count(*) from public.client_portal_rate_limits),
      'rateDigest',(select md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.action,r.subject_hash,r.window_started_at),'')) from public.client_portal_rate_limits r)
    )::text;
  `, { stage })
  return JSON.parse(output)
}

function assertStateEqual(before, after) {
  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) fail('V5_SYNTHETIC_RESIDUE', { key })
  }
}

export function createFixtureInventoryV5(runId) {
  return {
    runId,
    userId: randomUUID(),
    membershipId: randomUUID(),
    clientId: `${runId}-CLIENT`,
    propertyId: `${runId}-PROPERTY`,
    state: FIXTURE_STATES_V5.NOT_STARTED,
    commitTransportFailed: false,
  }
}

export function privateFixtureInventoryV5(fixture) {
  return Object.freeze({
    runId: fixture.runId,
    userId: fixture.userId,
    membershipId: fixture.membershipId,
    clientId: fixture.clientId,
    propertyId: fixture.propertyId,
    state: fixture.state,
  })
}

function fixtureInventoryState(connection, fixture, stage) {
  const profileHash = createHash('sha256')
    .update(`profile_change_v2:${fixture.userId}:${fixture.clientId}`).digest('hex')
  const propertyHash = createHash('sha256')
    .update(`property_change_v2:${fixture.userId}:${fixture.clientId}`).digest('hex')
  return JSON.parse(runPsql(connection, `
    select jsonb_build_object(
      'authUsers', (select count(*) from auth.users
        where id=${sqlLiteral(fixture.userId)}::uuid
          and email=${sqlLiteral(`${fixture.runId.toLowerCase()}-concurrency@example.invalid`)}),
      'clients', (select count(*) from public.clients
        where id=${sqlLiteral(fixture.clientId)}),
      'properties', (select count(*) from public.properties
        where id=${sqlLiteral(fixture.propertyId)}
          and client_id=${sqlLiteral(fixture.clientId)}),
      'memberships', (select count(*) from public.client_portal_memberships
        where id=${sqlLiteral(fixture.membershipId)}::uuid
          and user_id=${sqlLiteral(fixture.userId)}::uuid
          and client_id=${sqlLiteral(fixture.clientId)}),
      'profileRequests', (select count(*) from public.client_portal_profile_change_requests
        where requested_by=${sqlLiteral(fixture.userId)}::uuid
          and client_id=${sqlLiteral(fixture.clientId)}),
      'propertyRequests', (select count(*) from public.client_portal_property_change_requests
        where requested_by=${sqlLiteral(fixture.userId)}::uuid
          and client_id=${sqlLiteral(fixture.clientId)}),
      'auditRows', (select count(*) from public.client_portal_audit_events
        where actor_user_id=${sqlLiteral(fixture.userId)}::uuid
          and client_id=${sqlLiteral(fixture.clientId)}),
      'unexpectedRows',
        (select count(*) from auth.users
          where email like ${sqlLiteral(`${fixture.runId.toLowerCase()}-%@example.invalid`)}
            and id<>${sqlLiteral(fixture.userId)}::uuid)
        +(select count(*) from public.clients
          where id like ${sqlLiteral(`${fixture.runId}-%`)}
            and id<>${sqlLiteral(fixture.clientId)})
        +(select count(*) from public.properties
          where id like ${sqlLiteral(`${fixture.runId}-%`)}
            and id<>${sqlLiteral(fixture.propertyId)})
        +(select count(*) from public.client_portal_memberships
          where (
            client_id like ${sqlLiteral(`${fixture.runId}-%`)}
            or user_id=${sqlLiteral(fixture.userId)}::uuid
          )
            and id<>${sqlLiteral(fixture.membershipId)}::uuid)
        +(select count(*) from public.client_portal_profile_change_requests
          where client_id like ${sqlLiteral(`${fixture.runId}-%`)}
            or requested_by=${sqlLiteral(fixture.userId)}::uuid)
        +(select count(*) from public.client_portal_property_change_requests
          where client_id like ${sqlLiteral(`${fixture.runId}-%`)}
            or requested_by=${sqlLiteral(fixture.userId)}::uuid)
        +(select count(*) from public.client_portal_audit_events
          where client_id like ${sqlLiteral(`${fixture.runId}-%`)}
            or actor_user_id=${sqlLiteral(fixture.userId)}::uuid)
        +(select count(*) from public.client_portal_rate_limits
          where subject_hash in (
            ${sqlLiteral(profileHash)},
            ${sqlLiteral(propertyHash)}
          ))
    )::text;
  `, { stage }))
}

export function classifyFixtureObservationV5(observation) {
  const expectedKeys = [
    'authUsers',
    'clients',
    'properties',
    'memberships',
    'profileRequests',
    'propertyRequests',
    'auditRows',
    'unexpectedRows',
  ]
  const complete = observation !== null
    && typeof observation === 'object'
    && !Array.isArray(observation)
    && Object.keys(observation).length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(observation, key))
  const exact = observation?.authUsers === 1
    && observation?.clients === 1
    && observation?.properties === 1
    && observation?.memberships === 1
    && observation?.profileRequests === 0
    && observation?.propertyRequests === 0
    && observation?.auditRows === 0
    && observation?.unexpectedRows === 0
  if (complete && exact) return FIXTURE_STATES_V5.COMMIT_CONFIRMED
  const absent = complete
    && expectedKeys.every((key) => observation[key] === 0)
  if (absent) return FIXTURE_STATES_V5.COMMIT_NOT_APPLIED
  return FIXTURE_STATES_V5.COMMIT_AMBIGUOUS
}

export function resolveFixtureCommitV5(fixture, observe) {
  let observation
  try {
    observation = observe()
  } catch (error) {
    fixture.state = FIXTURE_STATES_V5.MANUAL_VERIFICATION_REQUIRED
    fail('V5_FIXTURE_COMMIT_AMBIGUOUS', {
      recovery: 'MANUAL_VERIFICATION_REQUIRED',
      commitState: FIXTURE_STATES_V5.COMMIT_AMBIGUOUS,
      observer: 'INCONCLUSIVE',
      cause: error instanceof Error ? error.message : 'observer_failed',
    })
  }
  const state = classifyFixtureObservationV5(observation)
  fixture.state = state
  if (state === FIXTURE_STATES_V5.COMMIT_CONFIRMED) return fixture
  if (state === FIXTURE_STATES_V5.COMMIT_NOT_APPLIED) {
    fail('V5_FIXTURE_COMMIT_NOT_APPLIED', {
      commitState: state,
      observer: 'ZERO_FIXTURES',
    })
  }
  fixture.state = FIXTURE_STATES_V5.MANUAL_VERIFICATION_REQUIRED
  fail('V5_FIXTURE_COMMIT_AMBIGUOUS', {
    recovery: 'MANUAL_VERIFICATION_REQUIRED',
    commitState: FIXTURE_STATES_V5.COMMIT_AMBIGUOUS,
    observer: 'PARTIAL_OR_UNEXPECTED',
  })
}

function createFixture(connection, fixture, onStage, observeCommittedFixture) {
  fixture.state = FIXTURE_STATES_V5.TRANSACTION_STARTED
  onStage('fixture_transaction_started')
  Number(runPsql(connection, 'select pg_backend_pid();', {
    stage: 'fixture_observer_available',
  }))
  const collision = fixtureInventoryState(
    connection,
    fixture,
    'fixture_collision_precheck',
  )
  if (
    classifyFixtureObservationV5(collision)
    !== FIXTURE_STATES_V5.COMMIT_NOT_APPLIED
  ) {
    fixture.state = FIXTURE_STATES_V5.MANUAL_VERIFICATION_REQUIRED
    fail('V5_FIXTURE_COLLISION_REJECTED', {
      recovery: 'MANUAL_VERIFICATION_REQUIRED',
      commitState: FIXTURE_STATES_V5.TRANSACTION_STARTED,
      observer: 'PREEXISTING_OR_PARTIAL_FIXTURE',
    })
  }
  fixture.state = FIXTURE_STATES_V5.COMMIT_REQUESTED
  onStage('fixture_commit_requested')
  let transportError = null
  try {
  runPsql(connection, `
    begin;
    set local session_replication_role=replica;
    insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
    values (
      ${sqlLiteral(fixture.userId)}::uuid,
      ${sqlLiteral(`${fixture.runId.toLowerCase()}-concurrency@example.invalid`)},
      clock_timestamp(),clock_timestamp(),clock_timestamp()
    );
    set local session_replication_role=origin;
    insert into public.clients(
      id,full_name,phone,email,tax_id,billing_address,status,display_code
    ) values (
      ${sqlLiteral(fixture.clientId)},'QA Synthetic V5 Concurrency','+34900000421',
      ${sqlLiteral(`${fixture.runId.toLowerCase()}-client@example.invalid`)},
      ${sqlLiteral(`${fixture.runId}-TAX`)},'QA Synthetic V5 Address','active',
      ${sqlLiteral(fixture.clientId)}
    );
    insert into public.properties(
      id,client_id,name,property_type,address,city,postal_code,status,display_code
    ) values (
      ${sqlLiteral(fixture.propertyId)},${sqlLiteral(fixture.clientId)},
      'QA Synthetic V5 Property','home','QA Synthetic V5 Address',
      'Barcelona','08001','active',${sqlLiteral(fixture.propertyId)}
    );
    insert into public.client_portal_memberships(
      id,user_id,client_id,role,status
    ) values (
      ${sqlLiteral(fixture.membershipId)}::uuid,
      ${sqlLiteral(fixture.userId)}::uuid,
      ${sqlLiteral(fixture.clientId)},'client_admin','active'
    );
    commit;
  `, { stage: 'fixture_create' })
  } catch (error) {
    transportError = error
    fixture.commitTransportFailed = true
  }
  const confirmed = resolveFixtureCommitV5(
    fixture,
    () => observeCommittedFixture({
      fixture: privateFixtureInventoryV5(fixture),
      observe: () => fixtureInventoryState(
        connection,
        fixture,
        'fixture_commit_observer',
      ),
    }),
  )
  onStage('fixture_commit_confirmed_by_observer')
  if (transportError) confirmed.commitTransportFailureCode = transportError.code ?? 'PSQL_FAILURE'
  return confirmed
}

function cleanupFixture(connection, fixture, onStage) {
  if (fixture.state !== FIXTURE_STATES_V5.COMMIT_CONFIRMED) {
    fail('V5_FIXTURE_CLEANUP_STATE_REJECTED', {
      recovery: 'MANUAL_VERIFICATION_REQUIRED',
      commitState: fixture.state,
    })
  }
  fixture.state = FIXTURE_STATES_V5.CLEANUP_STARTED
  onStage('fixture_cleanup')
  const profileHash = createHash('sha256')
    .update(`profile_change_v2:${fixture.userId}:${fixture.clientId}`).digest('hex')
  const propertyHash = createHash('sha256')
    .update(`property_change_v2:${fixture.userId}:${fixture.clientId}`).digest('hex')
  runPsql(connection, `
    begin;
    delete from public.client_portal_audit_events
      where actor_user_id=${sqlLiteral(fixture.userId)}::uuid
        and client_id=${sqlLiteral(fixture.clientId)};
    delete from public.client_portal_rate_limits
      where (action='profile_change_v2' and subject_hash=${sqlLiteral(profileHash)})
         or (action='property_change_v2' and subject_hash=${sqlLiteral(propertyHash)});
    delete from public.client_portal_property_change_requests
      where requested_by=${sqlLiteral(fixture.userId)}::uuid
        and client_id=${sqlLiteral(fixture.clientId)};
    delete from public.client_portal_profile_change_requests
      where requested_by=${sqlLiteral(fixture.userId)}::uuid
        and client_id=${sqlLiteral(fixture.clientId)};
    delete from public.client_portal_memberships
      where id=${sqlLiteral(fixture.membershipId)}::uuid
        and user_id=${sqlLiteral(fixture.userId)}::uuid
        and client_id=${sqlLiteral(fixture.clientId)};
    delete from public.properties
      where id=${sqlLiteral(fixture.propertyId)}
        and client_id=${sqlLiteral(fixture.clientId)};
    delete from public.clients where id=${sqlLiteral(fixture.clientId)};
    set local session_replication_role=replica;
    delete from auth.users
      where id=${sqlLiteral(fixture.userId)}::uuid
        and email=${sqlLiteral(`${fixture.runId.toLowerCase()}-concurrency@example.invalid`)};
    set local session_replication_role=origin;
    commit;
  `, { stage: 'fixture_cleanup' })
  const observation = fixtureInventoryState(
    connection,
    fixture,
    'fixture_cleanup_observer',
  )
  if (classifyFixtureObservationV5(observation) !== FIXTURE_STATES_V5.COMMIT_NOT_APPLIED) {
    fixture.state = FIXTURE_STATES_V5.MANUAL_VERIFICATION_REQUIRED
    fail('V5_FIXTURE_CLEANUP_UNVERIFIED', {
      recovery: 'MANUAL_VERIFICATION_REQUIRED',
    })
  }
  fixture.state = FIXTURE_STATES_V5.CLEANUP_CONFIRMED
  onStage('fixture_cleanup_confirmed')
}

export async function runConcurrencyV5({
  databaseUrl,
  environment = process.env,
  runId,
  allowLocal = false,
  onStage = () => {},
  onInventory = () => {},
  observeCommittedFixture = ({ observe }) => observe(),
} = {}) {
  if (!/^CP3B2A-V5-[A-Z0-9]{12}$/u.test(runId ?? '')) {
    fail('V5_RUN_ID_REJECTED')
  }
  const connection = databaseEnvironmentV5(databaseUrl, environment, { allowLocal })
  const prestate = globalState(connection, 'concurrency_prestate')
  const expiredRateRows = Number(runPsql(connection, `
    select count(*) from public.client_portal_rate_limits
    where expires_at <= clock_timestamp();
  `, { stage: 'expired_rate_precheck' }))
  if (expiredRateRows !== 0) fail('V5_EXPIRED_RATE_ROWS_REJECTED')
  const fixture = createFixtureInventoryV5(runId)
  onInventory(privateFixtureInventoryV5(fixture))
  let primaryError
  let result
  try {
    createFixture(connection, fixture, onStage, observeCommittedFixture)
    onStage('concurrent_matrix')
    const races = []
    races.push(await runRace(connection, fixture, {
      kind: 'profile',
      mode: 'retry',
      key: randomUUID(),
      payloads: [
        { fullName: 'QA Synthetic V5 Profile Retry' },
        { fullName: 'QA Synthetic V5 Profile Retry' },
      ],
    }))
    races.push(await runRace(connection, fixture, {
      kind: 'profile',
      mode: 'conflict',
      key: randomUUID(),
      payloads: [
        { phone: '+34900000431' },
        { phone: '+34900000432' },
      ],
    }))
    races.push(await runRace(connection, fixture, {
      kind: 'property',
      mode: 'retry',
      key: randomUUID(),
      payloads: [
        { city: 'QA Synthetic V5 Girona' },
        { city: 'QA Synthetic V5 Girona' },
      ],
    }))
    races.push(await runRace(connection, fixture, {
      kind: 'property',
      mode: 'conflict',
      key: randomUUID(),
      payloads: [
        { postalCode: '08031' },
        { postalCode: '08032' },
      ],
    }))
    result = {
      version: 5,
      kind: 'concurrent_matrix',
      result: 'PASS',
      cleanup: CONCURRENCY_OUTCOME,
      target: connection.target,
      realSeparateSessions: true,
      barrier: 'TWO_UNGRANTED_ROW_EXCLUSIVE_LOCKS',
      races,
      requestDuplicates: 0,
      auditDuplicates: 0,
      rateLimitDoubleConsumption: 0,
      automaticRetries: 0,
      assertionIds: [
        'concurrent.profile.retry',
        'concurrent.profile.conflict',
        'concurrent.property.retry',
        'concurrent.property.conflict',
        'concurrent.separate_sessions',
        'concurrent.independent_observer',
        'concurrent.real_barrier',
        'residue.synthetic_zero',
        'residue.auth_zero',
        'residue.canonical_zero',
      ],
    }
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    if (
      fixture.state === FIXTURE_STATES_V5.COMMIT_CONFIRMED
      || fixture.state === FIXTURE_STATES_V5.CLEANUP_STARTED
    ) {
      try {
        cleanupFixture(connection, fixture, onStage)
        assertStateEqual(prestate, globalState(connection, 'concurrency_final_state'))
      } catch (cleanupError) {
        const failure = annotateCleanupFailureV5(cleanupError, primaryError)
        if (!primaryError) throw failure
      }
    }
  }
  return {
    ...result,
    fixtureState: fixture.state,
  }
}
