import {
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runSupabaseCliV3 } from './cp2b_command_launcher_v3.mjs'
import {
  createPrivateBackupV2,
  currentGitStateV2,
  parseJsonOutput as parseJsonOutputV2,
  validatePoststateV2,
  validatePrestateV2,
  verifyPackageManifestV2,
} from './run-cp3b2a-qa-v2.mjs'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
export const AUTHORIZATION_ID = 'CP3B2A-QA-V3-AUTHORIZATION-PENDING'
export const PACKAGE_STATUS = 'PREPARED_NOT_AUTHORIZED'
export const MIGRATION_SHA256 =
  '4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544'
export const PRE_EFFECT_ORDER = Object.freeze([
  'manifest_and_frozen_hashes',
  'authorization_and_head',
  'clean_main_worktree',
  'private_backup_v3',
  'local_qa_link',
  'supabase_cli_qa_link',
  'production_not_linked',
  'postgres_live_read',
  'postgres_qa_target',
  'cp2b_cp3b0_prerequisites',
  'reviewed_contract_absent',
  'v3_synthetic_collision_check',
  'exact_boundary_prestate',
  'backup_matches_live_prestate',
  'attempt_ledger_create',
  'apply_started',
])

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const privateRoot = path.join(repoRoot, '.git', 'cp3b2a-private')
const manifestPath = path.join(scriptDir, 'cp3b2a_qa_package_v3.manifest.json')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260728160000_portal_reviewed_change_contract.sql',
)
const precheckPath = path.join(scriptDir, 'cp3b2a_qa_precheck_v3.sql')
const frozenPostcheckPath = path.join(scriptDir, 'cp3b2a_qa_postcheck_v2.sql')
const postcheckPath = path.join(scriptDir, 'cp3b2a_qa_postcheck_v3.sql')
const matrixPath = path.join(scriptDir, 'cp3b2a_qa_matrix_v3.sql')
const rollbackPath = path.join(scriptDir, 'cp3b2a_qa_rollback_v3.sql')
const comparisonKeys = Object.freeze([
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
  'auditRows',
  'auditDigest',
  'rateRows',
  'rateDigest',
])
const secretNames = Object.freeze([
  'CP2B_QA_DATABASE_URL',
  'SUPABASE_ACCESS_TOKEN',
  'CP3B2A_PRIVATE_BACKUP_MANIFEST',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
])
const primaryFailureKeys = Object.freeze([
  'stage',
  'failureCode',
  'failureCategory',
  'sqlState',
  'artifact',
  'artifactSha256',
  'assertionId',
  'objectKind',
  'objectReference',
  'expectedSummary',
  'actualSummary',
  'postgresOutputReceived',
  'jsonOutputReceived',
])
const mutableFailureKeys = new Set([
  'recoveryStarted',
  'recoveryOutcome',
  'recoveryFailure',
])
const expectedArtifactPaths = Object.freeze([
  'scripts/client-portal/cp3b2a_qa_precheck_v3.sql',
  'scripts/client-portal/cp3b2a_qa_postcheck_v3.sql',
  'scripts/client-portal/cp3b2a_qa_matrix_v3.sql',
  'scripts/client-portal/cp3b2a_qa_rollback_v3.sql',
  'scripts/client-portal/run-cp3b2a-qa-v3.mjs',
  'scripts/client-portal/run-cp3b2a3-local-proof.mjs',
  'scripts/client-portal/cp3b2aQaApplicationV3.test.mjs',
  'scripts/client-portal/analyze-cp3b2a-v2-incident.mjs',
  'docs/client-portal/CP3B2A2_QA_FAILURE_ROOT_CAUSE.md',
  'docs/client-portal/CP3B2A3_FAILURE_OBSERVABILITY_PACKAGE.md',
  'docs/client-portal/CP3B2A_EXACT_QA_AUTHORIZATION_V3.md',
])
export const ASSERTION_IDS = Object.freeze([
  'V3-COLUMN-COUNT',
  'V3-COLUMN-DEFINITION',
  'V3-CONSTRAINT-DEFINITION',
  'V3-INDEX-DEFINITION',
  'V3-FUNCTION-SIGNATURE',
  'V3-FUNCTION-OWNER',
  'V3-FUNCTION-SEARCH-PATH',
  'V3-FUNCTION-GRANTS',
  'V3-FUNCTION-COMMENT',
  'V3-POLICY-COUNT',
  'V3-RLS-FORCE',
  'V3-LEGACY-GRANT-COUNT',
  'V3-HISTORICAL-DIGEST',
  'V3-CANONICAL-DIGEST',
  'V3-FINANCIAL-SEQUENCE-DIGEST',
  'V3-AUTH-DIGEST',
  'V3-MIGRATION-HISTORY-DIGEST',
])
const allowedModes = new Set(['--plan', '--preflight', '--execute'])

export class DiagnosticError extends Error {
  constructor(code, detail = {}) {
    super(code)
    this.name = 'DiagnosticError'
    this.code = code
    this.detail = detail
  }
}

function fail(code, detail) {
  throw new DiagnosticError(code, detail)
}

export function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function assertHash(filePath, expected) {
  if (!existsSync(filePath) || sha256(filePath) !== expected) {
    fail('V3_ARTIFACT_HASH_MISMATCH')
  }
}

export function verifyPackageManifestV3() {
  const frozen = verifyPackageManifestV2()
  if (!existsSync(manifestPath)) fail('V3_MANIFEST_MISSING')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    manifest.version !== 3
    || manifest.gate !== 'CP-3B.2A.3'
    || manifest.status !== PACKAGE_STATUS
    || manifest.authorizationId !== AUTHORIZATION_ID
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.sourceBaseHead !== '23071c1b3d5525e9642a71d9c1f05a04136b22a8'
    || manifest.migration !== 'supabase/migrations/20260728160000_portal_reviewed_change_contract.sql'
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || manifest.correctiveMigrationRequired !== false
    || manifest.v1ManifestSha256 !== frozen.v1ManifestSha256
    || manifest.v1ArtifactCount !== 10
    || manifest.v2ManifestSha256
      !== sha256(path.join(scriptDir, 'cp3b2a_qa_package_v2.manifest.json'))
    || manifest.v2ArtifactCount !== 9
    || manifest.executeAlias !== false
    || manifest.v2AuthorizationRejected !== true
    || manifest.automaticRetries !== 0
    || manifest.maximumApplyAttempts !== 1
    || manifest.maximumRecoveryAttempts !== 1
    || manifest.originalRemoteTrigger !== 'UNKNOWN_PENDING_V3_EXECUTION'
    || manifest.failureEnvelopeContract?.persistedAndVerifiedBeforeRecovery !== true
    || manifest.failureEnvelopeContract?.primaryFailureImmutable !== true
    || manifest.failureEnvelopeContract?.recoveryFailureSeparate !== true
    || manifest.recoveryContract?.requiresConfirmedApply !== true
    || manifest.recoveryContract?.automaticRetries !== 0
    || JSON.stringify(manifest.assertionIds) !== JSON.stringify(ASSERTION_IDS)
    || JSON.stringify(manifest.preEffectOrder) !== JSON.stringify(PRE_EFFECT_ORDER)
    || !Array.isArray(manifest.artifacts)
    || manifest.artifacts.length !== expectedArtifactPaths.length
    || JSON.stringify(manifest.artifacts.map((artifact) => artifact.path))
      !== JSON.stringify(expectedArtifactPaths)
  ) fail('V3_MANIFEST_CONTRACT_REJECTED')
  for (const artifact of manifest.artifacts) {
    assertHash(path.join(repoRoot, artifact.path), artifact.sha256)
  }
  assertHash(migrationPath, MIGRATION_SHA256)
  return manifest
}

export function assertModeV3(argv) {
  if (argv.length !== 1 || !allowedModes.has(argv[0])) {
    fail('V3_MODE_REJECTED')
  }
  return argv[0]
}

function minimalSystemEnvironment(environment) {
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

export function parseDatabaseTarget(environment) {
  const raw = environment.CP2B_QA_DATABASE_URL
  if (typeof raw !== 'string' || raw.length === 0) fail('QA_DATABASE_URL_REQUIRED')
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    fail('QA_DATABASE_TARGET_REJECTED')
  }
  const direct = parsed.hostname === `db.${QA_REF}.supabase.co`
    && decodeURIComponent(parsed.username) === 'postgres'
    && (parsed.port === '' || parsed.port === '5432')
  const pooler = /^[a-z0-9-]+[.]pooler[.]supabase[.]com$/u.test(parsed.hostname)
    && decodeURIComponent(parsed.username) === `postgres.${QA_REF}`
    && ['5432', '6543'].includes(parsed.port)
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || (!direct && !pooler)
    || parsed.pathname !== '/postgres'
    || parsed.searchParams.get('sslmode') !== 'require'
    || !parsed.password
    || raw.includes(PRODUCTION_REF)
  ) fail('QA_DATABASE_TARGET_REJECTED')
  const childEnvironment = minimalSystemEnvironment(environment)
  childEnvironment.PGHOST = parsed.hostname
  childEnvironment.PGPORT = parsed.port || '5432'
  childEnvironment.PGDATABASE = 'postgres'
  childEnvironment.PGUSER = decodeURIComponent(parsed.username)
  childEnvironment.PGPASSWORD = decodeURIComponent(parsed.password)
  childEnvironment.PGSSLMODE = 'require'
  return { childEnvironment, projectRef: QA_REF }
}

function sqlStateFromOutput(output) {
  const match = String(output).match(/(?:SQLSTATE[\s:]+|ERROR:\s+)([0-9A-Z]{5})\b/iu)
  return match?.[1]?.toUpperCase() ?? null
}

function relativeArtifact(filePath) {
  if (!filePath) return null
  return path.relative(repoRoot, filePath).replaceAll('\\', '/')
}

export function runObservedProcessV3(
  executable,
  args,
  options = {},
  runner = spawnSync,
) {
  const result = runner(executable, args, {
    cwd: repoRoot,
    env: options.environment,
    input: options.input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 180_000,
    maxBuffer: options.maxBuffer ?? 4 * 1024 * 1024,
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const timedOut = result.error?.code === 'ETIMEDOUT'
  const aborted = Boolean(result.signal) && !timedOut
  if (result.error || result.status !== 0) {
    const code = timedOut
      ? 'PROCESS_TIMEOUT'
      : aborted
        ? 'PROCESS_ABORTED'
        : options.source === 'postgres'
          ? 'POSTGRES_SQL_ERROR'
          : 'PROCESS_TRANSPORT_ERROR'
    fail(code, {
      stage: options.stage ?? 'process',
      stdout,
      stderr,
      exitCode: result.status ?? null,
      signal: result.signal ?? null,
      timedOut,
      sqlState: sqlStateFromOutput(stderr),
      artifact: relativeArtifact(options.artifact),
      artifactSha256: options.artifact && existsSync(options.artifact)
        ? sha256(options.artifact)
        : null,
      postgresOutputReceived: stdout.length > 0 || stderr.length > 0,
      jsonOutputReceived: false,
    })
  }
  return {
    stdout,
    stderr,
    exitCode: result.status ?? 0,
    signal: result.signal ?? null,
  }
}

function runProcess(executable, args, options = {}) {
  return runObservedProcessV3(
    executable,
    args,
    options,
    options.runner ?? spawnSync,
  )
}

function psqlExecutable() {
  return process.platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
    : 'psql'
}

function pgDumpExecutable() {
  return process.platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe'
    : 'pg_dump'
}

function runPsqlFile(filePath, variables, environment, options = {}) {
  const { childEnvironment } = parseDatabaseTarget(environment)
  const args = [
    '-X',
    options.capture === false ? '-q' : '-Atq',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    'VERBOSITY=verbose',
  ]
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  return runProcess(psqlExecutable(), args, {
    environment: childEnvironment,
    stage: options.stage,
    source: 'postgres',
    artifact: filePath,
  }).stdout
}

function runPsqlQuery(sql, environment, stage) {
  const { childEnvironment } = parseDatabaseTarget(environment)
  return runProcess(
    psqlExecutable(),
    ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
    { environment: childEnvironment, input: sql, stage, source: 'postgres' },
  ).stdout
}

export function parseSingleJsonV3(output) {
  if (String(output).trim() === '') {
    fail('POSTGRES_JSON_EMPTY', {
      postgresOutputReceived: false,
      jsonOutputReceived: false,
    })
  }
  const candidates = String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
  if (candidates.length !== 1 || candidates[0].length > 1024 * 1024) {
    fail('POSTGRES_JSON_CARDINALITY_REJECTED', {
      postgresOutputReceived: true,
      jsonOutputReceived: candidates.length > 0,
    })
  }
  try {
    return JSON.parse(candidates[0])
  } catch {
    fail('POSTGRES_JSON_PARSE_REJECTED', {
      postgresOutputReceived: true,
      jsonOutputReceived: true,
    })
  }
}

export function parseEnvelopeV3(output, expectedKind) {
  const prefix = 'CP3B2A_V3_JSON:'
  if (String(output).trim() === '') {
    fail('V3_ENVELOPE_EMPTY', {
      postgresOutputReceived: false,
      jsonOutputReceived: false,
    })
  }
  const candidates = String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
  if (candidates.length !== 1 || candidates[0].length > 1024 * 1024) {
    fail('V3_ENVELOPE_CARDINALITY_REJECTED', {
      postgresOutputReceived: true,
      jsonOutputReceived: candidates.length > 0,
    })
  }
  let parsed
  try {
    parsed = JSON.parse(candidates[0].slice(prefix.length))
  } catch {
    fail('V3_ENVELOPE_PARSE_REJECTED', {
      postgresOutputReceived: true,
      jsonOutputReceived: true,
    })
  }
  if (parsed.version !== 3 || parsed.kind !== expectedKind) {
    fail('V3_ENVELOPE_KIND_REJECTED', {
      postgresOutputReceived: true,
      jsonOutputReceived: true,
    })
  }
  return parsed
}

export function validateDetailedPostcheckV3(envelope) {
  const checks = Array.isArray(envelope.checks) ? envelope.checks : []
  const ids = checks.map((check) => check?.id)
  if (
    envelope.result !== 'PASS'
    || checks.length !== 48
    || checks.some((check) => (
      typeof check?.id !== 'string'
      || typeof check?.object !== 'string'
      || check.pass !== true
    ))
    || new Set(ids).size !== ids.length
  ) {
    const failed = checks.find((check) => check?.pass !== true)
    fail('V3_POSTCHECK_ASSERTION_FAILED', {
      assertion: failed?.id ?? 'postcheck-envelope',
      object: failed?.object ?? 'catalog-contract',
      expected: failed?.expected ?? 'EXACT_DECLARED_CONTRACT',
      actual: failed?.actual ?? 'MISMATCH',
      postgresOutputReceived: true,
      jsonOutputReceived: true,
    })
  }
  return envelope
}

function validateStateV3(prestate, poststate) {
  try {
    validatePoststateV2(prestate, poststate)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'postcheck_contract_rejected'
    const drift = code.startsWith('postcheck_drift_')
    const key = drift ? code.slice('postcheck_drift_'.length) : null
    const assertionByKey = {
      profileRows: 'V3-HISTORICAL-DIGEST',
      propertyRows: 'V3-HISTORICAL-DIGEST',
      profileDigest: 'V3-HISTORICAL-DIGEST',
      propertyDigest: 'V3-HISTORICAL-DIGEST',
      canonicalDigest: 'V3-CANONICAL-DIGEST',
      financialSequenceDigest: 'V3-FINANCIAL-SEQUENCE-DIGEST',
      authUserCount: 'V3-AUTH-DIGEST',
      authDigest: 'V3-AUTH-DIGEST',
      migrationHistoryCount: 'V3-MIGRATION-HISTORY-DIGEST',
      migrationHistoryDigest: 'V3-MIGRATION-HISTORY-DIGEST',
      auditRows: 'V3-HISTORICAL-DIGEST',
      auditDigest: 'V3-HISTORICAL-DIGEST',
      rateRows: 'V3-HISTORICAL-DIGEST',
      rateDigest: 'V3-HISTORICAL-DIGEST',
    }
    fail('V3_POSTCHECK_STATE_FAILED', {
      assertion: drift
        ? assertionByKey[key] ?? 'V3-HISTORICAL-DIGEST'
        : 'V3-POSTSTATE-CONTRACT',
      object: drift ? 'protected-prestate' : 'reviewed-change-contract',
      expected: drift ? 'UNCHANGED' : 'EXACT_V2_CONTRACT',
      actual: drift ? `DRIFT:${key}` : 'MISMATCH',
      postgresOutputReceived: true,
      jsonOutputReceived: true,
    })
  }
  return poststate
}

function exactBoundaryDigest(environment) {
  const output = runPsqlQuery(String.raw`
    with target_policies as (
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname='public' and policyname in (
        'Portal reads same-client profile requests',
        'Portal reads same-client property requests',
        'Internal staff manage profile requests',
        'Internal staff manage property requests'
      )
    ), target_grants as (
      select
        p.oid::regprocedure::text as signature,
        grantee.rolname as grantee,
        grantor.rolname as grantor,
        acl.privilege_type,
        acl.is_grantable
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
      join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        on true
      join pg_roles grantor on grantor.oid=acl.grantor
      left join pg_roles grantee on grantee.oid=acl.grantee
      where p.oid in (
        'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)'::regprocedure,
        'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)'::regprocedure
      ) and acl.privilege_type='EXECUTE'
    )
    select md5(
      coalesce((select string_agg(to_jsonb(p)::text, '|' order by tablename, policyname)
        from target_policies p), '')
      || '#'
      || coalesce((select string_agg(to_jsonb(g)::text, '|' order by signature, grantee)
        from target_grants g), '')
    );
  `, environment, 'exact_boundary_digest').trim()
  if (!/^[a-f0-9]{32}$/u.test(output)) fail('BOUNDARY_DIGEST_REJECTED')
  return output
}

function assertExactRecoveredBoundaryV3(environment, stage) {
  const contract = parseSingleJsonV3(runPsqlQuery(String.raw`
    with policy_actual as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'table',tablename,
        'policy',policyname,
        'permissive',permissive,
        'roles',to_jsonb(roles),
        'command',cmd,
        'qual',regexp_replace(coalesce(qual,''), '\s+', '', 'g'),
        'withCheck',regexp_replace(coalesce(with_check,''), '\s+', '', 'g')
      ) order by tablename, policyname), '[]'::jsonb) definition
      from pg_policies
      where schemaname='public' and tablename in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      )
    ), policy_expected as (
      select jsonb_build_array(
        jsonb_build_object(
          'table','client_portal_profile_change_requests',
          'policy','Internal staff manage profile requests',
          'permissive','PERMISSIVE','roles',jsonb_build_array('authenticated'),
          'command','ALL',
          'qual','portal_private.is_active_internal_staff(auth.uid())',
          'withCheck','portal_private.is_active_internal_staff(auth.uid())'
        ),
        jsonb_build_object(
          'table','client_portal_profile_change_requests',
          'policy','Portal reads same-client profile requests',
          'permissive','PERMISSIVE','roles',jsonb_build_array('authenticated'),
          'command','SELECT',
          'qual','portal_private.has_active_portal_membership(auth.uid(),client_id)',
          'withCheck',''
        ),
        jsonb_build_object(
          'table','client_portal_property_change_requests',
          'policy','Internal staff manage property requests',
          'permissive','PERMISSIVE','roles',jsonb_build_array('authenticated'),
          'command','ALL',
          'qual','portal_private.is_active_internal_staff(auth.uid())',
          'withCheck','portal_private.is_active_internal_staff(auth.uid())'
        ),
        jsonb_build_object(
          'table','client_portal_property_change_requests',
          'policy','Portal reads same-client property requests',
          'permissive','PERMISSIVE','roles',jsonb_build_array('authenticated'),
          'command','SELECT',
          'qual','portal_private.has_active_portal_membership(auth.uid(),client_id)',
          'withCheck',''
        )
      ) definition
    ), legacy_acl_rows as (
      select target.signature,
        coalesce(jsonb_agg(jsonb_build_object(
          'grantee', coalesce(grantee.rolname, 'PUBLIC'),
          'grantor', grantor.rolname,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) order by coalesce(grantee.rolname, 'PUBLIC')), '[]'::jsonb) acl
      from (values
        (
          'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
          'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)'::regprocedure
        ),
        (
          'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
          'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)'::regprocedure
        )
      ) as target(signature, oid)
      join pg_proc p on p.oid=target.oid
      join lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) acl on true
      join pg_roles grantor on grantor.oid=acl.grantor
      left join pg_roles grantee on grantee.oid=acl.grantee
      where acl.privilege_type='EXECUTE'
      group by target.signature
    ), legacy_acl_actual as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'signature',signature,'executeAcl',acl
      ) order by signature), '[]'::jsonb) definition
      from legacy_acl_rows
    ), legacy_acl_expected as (
      select jsonb_build_array(
        jsonb_build_object(
          'signature','public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
          'executeAcl',jsonb_build_array(
            jsonb_build_object('grantee','postgres','grantor','postgres',
              'privilege','EXECUTE','grantable',false),
            jsonb_build_object('grantee','service_role','grantor','postgres',
              'privilege','EXECUTE','grantable',false)
          )
        ),
        jsonb_build_object(
          'signature','public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
          'executeAcl',jsonb_build_array(
            jsonb_build_object('grantee','postgres','grantor','postgres',
              'privilege','EXECUTE','grantable',false),
            jsonb_build_object('grantee','service_role','grantor','postgres',
              'privilege','EXECUTE','grantable',false)
          )
        )
      ) definition
    )
    select jsonb_build_object(
      'policyDefinitionsPass',
        (select actual.definition=expected.definition
         from policy_actual actual cross join policy_expected expected),
      'policyExpected',(select definition from policy_expected),
      'policyActual',(select definition from policy_actual),
      'rlsForcePass', (
        select count(*)=2 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname in (
          'client_portal_profile_change_requests',
          'client_portal_property_change_requests'
        )
      ),
      'legacyAclPass',
        (select actual.definition=expected.definition
         from legacy_acl_actual actual cross join legacy_acl_expected expected),
      'legacyAclExpected',(select definition from legacy_acl_expected),
      'legacyAclActual',(select definition from legacy_acl_actual)
    )::text;
  `, environment, stage))
  if (
    contract.policyDefinitionsPass !== true
    || contract.rlsForcePass !== true
    || contract.legacyAclPass !== true
  ) fail('V3_EXACT_RECOVERED_BOUNDARY_REJECTED', {
    assertion: 'V3-RECOVERED-BOUNDARY',
    object: 'policy/grant',
    expected: {
      policies: contract.policyExpected,
      legacyAcl: contract.legacyAclExpected,
      rlsForce: true,
    },
    actual: {
      policies: contract.policyActual,
      legacyAcl: contract.legacyAclActual,
      rlsForce: contract.rlsForcePass,
    },
    postgresOutputReceived: true,
    jsonOutputReceived: true,
  })
  return contract
}

function captureOperationalState(environment, stage = 'operational_state') {
  return parseSingleJsonV3(runPsqlQuery(String.raw`
    select jsonb_build_object(
      'auditRows', (select count(*) from public.client_portal_audit_events),
      'auditDigest', (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
        from public.client_portal_audit_events r),
      'rateRows', (select count(*) from public.client_portal_rate_limits),
      'rateDigest', (select md5(coalesce(string_agg(
        to_jsonb(r)::text,
        '|' order by r.action, r.subject_hash, r.window_started_at
      ), ''))
        from public.client_portal_rate_limits r)
    )::text;
  `, environment, stage))
}

function withOperationalState(prestate, environment, stage) {
  return Object.assign(
    prestate,
    captureOperationalState(environment, stage),
  )
}

function assertGitStateV3(gitState, expectedHead = null) {
  const divergencePass = Array.isArray(gitState.divergence)
    ? gitState.divergence.length === 2
      && gitState.divergence[0] === 0
      && gitState.divergence[1] === 0
    : gitState.divergence === '0\t0'
  const clean = typeof gitState.clean === 'boolean'
    ? gitState.clean
    : gitState.status === ''
  if (
    gitState.branch !== 'main'
    || gitState.head !== gitState.remoteHead
    || !divergencePass
    || !clean
    || (expectedHead && gitState.head !== expectedHead)
  ) fail('GIT_STATE_REJECTED')
  return gitState
}

function assertLocalQaLink() {
  const linkPath = path.join(repoRoot, 'supabase', '.temp', 'project-ref')
  if (!existsSync(linkPath) || readFileSync(linkPath, 'utf8').trim() !== QA_REF) {
    fail('LOCAL_QA_LINK_REJECTED')
  }
}

function assertCliQaLink(environment, dependencies = {}) {
  const cli = dependencies.cliProjects ?? (() => {
    const cliEnvironment = minimalSystemEnvironment(environment)
    if (environment.SUPABASE_ACCESS_TOKEN) {
      cliEnvironment.SUPABASE_ACCESS_TOKEN = environment.SUPABASE_ACCESS_TOKEN
    }
    return runSupabaseCliV3(
      ['--workdir', repoRoot, 'projects', 'list', '--output', 'json'],
      {
        repoRoot,
        cwd: path.dirname(repoRoot),
        environment: cliEnvironment,
        redactFailure: true,
        timeout: 120_000,
      },
    ).stdout
  })
  let projects
  try {
    projects = JSON.parse(cli())
  } catch {
    fail('SUPABASE_CLI_OUTPUT_REJECTED')
  }
  if (!Array.isArray(projects)) fail('SUPABASE_CLI_OUTPUT_REJECTED')
  const qa = projects.find((project) => project.id === QA_REF || project.ref === QA_REF)
  const production = projects.find(
    (project) => project.id === PRODUCTION_REF || project.ref === PRODUCTION_REF,
  )
  if (!qa?.linked || production?.linked) fail('SUPABASE_CLI_LINK_REJECTED')
}

export function verifyPrivateBackupV3(manifestFile, expectedHead) {
  if (!manifestFile) fail('V3_PRIVATE_BACKUP_REQUIRED')
  const resolved = path.resolve(manifestFile)
  const privateResolved = path.resolve(privateRoot)
  if (!resolved.startsWith(`${privateResolved}${path.sep}`)) {
    fail('V3_PRIVATE_BACKUP_LOCATION_REJECTED')
  }
  const manifest = JSON.parse(readFileSync(resolved, 'utf8'))
  if (
    manifest.version !== 3
    || manifest.status !== 'COMPLETE'
    || manifest.projectRef !== QA_REF
    || manifest.gitHead !== expectedHead
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || !Array.isArray(manifest.artifacts)
    || manifest.artifacts.length !== 8
    || !/^[a-f0-9]{32}$/u.test(manifest.boundaryDigest)
  ) fail('V3_PRIVATE_BACKUP_REJECTED')
  const expectedBackupNames = [
    'schema-only.sql',
    'catalog-functions.json',
    'catalog-relations.json',
    'grants.json',
    'owners.json',
    'policies.json',
    'migration-history.json',
    'catalog-prestate.json',
  ]
  if (
    JSON.stringify(manifest.artifacts.map((artifact) => path.basename(artifact.path)).sort())
    !== JSON.stringify([...expectedBackupNames].sort())
  ) fail('V3_PRIVATE_BACKUP_ARTIFACT_SET_REJECTED')
  for (const artifact of manifest.artifacts) {
    const artifactPath = path.resolve(artifact.path)
    if (
      !artifactPath.startsWith(`${privateResolved}${path.sep}`)
      || !existsSync(artifactPath)
      || sha256(artifactPath) !== artifact.sha256
    ) fail('V3_PRIVATE_BACKUP_ARTIFACT_REJECTED')
  }
  const sourcePath = path.resolve(manifest.sourceManifest?.path ?? '')
  if (
    !sourcePath.startsWith(`${privateResolved}${path.sep}`)
    || !existsSync(sourcePath)
    || sha256(sourcePath) !== manifest.sourceManifest?.sha256
  ) fail('V3_PRIVATE_BACKUP_SOURCE_REJECTED')
  const sourceManifest = JSON.parse(readFileSync(sourcePath, 'utf8'))
  if (
    sourceManifest.version !== 2
    || sourceManifest.status !== 'COMPLETE'
    || sourceManifest.projectRef !== QA_REF
    || sourceManifest.gitHead !== expectedHead
    || sourceManifest.migrationSha256 !== MIGRATION_SHA256
    || JSON.stringify(sourceManifest.artifacts) !== JSON.stringify(manifest.artifacts)
  ) fail('V3_PRIVATE_BACKUP_SOURCE_CONTRACT_REJECTED')
  return manifest
}

function verifyBackupMatchesPrestateV3(backup, prestate) {
  const artifact = backup.artifacts.find(
    (entry) => path.basename(entry.path) === 'catalog-prestate.json',
  )
  if (!artifact) fail('V3_PRIVATE_BACKUP_PRESTATE_MISSING')
  const saved = JSON.parse(readFileSync(artifact.path, 'utf8'))
  for (const key of comparisonKeys) {
    if (saved[key] !== prestate[key]) fail('V3_PRIVATE_BACKUP_PRESTATE_DRIFT')
  }
}

function createPrivateBackupV3(environment, gitHead, prestate) {
  const v2ManifestPath = createPrivateBackupV2({
    environment,
    gitHead,
    prestate,
  })
  const v2Manifest = JSON.parse(readFileSync(v2ManifestPath, 'utf8'))
  const v3Path = path.join(path.dirname(v2ManifestPath), 'private-backup-v3-manifest.json')
  const manifest = {
    version: 3,
    status: 'COMPLETE',
    projectRef: QA_REF,
    gitHead,
    migrationSha256: MIGRATION_SHA256,
    createdAt: new Date().toISOString(),
    boundaryDigest: exactBoundaryDigest(environment),
    artifacts: v2Manifest.artifacts,
    sourceManifest: {
      path: v2ManifestPath,
      sha256: sha256(v2ManifestPath),
    },
  }
  writeFileSync(v3Path, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  verifyPrivateBackupV3(v3Path, gitHead)
  return v3Path
}

function assertAuthorizationV3(environment, gitState) {
  if (
    environment.CP3B2A_V2_AUTHORIZATION_ID
    || environment.CP3B2A_V1_AUTHORIZATION_ID
  ) fail('V3_PRIOR_AUTHORIZATION_REJECTED')
  if (
    environment.CP3B2A_EXECUTION_AUTHORIZED !== 'true'
    || environment.CP3B2A_PROJECT_REF !== QA_REF
    || environment.CP3B2A_V3_AUTHORIZATION_ID !== AUTHORIZATION_ID
    || environment.CP3B2A_V3_AUTHORIZED_HEAD !== gitState.head
  ) fail('V3_EXECUTION_NOT_AUTHORIZED')
}

function makeRunId() {
  return `CP3B2A-V3-${randomBytes(6).toString('hex').toUpperCase()}`
}

function v2RunIdFor(runId) {
  return runId.replace('CP3B2A-V3-', 'CP3B2A-V2-')
}

function syntheticCollisionCount(environment, runId) {
  const output = runPsqlQuery(String.raw`
    select (
      (select count(*) from auth.users
       where email like lower('${runId}') || '-%@example.invalid')
      + (select count(*) from public.clients where id like '${runId}' || '-%')
      + (select count(*) from public.properties where id like '${runId}' || '-%')
      + (select count(*) from public.client_portal_audit_events
         where metadata ->> 'qaRunId' = '${runId}')
    )::integer;
  `, environment, 'synthetic_collision_count').trim()
  if (!/^[0-9]+$/u.test(output)) fail('V3_COLLISION_OUTPUT_REJECTED')
  return Number(output)
}

export function assertNoSyntheticCollisionsV3(count) {
  if (!Number.isInteger(count) || count !== 0) {
    fail('V3_SYNTHETIC_COLLISION', {
      assertion: 'V3-SYNTHETIC-COLLISION',
      object: 'synthetic-fixtures',
      expected: 0,
      actual: count,
    })
  }
  return true
}

function createAttemptLedger(context) {
  const gitHead = context.gitState.head
  const backupManifestPath = context.backupManifestPath
  mkdirSync(privateRoot, { recursive: true })
  const ledgerPath = path.join(privateRoot, `v3-attempt-${gitHead}.json`)
  let handle
  try {
    handle = openSync(
      ledgerPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    )
    writeFileSync(handle, `${JSON.stringify({
      version: 3,
      state: 'attempt_reserved',
      runId: context.runId,
      gitHead,
      authorizationId: AUTHORIZATION_ID,
      projectRef: QA_REF,
      packageManifestSha256: sha256(manifestPath),
      migrationSha256: MIGRATION_SHA256,
      backupManifestSha256: sha256(backupManifestPath),
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`)
  } catch {
    fail('V3_ATTEMPT_ALREADY_CONSUMED')
  } finally {
    if (handle !== undefined) closeSync(handle)
  }
  return ledgerPath
}

export function assertLedgerIdentityV3(ledger, context, expectedHashes) {
  if (
    ledger.version !== 3
    || ledger.gitHead !== context.gitState.head
    || ledger.runId !== context.runId
    || ledger.authorizationId !== AUTHORIZATION_ID
    || ledger.projectRef !== QA_REF
    || ledger.packageManifestSha256 !== expectedHashes.packageManifestSha256
    || ledger.migrationSha256 !== MIGRATION_SHA256
    || ledger.backupManifestSha256 !== expectedHashes.backupManifestSha256
    || typeof ledger.createdAt !== 'string'
    || Number.isNaN(Date.parse(ledger.createdAt))
  ) fail('V3_ATTEMPT_LEDGER_TAMPERED')
  return true
}

function updateLedger(ledgerPath, state, context) {
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  assertLedgerIdentityV3(ledger, context, {
    packageManifestSha256: sha256(manifestPath),
    backupManifestSha256: sha256(context.backupManifestPath),
  })
  const allowedTransitions = {
    attempt_reserved: ['apply_started'],
    apply_started: [
      'apply_committed',
      'blocked_no_contract',
      'manual_verification_required',
    ],
    apply_committed: [
      'completed',
      'blocked_recovered',
      'manual_verification_required',
    ],
  }
  if (!allowedTransitions[ledger.state]?.includes(state)) {
    fail('V3_ATTEMPT_LEDGER_TRANSITION_REJECTED')
  }
  const temporaryPath = `${ledgerPath}.next`
  writeFileSync(temporaryPath, `${JSON.stringify({
    ...ledger,
    state,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(temporaryPath, ledgerPath)
}

function redactTechnicalText(value, sensitiveValues = []) {
  let redacted = String(value)
    .replace(/postgres(?:ql)?:\/\/\S+/giu, '[REDACTED_CONNECTION]')
    .replace(/[A-Z]:\\[^\s"']+/giu, '[REDACTED_PATH]')
    .replace(/\/(?:home|Users|tmp)\/[^\s"']+/giu, '[REDACTED_PATH]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, '[REDACTED_UUID]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_EMAIL]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu, '[REDACTED_JWT]')
    .replace(/\b(?:[XYZ]\d{7}[A-Z]|\d{8}[A-Z]|[A-HJ-NP-SUVW]\d{7}[0-9A-J])\b/giu, '[REDACTED_TAX_ID]')
    .replace(/(?<![A-Za-z0-9])(?:\+34[\s.-]*)?[6789](?:[\s.-]*\d){8}(?![A-Za-z0-9])/gu, '[REDACTED_PHONE]')
  for (const secret of sensitiveValues) {
    if (typeof secret === 'string' && secret.length >= 6) {
      redacted = redacted.split(secret).join('[REDACTED_SECRET]')
    }
  }
  return redacted
}

function sensitiveValuesFrom(environment) {
  return secretNames
    .map((name) => environment[name])
    .filter((value) => typeof value === 'string' && value.length >= 6)
}

function serializedDetail(value) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return 'UNSERIALIZABLE'
  }
}

export function boundedSanitizedSummary(value, sensitiveValues = []) {
  const serialized = typeof value === 'string'
    ? value
    : serializedDetail(value)
  const redacted = redactTechnicalText(serialized ?? 'null', sensitiveValues)
    .replace(/\s+/gu, ' ')
    .trim()
  if (!redacted) return 'NOT_AVAILABLE'
  if (redacted.length <= 512) return redacted
  const digest = createHash('sha256').update(redacted).digest('hex').slice(0, 16)
  return `${redacted.slice(0, 480)}…#sha256:${digest}`
}

function failureCategory(code, stage) {
  if (code.includes('TIMEOUT')) return 'timeout'
  if (code.includes('TRANSPORT') || code.includes('ABORTED')) return 'transport'
  if (code.includes('PARSE') || code.includes('ENVELOPE') || code.includes('JSON')) {
    return 'parser'
  }
  if (code.includes('ASSERTION') || code.includes('POSTCHECK_STATE')) return 'assertion'
  if (code.includes('POSTGRES_SQL')) return 'sql'
  if (stage === 'postcheck' || stage === 'matrix' || stage === 'recovery') return 'sql'
  return 'unknown'
}

function objectKind(reference) {
  const value = String(reference ?? '').toLowerCase()
  for (const kind of ['function', 'grant', 'policy', 'index', 'constraint', 'column']) {
    if (value.includes(kind)) return kind
  }
  return 'other'
}

export function sanitizeFailureV3(error, stage, sensitiveValues = []) {
  const detail = error instanceof DiagnosticError ? error.detail : {}
  const code = error instanceof DiagnosticError ? error.code : 'UNCLASSIFIED_FAILURE'
  const objectReference = typeof detail.object === 'string'
    ? boundedSanitizedSummary(detail.object, sensitiveValues)
    : 'not-applicable'
  return {
    stage,
    failureCode: code,
    failureCategory: failureCategory(code, stage),
    sqlState: typeof detail.sqlState === 'string' && /^[0-9A-Z]{5}$/u.test(detail.sqlState)
      ? detail.sqlState
      : null,
    artifact: typeof detail.artifact === 'string' ? detail.artifact : null,
    artifactSha256: typeof detail.artifactSha256 === 'string'
      ? detail.artifactSha256
      : null,
    assertionId: typeof detail.assertion === 'string'
      ? boundedSanitizedSummary(detail.assertion, sensitiveValues)
      : null,
    objectKind: objectKind(objectReference),
    objectReference,
    expectedSummary: boundedSanitizedSummary(
      detail.expected ?? 'NOT_AVAILABLE',
      sensitiveValues,
    ),
    actualSummary: boundedSanitizedSummary(
      detail.actual ?? 'NOT_AVAILABLE',
      sensitiveValues,
    ),
    postgresOutputReceived: detail.postgresOutputReceived === true,
    jsonOutputReceived: detail.jsonOutputReceived === true,
  }
}

export function publicFailureSummaryV3(envelope) {
  return Object.fromEntries([
    'stage',
    'failureCode',
    'failureCategory',
    'assertionId',
    'objectKind',
    'expectedSummary',
    'actualSummary',
    'recoveryOutcome',
  ].map((key) => [key, envelope[key] ?? null]))
}

export function buildFailureEnvelopeV3({
  error,
  stage,
  runId,
  stages,
  runtime,
  sensitiveValues = [],
  createdAt = new Date().toISOString(),
}) {
  const failure = sanitizeFailureV3(error, stage, sensitiveValues)
  const detail = error instanceof DiagnosticError ? error.detail : {}
  const primaryFailure = { ...failure }
  const primaryFailureSha256 = createHash('sha256')
    .update(JSON.stringify(primaryFailure))
    .digest('hex')
  return {
    version: 3,
    runId,
    ...failure,
    lastCompletedStage: stages.at(-1) ?? 'none',
    applyStarted: runtime.applyStarted,
    applyCommitted: runtime.applyCommitted,
    postcheckStarted: runtime.postcheckStarted,
    matrixStarted: runtime.matrixStarted,
    successCandidateInvalidationFailed:
      runtime.successCandidateInvalidationFailed === true,
    recoveryStarted: false,
    recoveryOutcome: 'not_required',
    automaticRetryCount: 0,
    createdAt,
    primaryFailure,
    primaryFailureSha256,
    recoveryFailure: null,
    privateEvidence: {
      stdout: typeof detail.stdout === 'string'
        ? redactTechnicalText(detail.stdout, sensitiveValues).slice(0, 1024 * 1024)
        : '',
      stderr: typeof detail.stderr === 'string'
        ? redactTechnicalText(detail.stderr, sensitiveValues).slice(0, 1024 * 1024)
        : '',
      expected: redactTechnicalText(
        serializedDetail(detail.expected ?? 'NOT_AVAILABLE'),
        sensitiveValues,
      ).slice(0, 64 * 1024),
      actual: redactTechnicalText(
        serializedDetail(detail.actual ?? 'NOT_AVAILABLE'),
        sensitiveValues,
      ).slice(0, 64 * 1024),
      exitCode: Number.isInteger(detail.exitCode) ? detail.exitCode : null,
      signal: typeof detail.signal === 'string' ? detail.signal : null,
      timedOut: detail.timedOut === true,
    },
  }
}

function primaryFailureSnapshotV3(envelope) {
  return Object.fromEntries(primaryFailureKeys.map((key) => [key, envelope[key]]))
}

function assertPrimaryFailureImmutableV3(envelope) {
  const snapshot = primaryFailureSnapshotV3(envelope)
  const snapshotHash = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex')
  if (
    JSON.stringify(envelope.primaryFailure) !== JSON.stringify(snapshot)
    || envelope.primaryFailureSha256 !== snapshotHash
  ) fail('V3_PRIMARY_FAILURE_TAMPERED')
}

function privateFailurePath(envelope) {
  return path.join(
    privateRoot,
    `v3-failure-${envelope.runId}-${Date.now()}.json`,
  )
}

export function persistPrivateFailureEnvelopeV3(envelope) {
  mkdirSync(privateRoot, { recursive: true })
  const reportPath = privateFailurePath(envelope)
  writeFileSync(reportPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  verifyPrivateFailureEnvelopeV3(reportPath, envelope.runId)
  return reportPath
}

export function verifyPrivateFailureEnvelopeV3(reportPath, expectedRunId) {
  const resolved = path.resolve(reportPath)
  if (!resolved.startsWith(`${path.resolve(privateRoot)}${path.sep}`)) {
    fail('V3_FAILURE_ENVELOPE_LOCATION_REJECTED')
  }
  const parsed = JSON.parse(readFileSync(resolved, 'utf8'))
  if (
    parsed.version !== 3
    || parsed.runId !== expectedRunId
    || parsed.automaticRetryCount !== 0
  ) fail('V3_FAILURE_ENVELOPE_UNREADABLE')
  assertPrimaryFailureImmutableV3(parsed)
  return parsed
}

export function applyFailureEnvelopeUpdateV3(current, patch) {
  assertPrimaryFailureImmutableV3(current)
  const patchKeys = Object.keys(patch)
  if (
    patchKeys.some((key) => !mutableFailureKeys.has(key))
    || (patch.recoveryOutcome !== undefined
      && !['not_required', 'failed', 'restored'].includes(patch.recoveryOutcome))
    || (patch.recoveryStarted !== undefined
      && typeof patch.recoveryStarted !== 'boolean')
    || (patch.recoveryFailure !== undefined
      && patch.recoveryFailure !== null
      && (typeof patch.recoveryFailure !== 'object'
        || Array.isArray(patch.recoveryFailure)))
  ) fail('V3_FAILURE_ENVELOPE_UPDATE_REJECTED')
  const updated = { ...current, ...patch }
  assertPrimaryFailureImmutableV3(updated)
  return updated
}

export function updatePrivateFailureEnvelopeV3(reportPath, patch) {
  const current = verifyPrivateFailureEnvelopeV3(
    reportPath,
    JSON.parse(readFileSync(reportPath, 'utf8')).runId,
  )
  const updated = applyFailureEnvelopeUpdateV3(current, patch)
  const temporaryPath = `${reportPath}.next`
  writeFileSync(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporaryPath, reportPath)
  verifyPrivateFailureEnvelopeV3(reportPath, updated.runId)
  return updated
}

function writePrivateReport(status, gitHead, detail) {
  mkdirSync(privateRoot, { recursive: true })
  const reportPath = path.join(
    privateRoot,
    `v3-run-${gitHead.slice(0, 12)}-${Date.now()}-${status.toLowerCase()}.json`,
  )
  writeFileSync(reportPath, `${JSON.stringify({
    version: 3,
    status,
    gitHead,
    projectRef: QA_REF,
    migrationSha256: MIGRATION_SHA256,
    detail,
    createdAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return reportPath
}

function transitionPrivateSuccessReport(reportPath, nextStatus) {
  const resolved = path.resolve(reportPath)
  if (!resolved.startsWith(`${path.resolve(privateRoot)}${path.sep}`)) {
    fail('V3_SUCCESS_REPORT_LOCATION_REJECTED')
  }
  const report = JSON.parse(readFileSync(resolved, 'utf8'))
  if (
    report.version !== 3
    || !['PASS_PENDING_LEDGER', 'PASS'].includes(report.status)
    || !['PASS', 'INVALIDATED_RECOVERING'].includes(nextStatus)
  ) fail('V3_SUCCESS_REPORT_TRANSITION_REJECTED')
  const temporaryPath = `${resolved}.next`
  writeFileSync(temporaryPath, `${JSON.stringify({
    ...report,
    status: nextStatus,
    statusUpdatedAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(temporaryPath, resolved)
  return resolved
}

function finalizePrivateSuccessReport(reportPath) {
  return transitionPrivateSuccessReport(reportPath, 'PASS')
}

function invalidatePrivateSuccessReport(reportPath) {
  return transitionPrivateSuccessReport(reportPath, 'INVALIDATED_RECOVERING')
}

function comparePrestate(prestate, restored) {
  validatePrestateV2(restored)
  for (const key of comparisonKeys) {
    if (restored[key] !== prestate[key]) {
      fail('V3_RECOVERY_PRESTATE_DRIFT', {
        assertion: key,
        object: 'protected-prestate',
        expected: 'UNCHANGED',
        actual: 'MISMATCH',
      })
    }
  }
}

function capturePoststate(environment, stage) {
  return withOperationalState(parseSingleJsonV3(runPsqlFile(
    frozenPostcheckPath,
    {},
    environment,
    { stage },
  )), environment, `${stage}_operational`)
}

function reconcileContractState(environment, runId) {
  const state = parseSingleJsonV3(runPsqlFile(
    precheckPath,
    { project_ref: QA_REF, v2_run_id: v2RunIdFor(runId) },
    environment,
    { stage: 'apply_reconciliation' },
  ))
  const counts = [
    state.targetFunctionCount,
    state.targetColumnCount,
    state.targetConstraintCount,
    state.targetIndexCount,
  ]
  if (
    counts.every((count) => count === 0)
    && state.broadCustomerPolicyCount === 2
    && state.legacyServiceGrantCount === 2
  ) return false
  if (
    state.targetFunctionCount === 7
    && state.targetColumnCount === 4
    && state.targetConstraintCount === 2
    && state.targetIndexCount === 4
    && state.broadCustomerPolicyCount === 0
    && state.legacyServiceGrantCount === 0
  ) return true
  return null
}

function captureDetailedPostcheck(environment, stage) {
  return parseEnvelopeV3(runPsqlFile(
    postcheckPath,
    {},
    environment,
    { stage },
  ), 'postcheck')
}

async function preEffectV3(environment, runId) {
  verifyPackageManifestV3()
  const gitState = assertGitStateV3(
    currentGitStateV2(),
    environment.CP3B2A_V3_AUTHORIZED_HEAD,
  )
  assertAuthorizationV3(environment, gitState)
  const backup = verifyPrivateBackupV3(
    environment.CP3B2A_PRIVATE_BACKUP_MANIFEST,
    gitState.head,
  )
  parseDatabaseTarget(environment)
  assertLocalQaLink()
  assertCliQaLink(environment)
  const prestate = withOperationalState(parseSingleJsonV3(runPsqlFile(
    precheckPath,
    { project_ref: QA_REF, v2_run_id: v2RunIdFor(runId) },
    environment,
    { stage: 'precheck' },
  )), environment, 'precheck_operational_state')
  validatePrestateV2(prestate)
  assertNoSyntheticCollisionsV3(syntheticCollisionCount(environment, runId))
  assertExactRecoveredBoundaryV3(environment, 'precheck_exact_boundary')
  verifyBackupMatchesPrestateV3(backup, prestate)
  if (exactBoundaryDigest(environment) !== backup.boundaryDigest) {
    fail('V3_BACKUP_BOUNDARY_DRIFT')
  }
  return {
    gitState,
    backup,
    backupManifestPath: environment.CP3B2A_PRIVATE_BACKUP_MANIFEST,
    prestate,
    runId,
  }
}

function assertRequiredOperations(operations) {
  for (const name of [
    'preEffect',
    'createLedger',
    'updateLedger',
    'persistFailure',
    'verifyFailure',
    'updateFailure',
    'apply',
    'postcheckState',
    'postcheckDetails',
    'matrix',
    'residue',
    'finalPostcheckState',
    'finalPostcheckDetails',
    'reconcile',
    'recoveryEligibility',
    'rollback',
    'parseRollback',
    'recoveryPrecheck',
    'boundaryDigest',
    'writeSuccessCandidate',
    'finalizeSuccessReport',
    'invalidateSuccessCandidate',
  ]) {
    if (typeof operations[name] !== 'function') fail('V3_TEST_HARNESS_INCOMPLETE')
  }
}

function realOperations(environment, runId) {
  return {
    preEffect: () => preEffectV3(environment, runId),
    createLedger: createAttemptLedger,
    updateLedger,
    persistFailure: persistPrivateFailureEnvelopeV3,
    verifyFailure: verifyPrivateFailureEnvelopeV3,
    updateFailure: updatePrivateFailureEnvelopeV3,
    apply: () => runPsqlFile(
      migrationPath, {}, environment, { capture: false, stage: 'apply' },
    ),
    postcheckState: (context, stage) => capturePoststate(environment, stage, context),
    postcheckDetails: (_context, stage) => captureDetailedPostcheck(environment, stage),
    matrix: (context) => parseEnvelopeV3(runPsqlFile(
      matrixPath,
      { project_ref: QA_REF, run_id: context.runId },
      environment,
      { stage: 'matrix' },
    ), 'matrix'),
    residue: (context) => {
      const collision = syntheticCollisionCount(environment, context.runId)
      const operational = captureOperationalState(environment, 'residue_operational_state')
      for (const key of ['auditRows', 'auditDigest', 'rateRows', 'rateDigest']) {
        if (operational[key] !== context.prestate[key]) {
          fail('V3_OPERATIONAL_RESIDUE', {
            assertion: 'V3-HISTORICAL-DIGEST',
            object: key,
            expected: 'UNCHANGED',
            actual: 'DRIFT',
          })
        }
      }
      return collision
    },
    finalPostcheckState: (context, stage) => capturePoststate(environment, stage, context),
    finalPostcheckDetails: (_context, stage) => captureDetailedPostcheck(environment, stage),
    reconcile: (context) => reconcileContractState(environment, context.runId),
    recoveryEligibility: (context) => {
      if (reconcileContractState(environment, context.runId) !== true) {
        fail('V3_RECOVERY_TARGET_STATE_REJECTED')
      }
      const operational = captureOperationalState(environment, 'recovery_eligibility')
      for (const key of ['auditRows', 'auditDigest', 'rateRows', 'rateDigest']) {
        if (operational[key] !== context.prestate[key]) {
          fail('V3_RECOVERY_CONCURRENT_DRIFT')
        }
      }
      return true
    },
    rollback: () => runPsqlFile(
      rollbackPath,
      {},
      environment,
      { stage: 'recovery' },
    ),
    parseRollback: (output) => ({
      legacy: parseJsonOutputV2(output),
      envelope: parseEnvelopeV3(output, 'rollback'),
    }),
    recoveryPrecheck: (context) => withOperationalState(parseSingleJsonV3(
      runPsqlFile(
        precheckPath,
        { project_ref: QA_REF, v2_run_id: v2RunIdFor(context.runId) },
        environment,
        { stage: 'recovery_precheck' },
      ),
    ), environment, 'recovery_operational_state'),
    boundaryDigest: () => exactBoundaryDigest(environment),
    writeSuccessCandidate: (context, detail) => writePrivateReport(
      'PASS_PENDING_LEDGER',
      context.gitState.head,
      detail,
    ),
    finalizeSuccessReport: finalizePrivateSuccessReport,
    invalidateSuccessCandidate: invalidatePrivateSuccessReport,
  }
}

async function executeV3Core(environment, operations, runId) {
  assertRequiredOperations(operations)
  const stages = []
  let stage = 'pre_effect'
  let recoveryAttempts = 0
  let context
  let ledgerPath
  let failureReportPath
  let successReportPath
  const sensitiveValues = sensitiveValuesFrom(environment)
  const runtime = {
    applyStarted: false,
    applyCommitted: false,
    postcheckStarted: false,
    matrixStarted: false,
    ledgerCompleted: false,
    successCandidateInvalidationFailed: false,
  }
  try {
    context = await operations.preEffect(environment, runId)
    stage = 'attempt_ledger_create'
    ledgerPath = operations.createLedger(context)
    stages.push('attempt_ledger_created')
    stage = 'apply'
    runtime.applyStarted = true
    operations.updateLedger(ledgerPath, 'apply_started', context)
    stages.push('apply_started')
    await operations.apply(context)
    runtime.applyCommitted = true
    operations.updateLedger(ledgerPath, 'apply_committed', context)
    stages.push('apply_committed')

    stage = 'postcheck'
    runtime.postcheckStarted = true
    stages.push('postcheck_started')
    const poststate = await operations.postcheckState(context, 'postcheck_state')
    stages.push('postcheck_json_received')
    validateStateV3(context.prestate, poststate)
    const details = await operations.postcheckDetails(context, 'postcheck_details')
    validateDetailedPostcheckV3(details)
    stages.push('postcheck_validated')

    stage = 'matrix'
    runtime.matrixStarted = true
    stages.push('matrix_started')
    const matrix = await operations.matrix(context)
    stages.push('matrix_json_received')
    if (matrix.result !== 'PASS' || matrix.transaction !== 'ROLLED_BACK') {
      fail('V3_MATRIX_REJECTED', {
        assertion: 'V3-MATRIX-TRANSACTION',
        object: 'matrix',
        expected: 'PASS_ROLLED_BACK',
        actual: boundedSanitizedSummary(matrix),
        postgresOutputReceived: true,
        jsonOutputReceived: true,
      })
    }
    stages.push('matrix_validated')

    stage = 'residue'
    stages.push('residue_started')
    const residue = await operations.residue(context)
    if (residue !== 0) fail('V3_SYNTHETIC_RESIDUE')
    stages.push('residue_validated')

    stage = 'final_postcheck'
    stages.push('final_postcheck_started')
    validateStateV3(
      context.prestate,
      await operations.finalPostcheckState(context, 'final_postcheck_state'),
    )
    validateDetailedPostcheckV3(
      await operations.finalPostcheckDetails(context, 'final_postcheck_details'),
    )
    stages.push('final_postcheck_validated')
    successReportPath = operations.writeSuccessCandidate(context, {
      stages,
      applyAttempts: 1,
      recoveryAttempts: 0,
      matrix: 'PASS_ROLLED_BACK',
      residue: 0,
    })
    operations.updateLedger(ledgerPath, 'completed', context)
    runtime.ledgerCompleted = true
    operations.finalizeSuccessReport(successReportPath)
    return {
      verdict: 'PASS',
      target: 'QA_MATCH',
      applyAttempts: 1,
      recoveryAttempts: 0,
      automaticRetries: 0,
      stages,
    }
  } catch (primaryError) {
    if (runtime.ledgerCompleted) throw primaryError
    if (successReportPath) {
      try {
        operations.invalidateSuccessCandidate(successReportPath)
      } catch (invalidationError) {
        // A candidate is never a PASS report. Preserve it for manual diagnosis
        // if local invalidation itself fails; recovery still takes precedence.
        runtime.successCandidateInvalidationFailed = invalidationError !== null
      }
    }
    const envelope = buildFailureEnvelopeV3({
      error: primaryError,
      stage,
      runId,
      stages,
      runtime,
      sensitiveValues,
    })
    failureReportPath = operations.persistFailure(envelope)
    operations.verifyFailure(failureReportPath, runId)

    const closeFailure = (patch) => {
      const updated = operations.updateFailure(failureReportPath, patch)
      fail('V3_EXECUTION_FAILED', {
        publicFailure: publicFailureSummaryV3(updated),
      })
    }

    if (!runtime.applyStarted) {
      closeFailure({ recoveryOutcome: 'not_required' })
    }

    if (!runtime.applyCommitted) {
      let contractState = null
      try {
        contractState = await operations.reconcile(context)
      } catch (reconcileError) {
        const recoveryFailure = sanitizeFailureV3(
          reconcileError,
          'apply_reconciliation',
          sensitiveValues,
        )
        closeFailure({
          recoveryOutcome: 'failed',
          recoveryFailure,
        })
      }
      if (contractState === false) {
        if (ledgerPath) {
          operations.updateLedger(ledgerPath, 'blocked_no_contract', context)
        }
        closeFailure({ recoveryOutcome: 'not_required' })
      }
      if (ledgerPath) {
        operations.updateLedger(ledgerPath, 'manual_verification_required', context)
      }
      closeFailure({ recoveryOutcome: 'failed' })
    }

    try {
      await operations.recoveryEligibility(context)
    } catch (eligibilityError) {
      const recoveryFailure = sanitizeFailureV3(
        eligibilityError,
        'recovery_eligibility',
        sensitiveValues,
      )
      if (ledgerPath) {
        operations.updateLedger(ledgerPath, 'manual_verification_required', context)
      }
      closeFailure({
        recoveryOutcome: 'failed',
        recoveryFailure,
      })
    }
    recoveryAttempts += 1
    stages.push('recovery_started')
    operations.updateFailure(failureReportPath, {
      recoveryStarted: true,
      recoveryOutcome: 'failed',
    })
    let recoveryRestored = false
    try {
      const rollbackOutput = await operations.rollback(context)
      const { legacy: rollback, envelope: rollbackEnvelope }
        = await operations.parseRollback(rollbackOutput)
      if (
        rollback.result !== 'PASS'
        || rollback.contractAbsent !== true
        || rollback.customerPoliciesRestored !== true
        || rollback.legacyServiceGrantsRestored !== true
        || rollbackEnvelope.result !== 'PASS'
      ) fail('V3_RECOVERY_CONTRACT_PRESENT')
      const restored = await operations.recoveryPrecheck(context)
      comparePrestate(context.prestate, restored)
      if (await operations.boundaryDigest(context) !== context.backup.boundaryDigest) {
        fail('V3_RECOVERY_BOUNDARY_DRIFT')
      }
      stages.push('recovery_validated')
      if (ledgerPath) operations.updateLedger(ledgerPath, 'blocked_recovered', context)
      recoveryRestored = true
    } catch (recoveryError) {
      const recoveryFailure = sanitizeFailureV3(
        recoveryError,
        'recovery',
        sensitiveValues,
      )
      if (ledgerPath) {
        operations.updateLedger(ledgerPath, 'manual_verification_required', context)
      }
      closeFailure({
        recoveryStarted: true,
        recoveryOutcome: 'failed',
        recoveryFailure,
      })
    }
    if (recoveryRestored) {
      closeFailure({
        recoveryStarted: true,
        recoveryOutcome: 'restored',
      })
    }
  }
}

export async function executeV3(environment) {
  const runId = makeRunId()
  return executeV3Core(environment, realOperations(environment, runId), runId)
}

export async function executeV3TestHarness(environment, operations, runId) {
  return executeV3Core(environment, operations, runId)
}

export function assertNoSecretsV3(environment, argv, output = '') {
  const secrets = secretNames
    .map((name) => environment[name])
    .filter((value) => typeof value === 'string' && value.length > 0)
  const combined = `${argv.join('\n')}\n${output}`
  if (secrets.some((secret) => combined.includes(secret))) {
    fail('V3_SECRET_EXPOSURE_REJECTED')
  }
  return true
}

export function planV3() {
  verifyPackageManifestV3()
  return {
    gate: 'CP-3B.2A.3',
    mode: 'plan',
    status: PACKAGE_STATUS,
    qaApplication: 'READY_PENDING_EXPLICIT_V3_AUTHORIZATION',
    authorizationId: AUTHORIZATION_ID,
    v2AuthorizationReusable: false,
    target: 'QA_ONLY',
    production: 'REJECTED',
    migrationSha256: MIGRATION_SHA256,
    correctiveMigrationRequired: false,
    commands: ['--plan', '--preflight', '--execute'],
    executeAlias: false,
    preEffectOrder: PRE_EFFECT_ORDER,
    remoteWrites: 0,
  }
}

export function preflightV3(environment, dependencies = {}) {
  verifyPackageManifestV3()
  const gitState = assertGitStateV3(
    dependencies.gitState ?? currentGitStateV2(dependencies),
  )
  parseDatabaseTarget(environment)
  ;(dependencies.assertLocalQaLink ?? assertLocalQaLink)()
  ;(dependencies.assertCliQaLink ?? (() => assertCliQaLink(environment, dependencies)))()
  const runId = makeRunId()
  const prestate = withOperationalState(parseSingleJsonV3(runPsqlFile(
    precheckPath,
    { project_ref: QA_REF, v2_run_id: v2RunIdFor(runId) },
    environment,
    { stage: 'preflight_read' },
  )), environment, 'preflight_operational_state')
  validatePrestateV2(prestate)
  assertNoSyntheticCollisionsV3(syntheticCollisionCount(environment, runId))
  assertExactRecoveredBoundaryV3(environment, 'preflight_exact_boundary')
  const privateBackupManifest = createPrivateBackupV3(
    environment,
    gitState.head,
    prestate,
  )
  verifyPrivateBackupV3(privateBackupManifest, gitState.head)
  return {
    gate: 'CP-3B.2A.3',
    mode: 'preflight',
    status: 'READY_FOR_CP3B2A_QA_V3',
    target: 'QA_MATCH',
    gitHead: gitState.head,
    originalHashes: '10/10_PASS',
    v2Hashes: '9/9_PASS',
    v3Hashes: 'PASS',
    prestate: 'RECOVERED_CONTRACT_ABSENT',
    privateBackup: 'COMPLETE_HEAD_BOUND',
    authorization: 'NOT_GRANTED',
    remoteWrites: 0,
  }
}

async function main() {
  const mode = assertModeV3(process.argv.slice(2))
  assertNoSecretsV3(process.env, process.argv.slice(2))
  if (mode === '--plan') {
    process.stdout.write(`${JSON.stringify(planV3(), null, 2)}\n`)
    return
  }
  if (mode === '--preflight') {
    process.stdout.write(`${JSON.stringify(preflightV3(process.env), null, 2)}\n`)
    return
  }
  process.stdout.write(`${JSON.stringify(await executeV3(process.env), null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const publicFailure = error instanceof DiagnosticError
      ? error.detail?.publicFailure
      : null
    if (publicFailure) {
      process.stderr.write(`${JSON.stringify(publicFailure)}\n`)
    } else {
      const sanitized = sanitizeFailureV3(error, 'entrypoint')
      process.stderr.write(`BLOCKED: ${sanitized.failureCode}\n`)
    }
    process.exitCode = 1
  })
}
