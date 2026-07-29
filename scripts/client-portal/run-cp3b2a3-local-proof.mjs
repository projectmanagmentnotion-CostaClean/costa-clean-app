import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DiagnosticError,
  applyFailureEnvelopeUpdateV3,
  executeV3TestHarness,
  parseEnvelopeV3,
  parseSingleJsonV3,
  validateDetailedPostcheckV3,
} from './run-cp3b2a-qa-v3.mjs'
import {
  validatePoststateV2,
  validatePrestateV2,
  verifyPackageManifestV2,
} from './run-cp3b2a-qa-v2.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptsDir = path.join(repoRoot, 'scripts', 'client-portal')
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp3b2a3-local-proof-latest.json',
)
const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const baselineOrder = [
  '20260721_qa_baseline_schema.sql',
  '20260707_fix_same_number_invoice_update_gap.sql',
  '20260721_rls_clients_properties_jobs_write_fix.sql',
  '20260722_close_anon_read_policies_qa_verified.sql',
  '20260722171428_public_quiz_providerless_abuse_protection.sql',
]
const migrationPath = path.join(
  migrationsDir,
  '20260728160000_portal_reviewed_change_contract.sql',
)
const cp2bMigrationPath = path.join(
  migrationsDir,
  '20260723160000_client_portal_security_boundary.sql',
)
const cp3b0MigrationPath = path.join(
  migrationsDir,
  '20260728120000_portal_self_access_context.sql',
)
const precheckPath = path.join(scriptsDir, 'cp3b2a_qa_precheck_v3.sql')
const frozenPostcheckPath = path.join(scriptsDir, 'cp3b2a_qa_postcheck_v2.sql')
const postcheckPath = path.join(scriptsDir, 'cp3b2a_qa_postcheck_v3.sql')
const matrixPath = path.join(scriptsDir, 'cp3b2a_qa_matrix_v3.sql')
const rollbackPath = path.join(scriptsDir, 'cp3b2a_qa_rollback_v3.sql')

function fail(code) {
  throw new Error(code)
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 180_000,
    maxBuffer: 60 * 1024 * 1024,
    ...options,
  })
  if (result.error || result.status !== 0) {
    const detail = options.redactFailure
      ? 'redacted'
      : [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(
      `command_failed:${options.label ?? path.basename(executable)}:`
      + `status_${result.status ?? 'none'}:error_${result.error?.code ?? 'none'}:${detail}`,
    )
  }
  return (result.stdout ?? '').trim()
}

function assertLocalOnly() {
  const remoteEnvironment = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|PROJECT_REF)/iu.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')
  if (remoteEnvironment.includes(QA_REF) || remoteEnvironment.includes(PRODUCTION_REF)) {
    fail('remote_environment_rejected')
  }
}

function postgresTools() {
  const bin = process.env.CP3B2A_PG_BIN
    ?? (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : '')
  const executable = (name) => process.platform === 'win32'
    ? path.join(bin, `${name}.exe`)
    : name
  const tools = {
    initdb: executable('initdb'),
    pgCtl: executable('pg_ctl'),
    psql: executable('psql'),
  }
  if (process.platform === 'win32' && !Object.values(tools).every(existsSync)) {
    fail('postgresql_17_tools_unavailable')
  }
  return tools
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function connectionArgs(port) {
  return [
    '-X',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ]
}

function query(psql, port, sql) {
  return run(psql, [...connectionArgs(port), '-Atq'], { input: sql })
}

function applyFile(psql, port, filePath, variables = {}, expectFailure = false) {
  const args = [...connectionArgs(port), '-q']
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  const result = spawnSync(psql, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 60 * 1024 * 1024,
  })
  if (expectFailure) {
    if (result.status === 0) fail('expected_sql_failure_missing')
    return 'EXPECTED_FAILURE'
  }
  if (result.error || result.status !== 0) {
    fail(`sql_file_failed:${path.basename(filePath)}`)
  }
  return (result.stdout ?? '').trim()
}

function captureFile(psql, port, filePath, variables = {}) {
  const args = [...connectionArgs(port), '-Atq']
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  return run(psql, args)
}

function setupSql() {
  return String.raw`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz,
      created_at timestamptz default clock_timestamp(),
      updated_at timestamptz default clock_timestamp()
    );
    create function auth.uid()
    returns uuid language sql stable set search_path=pg_catalog
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '10000000-0000-4000-8000-000000000001',
      'cp3b2a2-staff@example.invalid',
      clock_timestamp()
    );
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id) on delete cascade,
      name text not null, owner uuid
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on storage.objects, storage.buckets to service_role;
    insert into storage.buckets(id,name,public)
    values ('expense-receipts','expense-receipts',false);
    create policy "Allow authenticated read expense receipts"
    on storage.objects for select to authenticated
    using (bucket_id='expense-receipts');
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key, name text not null, statements text[]
    );
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values ('20260700000000','synthetic_local_baseline',array[]::text[]);
  `
}

function historicalRowsSql() {
  return String.raw`
    set session_replication_role=replica;
    insert into public.clients(
      id,full_name,phone,email,tax_id,billing_address,status,display_code
    ) values (
      'CP3B2A-V3-HIST-CLIENT','Historical Synthetic','+34900000000',
      'historical@example.invalid','HIST-TAX','Historical','active','HIST-CLIENT'
    );
    insert into public.properties(
      id,client_id,name,property_type,address,city,postal_code,status,display_code
    ) values (
      'CP3B2A-V3-HIST-PROPERTY','CP3B2A-V3-HIST-CLIENT','Historical Property',
      'home','Historical','Barcelona','08000','active','HIST-PROPERTY'
    );
    insert into public.client_portal_profile_change_requests(
      client_id,requested_by,proposed_changes
    ) values (
      'CP3B2A-V3-HIST-CLIENT','10000000-0000-4000-8000-000000000001',
      '{"phone":"+34900000001"}'
    );
    insert into public.client_portal_property_change_requests(
      client_id,property_id,requested_by,proposed_changes
    ) values (
      'CP3B2A-V3-HIST-CLIENT','CP3B2A-V3-HIST-PROPERTY',
      '10000000-0000-4000-8000-000000000001','{"city":"Badalona"}'
    );
    set session_replication_role=origin;
  `
}

function assertPrestateEqual(prestate, restored) {
  for (const key of [
    'profileRows',
    'propertyRows',
    'profileDigest',
    'propertyDigest',
    'canonicalDigest',
    'financialSequenceDigest',
    'authUserCount',
    'authDigest',
    'tableGrantDigest',
    'unaffectedPolicyDigest',
    'unaffectedFunctionDigest',
    'migrationHistoryCount',
    'migrationHistoryDigest',
  ]) {
    if (restored[key] !== prestate[key]) fail(`recovery_drift:${key}`)
  }
}

async function main() {
  assertLocalOnly()
  verifyPackageManifestV2()
  const v2Source = readFileSync(
    path.join(scriptsDir, 'run-cp3b2a-qa-v2.mjs'),
    'utf8',
  )
  if (
    !v2Source.includes('} catch {')
    || !v2Source.includes("fail('qa_application_failed_recovery_completed')")
    || v2Source.includes('originalFailure')
  ) fail('v2_root_cause_not_reproduced')

  run(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      'scripts/client-portal/cp3b2aQaApplicationV3.test.mjs',
      '--config',
      'vitest.config.mjs',
    ],
    { timeout: 120_000, redactFailure: true, label: 'v3-tests' },
  )

  const tools = postgresTools()
  const workDir = mkdtempSync(path.join(tmpdir(), 'costa-clean-cp3b2a3-'))
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const cp2bApplyPath = path.join(workDir, 'cp2b-apply.sql')
  const port = await reservePort()
  const runId = `CP3B2A-V3-${randomBytes(6).toString('hex').toUpperCase()}`
  let started = false
  const result = {
    gate: 'CP-3B.2A.3',
    postgresMajor: null,
    confirmedDiagnosticDefect: 'V2_RUNNER_OBSERVABILITY_DEFECT',
    originalRemoteTrigger: 'UNKNOWN_PENDING_V3_EXECUTION',
    historicalRows: 2,
    postcheckV3: 'NOT_RUN',
    boundaryAdversarial: 'NOT_RUN',
    aclAdversarial: 'NOT_RUN',
    matrixV3: 'NOT_RUN',
    rollbackWithV2Row: 'NOT_RUN',
    recoveryV3: 'NOT_RUN',
    reapplyV3: 'NOT_RUN',
    injectedFailure: 'NOT_RUN',
    auditRateResidue: 'NOT_RUN',
    automaticRetries: 0,
    remoteContacts: 0,
    result: 'FAIL',
  }
  try {
    run(tools.initdb, [
      '-D',
      clusterDir,
      '--username=postgres',
      '--auth=trust',
      '--encoding=UTF8',
      '--no-locale',
    ])
    run(tools.pgCtl, [
      '-D',
      clusterDir,
      '-l',
      logPath,
      '-o',
      `-F -p ${port} -h 127.0.0.1`,
      '-w',
      'start',
    ], { stdio: 'ignore' })
    started = true
    result.postgresMajor = Number(query(
      tools.psql,
      port,
      "select current_setting('server_version_num')::integer/10000",
    ))
    if (result.postgresMajor !== 17) fail('postgres_major_rejected')
    query(tools.psql, port, setupSql())
    for (const migration of baselineOrder) {
      applyFile(tools.psql, port, path.join(migrationsDir, migration))
    }
    query(tools.psql, port, `
      grant all on all tables in schema public to service_role;
      grant usage,select on all sequences in schema public to service_role;
    `)
    writeFileSync(cp2bApplyPath, [
      'create temp table cp2a_bootstrap_staff (',
      'user_id uuid primary key, role text not null);',
      "insert into cp2a_bootstrap_staff values ('10000000-0000-4000-8000-000000000001','owner');",
      readFileSync(cp2bMigrationPath, 'utf8'),
    ].join('\n'), 'utf8')
    applyFile(tools.psql, port, cp2bApplyPath)
    applyFile(tools.psql, port, cp3b0MigrationPath)
    query(tools.psql, port, historicalRowsSql())

    const variables = {
      project_ref: QA_REF,
      run_id: runId,
      v2_run_id: runId.replace('CP3B2A-V3-', 'CP3B2A-V2-'),
    }
    const prestate = parseSingleJsonV3(captureFile(
      tools.psql,
      port,
      precheckPath,
      variables,
    ))
    validatePrestateV2(prestate)
    if (prestate.profileRows !== 1 || prestate.propertyRows !== 1) {
      fail('historical_rows_missing')
    }

    applyFile(tools.psql, port, migrationPath)
    validatePoststateV2(
      prestate,
      parseSingleJsonV3(captureFile(
        tools.psql,
        port,
        frozenPostcheckPath,
      )),
    )
    try {
      validateDetailedPostcheckV3(parseEnvelopeV3(
        captureFile(tools.psql, port, postcheckPath),
        'postcheck',
      ))
    } catch (error) {
      fail(`postcheck_v3_failed:${error?.detail?.assertion ?? 'unknown'}`)
    }
    result.postcheckV3 = 'PASS'

    query(tools.psql, port, String.raw`
      create policy "V3 proof rejects extra permissive policy"
      on public.client_portal_profile_change_requests
      for select to authenticated
      using (true);
    `)
    let extraPolicyFailure
    try {
      validateDetailedPostcheckV3(parseEnvelopeV3(
        captureFile(tools.psql, port, postcheckPath),
        'postcheck',
      ))
    } catch (error) {
      extraPolicyFailure = error
    }
    if (
      extraPolicyFailure?.detail?.assertion !== 'V3-POLICY-COUNT'
      || !JSON.stringify(extraPolicyFailure?.detail?.actual ?? '')
        .includes('V3 proof rejects extra permissive policy')
    ) fail('extra_permissive_policy_not_rejected')
    query(tools.psql, port, String.raw`
      drop policy "V3 proof rejects extra permissive policy"
      on public.client_portal_profile_change_requests;
    `)
    result.boundaryAdversarial = 'PASS_REJECTED'

    query(tools.psql, port, String.raw`
      grant execute on function
        public.portal_submit_profile_change_request_v2(text,jsonb,uuid)
      to authenticated with grant option;
    `)
    let grantOptionFailure
    try {
      validateDetailedPostcheckV3(parseEnvelopeV3(
        captureFile(tools.psql, port, postcheckPath),
        'postcheck',
      ))
    } catch (error) {
      grantOptionFailure = error
    }
    if (
      !grantOptionFailure?.detail?.assertion?.startsWith('V3-FUNCTION-GRANTS:')
      || !JSON.stringify(grantOptionFailure?.detail?.expected ?? '')
        .includes('"grantable":false')
      || !JSON.stringify(grantOptionFailure?.detail?.actual ?? '')
        .includes('"grantable":true')
    ) fail('grant_option_drift_not_retained')
    query(tools.psql, port, String.raw`
      revoke grant option for execute on function
        public.portal_submit_profile_change_request_v2(text,jsonb,uuid)
      from authenticated;
    `)
    result.aclAdversarial = 'PASS_REJECTED_WITH_EXPECTED_ACTUAL'

    const matrix = parseEnvelopeV3(captureFile(
      tools.psql,
      port,
      matrixPath,
      variables,
    ), 'matrix')
    if (matrix.result !== 'PASS' || matrix.transaction !== 'ROLLED_BACK') {
      fail('matrix_v3_failed')
    }
    result.matrixV3 = 'PASS_ROLLED_BACK'

    query(tools.psql, port, String.raw`
      insert into public.client_portal_profile_change_requests(
        client_id,requested_by,proposed_changes,idempotency_key,public_reference
      ) values (
        'CP3B2A-V3-HIST-CLIENT','10000000-0000-4000-8000-000000000001',
        '{"phone":"+34900000002"}',gen_random_uuid(),'CC-PR-AAAAAAAAAAAAAAAAAAAAAAAA'
      );
    `)
    applyFile(tools.psql, port, rollbackPath, {}, true)
    const stillPresent = query(
      tools.psql,
      port,
      "select count(*) from pg_proc where proname='portal_submit_profile_change_request_v2'",
    )
    if (stillPresent !== '1') fail('rowful_rollback_modified_contract')
    result.rollbackWithV2Row = 'BLOCKED_SAFE'
    query(tools.psql, port, String.raw`
      delete from public.client_portal_profile_change_requests
      where public_reference='CC-PR-AAAAAAAAAAAAAAAAAAAAAAAA';
    `)

    const rollbackOutput = captureFile(tools.psql, port, rollbackPath)
    const rollback = parseSingleJsonV3(rollbackOutput)
    const rollbackEnvelope = parseEnvelopeV3(rollbackOutput, 'rollback')
    if (
      rollback.result !== 'PASS'
      || rollback.contractAbsent !== true
      || rollbackEnvelope.result !== 'PASS'
    ) fail('recovery_v3_failed')
    const restored = parseSingleJsonV3(captureFile(
      tools.psql,
      port,
      precheckPath,
      variables,
    ))
    validatePrestateV2(restored)
    assertPrestateEqual(prestate, restored)
    result.recoveryV3 = 'PASS'

    const integratedFailurePath = path.join(workDir, 'integrated-v3-failure.json')
    const integratedEvents = []
    const integratedLedger = { state: 'attempt_reserved' }
    const integratedOperations = {
      preEffect: async () => {
        integratedEvents.push('pre_effect')
        return {
          gitState: { head: 'a'.repeat(40) },
          backup: { boundaryDigest: 'local-boundary' },
          backupManifestPath: path.join(workDir, 'local-backup.json'),
          prestate: restored,
          runId,
        }
      },
      createLedger: () => {
        integratedEvents.push('ledger_created')
        return integratedLedger
      },
      updateLedger: (_handle, state) => {
        const allowed = {
          attempt_reserved: ['apply_started'],
          apply_started: ['apply_committed'],
          apply_committed: ['blocked_recovered', 'manual_verification_required'],
        }
        if (!allowed[integratedLedger.state]?.includes(state)) {
          fail(`integrated_ledger_transition:${integratedLedger.state}:${state}`)
        }
        integratedLedger.state = state
        integratedEvents.push(`ledger:${state}`)
      },
      persistFailure: (envelope) => {
        writeFileSync(
          integratedFailurePath,
          `${JSON.stringify(envelope, null, 2)}\n`,
          'utf8',
        )
        integratedEvents.push('failure_persisted')
        return integratedFailurePath
      },
      verifyFailure: (failurePath, expectedRunId) => {
        const envelope = JSON.parse(readFileSync(failurePath, 'utf8'))
        if (envelope.runId !== expectedRunId) fail('integrated_failure_unreadable')
        integratedEvents.push('failure_reread')
        return envelope
      },
      updateFailure: (failurePath, patch) => {
        const current = JSON.parse(readFileSync(failurePath, 'utf8'))
        const updated = applyFailureEnvelopeUpdateV3(current, patch)
        writeFileSync(failurePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
        return updated
      },
      apply: async () => applyFile(tools.psql, port, migrationPath),
      postcheckState: async () => parseSingleJsonV3(captureFile(
        tools.psql,
        port,
        frozenPostcheckPath,
      )),
      postcheckDetails: async () => {
        query(tools.psql, port, String.raw`
          comment on function
            public.portal_submit_profile_change_request_v2(text,jsonb,uuid)
          is 'deliberate local mismatch';
        `)
        return parseEnvelopeV3(
          captureFile(tools.psql, port, postcheckPath),
          'postcheck',
        )
      },
      matrix: async () => fail('integrated_matrix_should_not_run'),
      residue: async () => fail('integrated_residue_should_not_run'),
      finalPostcheckState: async () => fail('integrated_final_state_should_not_run'),
      finalPostcheckDetails: async () => fail('integrated_final_detail_should_not_run'),
      reconcile: async () => true,
      recoveryEligibility: async () => true,
      rollback: async () => {
        integratedEvents.push('recovery_started')
        return captureFile(tools.psql, port, rollbackPath)
      },
      parseRollback: async (output) => ({
        legacy: parseSingleJsonV3(output),
        envelope: parseEnvelopeV3(output, 'rollback'),
      }),
      recoveryPrecheck: async () => parseSingleJsonV3(captureFile(
        tools.psql,
        port,
        precheckPath,
        variables,
      )),
      boundaryDigest: async () => 'local-boundary',
      writeSuccessCandidate: () => fail('integrated_success_candidate_should_not_run'),
      finalizeSuccessReport: () => fail('integrated_success_finalize_should_not_run'),
      invalidateSuccessCandidate: () => {
        integratedEvents.push('success_candidate_invalidated')
      },
    }
    let integratedFailure
    try {
      await executeV3TestHarness({}, integratedOperations, runId)
    } catch (error) {
      integratedFailure = error
    }
    if (
      !(integratedFailure instanceof DiagnosticError)
      || integratedFailure.code !== 'V3_EXECUTION_FAILED'
      || integratedLedger.state !== 'blocked_recovered'
      || integratedEvents.indexOf('failure_persisted') < 0
      || integratedEvents.indexOf('failure_reread')
        < integratedEvents.indexOf('failure_persisted')
      || integratedEvents.indexOf('recovery_started')
        < integratedEvents.indexOf('failure_reread')
    ) fail('integrated_failure_sequence_not_proven')
    const retainedEnvelope = JSON.parse(readFileSync(integratedFailurePath, 'utf8'))
    if (
      retainedEnvelope.assertionId
        !== 'V3-FUNCTION-COMMENT:public.portal_submit_profile_change_request_v2(text, jsonb, uuid)'
      || !retainedEnvelope.expectedSummary.includes('Authenticated requester-only')
      || !retainedEnvelope.actualSummary.includes('deliberate local mismatch')
      || !retainedEnvelope.privateEvidence.expected.includes('Authenticated requester-only')
      || !retainedEnvelope.privateEvidence.actual.includes('deliberate local mismatch')
      || retainedEnvelope.recoveryOutcome !== 'restored'
      || retainedEnvelope.automaticRetryCount !== 0
    ) fail(`integrated_failure_not_retained:${retainedEnvelope.assertionId}`)
    assertPrestateEqual(
      prestate,
      parseSingleJsonV3(captureFile(tools.psql, port, precheckPath, variables)),
    )
    result.injectedFailure = 'PASS_INTEGRATED_PERSIST_REREAD_RECOVER'

    applyFile(tools.psql, port, migrationPath)
    validatePoststateV2(
      restored,
      parseSingleJsonV3(captureFile(
        tools.psql,
        port,
        frozenPostcheckPath,
      )),
    )
    try {
      validateDetailedPostcheckV3(parseEnvelopeV3(
        captureFile(tools.psql, port, postcheckPath),
        'postcheck',
      ))
    } catch (error) {
      fail(`postcheck_v3_reapply_failed:${error?.detail?.assertion ?? 'unknown'}`)
    }
    const secondMatrix = parseEnvelopeV3(captureFile(
      tools.psql,
      port,
      matrixPath,
      variables,
    ), 'matrix')
    if (secondMatrix.result !== 'PASS' || secondMatrix.transaction !== 'ROLLED_BACK') {
      fail('matrix_v3_reapply_failed')
    }
    result.reapplyV3 = 'PASS'

    captureFile(tools.psql, port, rollbackPath)
    const finalRestored = parseSingleJsonV3(captureFile(
      tools.psql,
      port,
      precheckPath,
      variables,
    ))
    validatePrestateV2(finalRestored)
    assertPrestateEqual(prestate, finalRestored)
    const residueCounts = query(tools.psql, port, String.raw`
      select
        (select count(*) from public.client_portal_audit_events)
        || ':' ||
        (select count(*) from public.client_portal_rate_limits);
    `)
    if (residueCounts !== '0:0') fail('audit_rate_residue_detected')
    result.auditRateResidue = 'ZERO'
    result.result = 'PASS'
  } finally {
    if (started) {
      try {
        run(tools.pgCtl, [
          '-D',
          clusterDir,
          '-m',
          'fast',
          '-w',
          'stop',
        ], { stdio: 'ignore' })
      } catch {
        result.result = 'FAIL'
      }
    }
    rmSync(workDir, { recursive: true, force: true })
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }
  if (result.result !== 'PASS') fail('cp3b2a3_local_proof_failed')
  console.log('PASS: CP-3B.2A.3 PostgreSQL 17 disposable proof completed.')
  console.log('V2 diagnostic loss reproduced; V3 preserves stage and assertion.')
  console.log('Extra policy and grant-option drift were rejected with exact diagnostics.')
  console.log('Integrated persist, reread, recovery, reapply and second matrix passed.')
  console.log('Zero automatic retry, zero residue and zero remote contacts.')
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}`)
  process.exitCode = 1
})
