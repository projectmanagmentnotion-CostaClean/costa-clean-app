import { createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runCommandV3,
  runSupabaseCliV3,
} from './cp2b_command_launcher_v3.mjs'
import {
  preparePostgresEnvironmentV5,
  runPsqlV5,
} from './cp2b_postgres_transport_v5.mjs'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
export const AUTHORIZATION_ID = 'CP3B0-QA-V2-AUTHORIZATION-PENDING'
export const MIGRATION_SHA256 =
  'c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731'
export const PRE_EFFECT_ORDER = Object.freeze([
  'manifest_and_hashes',
  'authorization_and_head',
  'clean_worktree',
  'private_backup',
  'local_qa_link',
  'supabase_cli_qa_link',
  'production_not_linked',
  'postgres_live_read',
  'postgres_qa_target',
  'cp2b_prerequisite',
  'function_absent',
  'catalog_prestate',
  'grants_and_policy_digest',
  'synthetic_collision_check',
  'postgres_pre_effect_check',
  'apply',
])

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptsDir = path.join(repoRoot, 'scripts', 'client-portal')
const privateRoot = path.join(repoRoot, '.git', 'cp3b0-private')
const v1ManifestPath = path.join(scriptsDir, 'cp3b0_self_access_context.manifest.json')
const v2ManifestPath = path.join(scriptsDir, 'cp3b0_qa_package_v2.manifest.json')
const cp2bManifestPath = path.join(scriptsDir, 'cp2b_qa_package_v5.manifest.json')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260728120000_portal_self_access_context.sql',
)
const precheckPath = path.join(scriptsDir, 'cp3b0_qa_precheck_v2.sql')
const postcheckPath = path.join(scriptsDir, 'cp3b0_qa_postcheck_v2.sql')
const matrixPath = path.join(scriptsDir, 'cp3b0_qa_matrix_v2.sql')
const rollbackPath = path.join(scriptsDir, 'cp3b0_qa_rollback_v2.sql')
const secretEnvironmentNames = Object.freeze([
  'CP2B_QA_DATABASE_URL',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
  'CP3B0_PRIVATE_BACKUP_MANIFEST',
])
const safeProcessEnvironmentNames = Object.freeze([
  'PATH',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'PATHEXT',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'TZ',
])

function fail(code) {
  throw new Error(code)
}

function minimalProcessEnvironment(environment, extraNames = []) {
  const allowed = [...safeProcessEnvironmentNames, ...extraNames]
  return Object.fromEntries(allowed.flatMap((name) => (
    typeof environment[name] === 'string' && environment[name].length > 0
      ? [[name, environment[name]]]
      : []
  )))
}

export function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

export function assertArtifactHashV2(filePath, expectedSha256) {
  if (!existsSync(filePath) || sha256(filePath) !== expectedSha256) {
    fail('artifact_hash_mismatch')
  }
  return true
}

function artifactPath(relativePath) {
  const resolved = path.resolve(repoRoot, relativePath)
  if (!resolved.startsWith(`${repoRoot}${path.sep}`)) fail('artifact_path_rejected')
  return resolved
}

function verifyArtifacts(artifacts, errorCode) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) fail(errorCode)
  for (const artifact of artifacts) {
    const filePath = artifactPath(artifact.path)
    if (!existsSync(filePath) || sha256(filePath) !== artifact.sha256) fail(errorCode)
  }
}

export function verifyFrozenChainV2() {
  const v1 = JSON.parse(readFileSync(v1ManifestPath, 'utf8'))
  if (
    v1.version !== 1
    || v1.status !== 'PREPARED_NOT_AUTHORIZED'
    || v1.qaProjectRef !== QA_REF
    || v1.prohibitedProductionRef !== PRODUCTION_REF
    || v1.artifacts.length !== 9
  ) fail('v1_manifest_rejected')
  verifyArtifacts(v1.artifacts, 'v1_hash_mismatch')
  if (v1.migrationSha256 !== MIGRATION_SHA256 || sha256(migrationPath) !== MIGRATION_SHA256) {
    fail('migration_hash_mismatch')
  }

  const cp2b = JSON.parse(readFileSync(cp2bManifestPath, 'utf8'))
  if (
    cp2b.version !== 5
    || cp2b.qaProjectRef !== QA_REF
    || cp2b.prohibitedProductionRef !== PRODUCTION_REF
  ) fail('cp2b_manifest_rejected')
  verifyArtifacts([
    ...cp2b.artifacts,
    ...cp2b.reusedV4Artifacts,
    ...cp2b.reusedV3Artifacts,
    ...cp2b.reusedV2Artifacts,
    ...cp2b.reusedOriginalArtifacts,
  ], 'cp2b_hash_mismatch')

  return {
    v1,
    cp2b,
    v1ManifestSha256: sha256(v1ManifestPath),
    cp2bV5ManifestSha256: sha256(cp2bManifestPath),
  }
}

export function verifyPackageManifestV2() {
  const frozen = verifyFrozenChainV2()
  const manifest = JSON.parse(readFileSync(v2ManifestPath, 'utf8'))
  if (
    manifest.version !== 2
    || manifest.gate !== 'CP-3B.0A'
    || manifest.status !== 'PREPARED_NOT_AUTHORIZED'
    || manifest.authorizationId !== AUTHORIZATION_ID
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.migration !== path.relative(repoRoot, migrationPath).replaceAll('\\', '/')
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || manifest.v1ManifestSha256 !== frozen.v1ManifestSha256
    || manifest.cp2bV5ManifestSha256 !== frozen.cp2bV5ManifestSha256
    || manifest.executeAlias !== false
    || JSON.stringify(manifest.preEffectOrder) !== JSON.stringify(PRE_EFFECT_ORDER)
  ) fail('v2_manifest_rejected')
  verifyArtifacts(manifest.artifacts, 'v2_hash_mismatch')
  return { manifest, ...frozen }
}

function gitOutput(args) {
  return runCommandV3('git', args, {
    cwd: repoRoot,
    environment: minimalProcessEnvironment(process.env),
    redactFailure: true,
  }).stdout.trim()
}

export function currentGitStateV2(dependencies = {}) {
  const runGit = dependencies.git ?? gitOutput
  const head = runGit(['rev-parse', 'HEAD'])
  const remoteHead = runGit(['rev-parse', 'origin/main'])
  const branch = runGit(['branch', '--show-current'])
  const clean = runGit(['status', '--porcelain']) === ''
  const divergence = runGit(['rev-list', '--left-right', '--count', 'HEAD...origin/main'])
    .split(/\s+/u)
    .map(Number)
  return { head, remoteHead, branch, clean, divergence }
}

export function assertAuthorizationAndHeadV2(environment, gitState) {
  if (environment.CP3B0_PROJECT_REF === PRODUCTION_REF) fail('production_target_rejected')
  if (environment.CP3B0_EXECUTION_AUTHORIZED !== 'true') fail('execution_not_authorized')
  if (environment.CP3B0_PROJECT_REF !== QA_REF) fail('qa_target_required')
  if (environment.CP3B0_V2_AUTHORIZATION_ID !== AUTHORIZATION_ID) {
    fail('v2_authorization_mismatch')
  }
  if (
    !environment.CP3B0_V2_AUTHORIZED_HEAD
    || environment.CP3B0_V2_AUTHORIZED_HEAD !== gitState.head
    || gitState.remoteHead !== gitState.head
    || gitState.branch !== 'main'
    || gitState.divergence[0] !== 0
    || gitState.divergence[1] !== 0
  ) fail('git_authorization_mismatch')
  return true
}

export function assertCleanWorktreeV2(gitState) {
  if (!gitState.clean) fail('dirty_worktree_rejected')
}

function assertPrivatePath(filePath) {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(`${privateRoot}${path.sep}`)) fail('private_path_rejected')
  return resolved
}

export function verifyPrivateBackupV2(manifestFile, expectedHead) {
  if (!manifestFile) fail('private_backup_missing')
  const resolvedManifest = assertPrivatePath(manifestFile)
  if (!existsSync(resolvedManifest)) fail('private_backup_missing')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(resolvedManifest, 'utf8'))
  } catch {
    fail('private_backup_invalid')
  }
  if (
    manifest.version !== 1
    || manifest.status !== 'COMPLETE'
    || manifest.projectRef !== QA_REF
    || manifest.gitHead !== expectedHead
    || !Array.isArray(manifest.artifacts)
    || manifest.artifacts.length !== 8
  ) fail('private_backup_invalid')
  for (const artifact of manifest.artifacts) {
    const privatePath = assertPrivatePath(artifact.path)
    if (
      !existsSync(privatePath)
      || !/^[0-9a-f]{64}$/u.test(artifact.sha256)
      || sha256(privatePath) !== artifact.sha256
    ) fail('private_backup_invalid')
  }
  return manifest
}

function makeRunId() {
  return `CP3B0-V2-${randomBytes(6).toString('hex').toUpperCase()}`
}

function psqlFileCapture(filePath, variables, environment, dependencies = {}) {
  const runner = dependencies.runPsql ?? runPsqlV5
  const args = ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1']
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  const result = runner(args, {
    environment,
    cwd: repoRoot,
    timeout: 120_000,
  })
  return parseJsonOutput(result.stdout)
}

function psqlFileRun(filePath, variables, environment, dependencies = {}) {
  const runner = dependencies.runPsql ?? runPsqlV5
  const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1']
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  return runner(args, {
    environment,
    cwd: repoRoot,
    timeout: 120_000,
  })
}

function psqlQueryCapture(sql, environment, dependencies = {}) {
  const runner = dependencies.runPsql ?? runPsqlV5
  const result = runner(
    ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1'],
    { environment, cwd: repoRoot, timeout: 120_000, input: sql },
  )
  return result.stdout.trim()
}

export function parseJsonOutput(output) {
  const lines = String(output).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index])
    } catch {
      // psql can emit non-data status lines around the final JSON value.
    }
  }
  fail('postgres_output_rejected')
}

function validateDatabaseEnvironment(environment) {
  const prepared = preparePostgresEnvironmentV5(environment)
  if (prepared.target !== 'QA_MATCH') fail('database_target_rejected')
  return prepared
}

export function validatePrestateV2(prestate) {
  if (
    prestate.liveRead !== 1
    || prestate.cp2bPrerequisite !== true
    || prestate.selfContextCount !== 0
    || prestate.portalTables !== 11
    || prestate.syntheticCollisions !== 0
    || typeof prestate.tableGrantDigest !== 'string'
    || typeof prestate.policyDigest !== 'string'
    || typeof prestate.otherPortalFunctionDigest !== 'string'
    || typeof prestate.migrationHistoryDigest !== 'string'
  ) fail('postgres_prestate_rejected')
  return prestate
}

function assertLocalLinkV2() {
  const ref = readFileSync(
    path.join(repoRoot, 'supabase', '.temp', 'project-ref'),
    'utf8',
  ).trim()
  if (ref !== QA_REF || ref === PRODUCTION_REF) fail('local_link_rejected')
}

function readCliProjectsV2(environment, dependencies = {}) {
  const cli = dependencies.runCli ?? ((args) => runSupabaseCliV3(
    ['--workdir', repoRoot, ...args],
    {
      repoRoot,
      cwd: process.env.TEMP ?? process.env.TMPDIR ?? repoRoot,
      environment: minimalProcessEnvironment(environment, ['SUPABASE_ACCESS_TOKEN']),
      redactFailure: true,
      timeout: 120_000,
    },
  ).stdout)
  let projects
  try {
    projects = JSON.parse(cli(['projects', 'list', '--output', 'json']))
  } catch {
    fail('supabase_cli_catalog_rejected')
  }
  if (!Array.isArray(projects)) fail('supabase_cli_catalog_rejected')
  return projects
}

function assertCliQaLinkedV2(projects) {
  if (!projects.some((project) => project.id === QA_REF && project.linked === true)) {
    fail('supabase_cli_qa_link_rejected')
  }
}

function assertProductionNotLinkedV2(projects) {
  if (projects.some((project) => project.id === PRODUCTION_REF && project.linked === true)) {
    fail('production_link_rejected')
  }
}

function snapshotQueries() {
  return {
    'catalog-functions.json': String.raw`
      select coalesce(jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'signature', p.oid::regprocedure::text,
        'owner', r.rolname,
        'securityDefiner', p.prosecdef,
        'volatility', p.provolatile,
        'config', p.proconfig,
        'definition', pg_get_functiondef(p.oid)
      ) order by n.nspname, p.oid::regprocedure::text), '[]'::jsonb)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles r on r.oid = p.proowner
      where n.nspname in ('public', 'portal_private')
        and p.proname like 'portal_%';`,
    'grants.json': String.raw`
      select jsonb_build_object(
        'tables', coalesce((select jsonb_agg(to_jsonb(x) order by
          x.table_schema, x.table_name, x.grantee, x.privilege_type)
          from information_schema.role_table_grants x
          where x.table_schema in ('public', 'storage')), '[]'::jsonb),
        'routines', coalesce((select jsonb_agg(to_jsonb(x) order by
          x.routine_schema, x.routine_name, x.grantee, x.privilege_type)
          from information_schema.role_routine_grants x
          where x.routine_schema in ('public', 'portal_private')), '[]'::jsonb)
      );`,
    'owners.json': String.raw`
      select jsonb_build_object(
        'relations', coalesce((select jsonb_agg(jsonb_build_object(
          'schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
          'owner', r.rolname
        ) order by n.nspname, c.relname)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        join pg_roles r on r.oid = c.relowner
        where n.nspname in ('public', 'portal_private', 'storage')), '[]'::jsonb),
        'functions', coalesce((select jsonb_agg(jsonb_build_object(
          'schema', n.nspname, 'signature', p.oid::regprocedure::text,
          'owner', r.rolname
        ) order by n.nspname, p.oid::regprocedure::text)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        join pg_roles r on r.oid = p.proowner
        where n.nspname in ('public', 'portal_private')), '[]'::jsonb)
      );`,
    'policies.json': String.raw`
      select coalesce(jsonb_agg(to_jsonb(p) order by
        p.schemaname, p.tablename, p.policyname), '[]'::jsonb)
      from pg_policies p where p.schemaname in ('public', 'storage');`,
    'migration-history.json': String.raw`
      select coalesce(jsonb_agg(jsonb_build_object(
        'version', version, 'name', name
      ) order by version), '[]'::jsonb)
      from supabase_migrations.schema_migrations;`,
  }
}

export function createPrivateBackupV2({
  environment,
  gitHead,
  prestate,
  dependencies = {},
}) {
  validateDatabaseEnvironment(environment)
  mkdirSync(privateRoot, { recursive: true })
  const suffix = `${gitHead.slice(0, 12)}-${Date.now()}-${randomBytes(4).toString('hex')}`
  const backupDir = path.join(privateRoot, `backup-${suffix}`)
  mkdirSync(backupDir, { recursive: false })

  const prepared = preparePostgresEnvironmentV5(environment)
  const pgDump = dependencies.pgDump ?? runCommandV3
  const schemaPath = path.join(backupDir, 'schema-only.sql')
  const pgDumpExecutable = process.platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe'
    : 'pg_dump'
  pgDump(pgDumpExecutable, [
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '--file',
    schemaPath,
  ], {
    cwd: repoRoot,
    environment: prepared.environment,
    redactFailure: true,
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
  })

  const artifactPaths = [schemaPath]
  for (const [name, sql] of Object.entries(snapshotQueries())) {
    const filePath = path.join(backupDir, name)
    const content = psqlQueryCapture(sql, environment, dependencies)
    writeFileSync(filePath, `${content}\n`, { encoding: 'utf8', mode: 0o600 })
    artifactPaths.push(filePath)
  }
  const digestsPath = path.join(backupDir, 'digests.json')
  writeFileSync(digestsPath, `${JSON.stringify({
    portalRowCount: prestate.portalRowCount,
    tableGrantDigest: prestate.tableGrantDigest,
    policyDigest: prestate.policyDigest,
    otherPortalFunctionCount: prestate.otherPortalFunctionCount,
    otherPortalFunctionDigest: prestate.otherPortalFunctionDigest,
    migrationHistoryCount: prestate.migrationHistoryCount,
    migrationHistoryDigest: prestate.migrationHistoryDigest,
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  artifactPaths.push(digestsPath)

  const prestatePath = path.join(backupDir, 'catalog-prestate.json')
  writeFileSync(prestatePath, `${JSON.stringify(prestate, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  artifactPaths.push(prestatePath)

  const manifestPath = path.join(backupDir, 'private-backup-manifest.json')
  const manifest = {
    version: 1,
    status: 'COMPLETE',
    projectRef: QA_REF,
    gitHead,
    createdAt: new Date().toISOString(),
    artifacts: artifactPaths.map((filePath) => ({
      path: filePath,
      sha256: sha256(filePath),
    })),
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  verifyPrivateBackupV2(manifestPath, gitHead)
  return manifestPath
}

function comparePostcheckV2(prestate, poststate) {
  const catalogPass = (
    poststate.signatureCount === 1
    && poststate.parameterCount === 0
    && poststate.returnType === 'jsonb'
    && poststate.stable === true
    && poststate.securityDefiner === true
    && poststate.owner === 'postgres'
    && poststate.fixedSearchPath === true
    && poststate.publicExecute === false
    && poststate.anonExecute === false
    && poststate.authenticatedExecute === true
    && poststate.serviceRoleExecute === false
    && poststate.commentPresent === true
  )
  const unchangedPass = (
    poststate.portalRowCount === prestate.portalRowCount
    && poststate.tableGrantDigest === prestate.tableGrantDigest
    && poststate.policyDigest === prestate.policyDigest
    && poststate.otherPortalFunctionCount === prestate.otherPortalFunctionCount
    && poststate.otherPortalFunctionDigest === prestate.otherPortalFunctionDigest
    && poststate.migrationHistoryCount === prestate.migrationHistoryCount
    && poststate.migrationHistoryDigest === prestate.migrationHistoryDigest
  )
  if (!catalogPass || !unchangedPass) fail('postcheck_rejected')
  return true
}

function verifyBackupMatchesPrestate(backup, prestate) {
  const digestArtifact = backup.artifacts.find(
    (artifact) => path.basename(artifact.path) === 'digests.json',
  )
  if (!digestArtifact) fail('private_backup_invalid')
  const digests = JSON.parse(readFileSync(digestArtifact.path, 'utf8'))
  for (const key of [
    'portalRowCount',
    'tableGrantDigest',
    'policyDigest',
    'otherPortalFunctionCount',
    'otherPortalFunctionDigest',
    'migrationHistoryCount',
    'migrationHistoryDigest',
  ]) {
    if (digests[key] !== prestate[key]) fail('backup_prestate_mismatch')
  }
}

export async function runPreEffectOrderedV2({
  environment,
  dependencies = {},
  onStage = () => {},
}) {
  const verifyPackage = dependencies.verifyPackage ?? verifyPackageManifestV2
  verifyPackage()
  onStage('manifest_and_hashes')

  const gitState = dependencies.gitState ?? currentGitStateV2(dependencies)
  assertAuthorizationAndHeadV2(environment, gitState)
  onStage('authorization_and_head')
  assertCleanWorktreeV2(gitState)
  onStage('clean_worktree')

  const backup = verifyPrivateBackupV2(
    environment.CP3B0_PRIVATE_BACKUP_MANIFEST,
    gitState.head,
  )
  onStage('private_backup')
  ;(dependencies.assertLocalLink ?? assertLocalLinkV2)()
  onStage('local_qa_link')
  const projects = (dependencies.readCliProjects ?? readCliProjectsV2)(
    environment,
    dependencies,
  )
  assertCliQaLinkedV2(projects)
  onStage('supabase_cli_qa_link')
  assertProductionNotLinkedV2(projects)
  onStage('production_not_linked')

  validateDatabaseEnvironment(environment)
  const runId = dependencies.runId ?? makeRunId()
  const prestate = (dependencies.readPrestate ?? psqlFileCapture)(
    precheckPath,
    { project_ref: QA_REF, run_id: runId },
    environment,
    dependencies,
  )
  if (prestate.liveRead !== 1) fail('postgres_live_read_failed')
  onStage('postgres_live_read')
  onStage('postgres_qa_target')
  if (prestate.cp2bPrerequisite !== true || prestate.portalTables !== 11) {
    fail('cp2b_prerequisite_rejected')
  }
  onStage('cp2b_prerequisite')
  if (prestate.selfContextCount !== 0) fail('function_preexisting_rejected')
  onStage('function_absent')
  if (
    typeof prestate.otherPortalFunctionCount !== 'number'
    || typeof prestate.otherPortalFunctionDigest !== 'string'
  ) fail('catalog_prestate_rejected')
  onStage('catalog_prestate')
  if (
    typeof prestate.tableGrantDigest !== 'string'
    || typeof prestate.policyDigest !== 'string'
  ) fail('grants_or_policy_digest_rejected')
  onStage('grants_and_policy_digest')
  if (prestate.syntheticCollisions !== 0) fail('synthetic_collision_rejected')
  onStage('synthetic_collision_check')
  validatePrestateV2(prestate)
  verifyBackupMatchesPrestate(backup, prestate)
  onStage('postgres_pre_effect_check')
  return { gitState, backup, prestate, runId }
}

function writePrivateRunReport(status, gitHead, detail) {
  mkdirSync(privateRoot, { recursive: true })
  const reportPath = path.join(
    privateRoot,
    `run-${gitHead.slice(0, 12)}-${Date.now()}-${status.toLowerCase()}.json`,
  )
  writeFileSync(reportPath, `${JSON.stringify({
    version: 1,
    status,
    projectRef: QA_REF,
    gitHead,
    detail,
    createdAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return reportPath
}

export async function executeV2(environment, dependencies = {}) {
  const stages = []
  let applied = false
  let recoveryAttempts = 0
  let context
  try {
    context = await runPreEffectOrderedV2({
      environment,
      dependencies,
      onStage: (stage) => {
        stages.push(stage)
        dependencies.onStage?.(stage)
      },
    })
    const apply = dependencies.apply ?? (() => psqlFileRun(
      migrationPath,
      {},
      environment,
      dependencies,
    ))
    apply()
    applied = true
    stages.push('apply')
    dependencies.onStage?.('apply')

    const poststate = (dependencies.postcheck ?? psqlFileCapture)(
      postcheckPath,
      {},
      environment,
      dependencies,
    )
    comparePostcheckV2(context.prestate, poststate)

    const matrix = (dependencies.matrix ?? psqlFileCapture)(
      matrixPath,
      { project_ref: QA_REF, run_id: context.runId },
      environment,
      dependencies,
    )
    if (matrix.result !== 'PASS' || matrix.transaction !== 'ROLLED_BACK') {
      fail('qa_matrix_rejected')
    }
    const residue = (dependencies.residue ?? psqlFileCapture)(
      precheckPath,
      { project_ref: QA_REF, run_id: context.runId },
      environment,
      dependencies,
    )
    if (residue.syntheticCollisions !== 0) fail('synthetic_residue_detected')
    const finalPoststate = (dependencies.finalPostcheck ?? psqlFileCapture)(
      postcheckPath,
      {},
      environment,
      dependencies,
    )
    comparePostcheckV2(context.prestate, finalPoststate)
    writePrivateRunReport('PASS', context.gitState.head, {
      stages,
      applyAttempts: 1,
      recoveryAttempts: 0,
      matrix: 'PASS_ROLLED_BACK',
      residue: 0,
    })
    return {
      verdict: 'PASS',
      target: 'QA_MATCH',
      stages,
      applyAttempts: 1,
      recoveryAttempts: 0,
      remoteEffect: 'ONE_FUNCTION_CREATED',
    }
  } catch {
    if (!applied) fail('BLOCKED_BEFORE_REMOTE_EFFECTS')
    recoveryAttempts += 1
    try {
      const rollback = dependencies.rollback ?? (() => psqlFileCapture(
        rollbackPath,
        {},
        environment,
        dependencies,
      ))
      const result = rollback()
      if (result.functionAbsent !== true) fail('recovery_function_still_present')
      const restored = (dependencies.recoveryPrecheck ?? psqlFileCapture)(
        precheckPath,
        { project_ref: QA_REF, run_id: context.runId },
        environment,
        dependencies,
      )
      validatePrestateV2(restored)
      verifyBackupMatchesPrestate(context.backup, restored)
      writePrivateRunReport('BLOCKED', context.gitState.head, {
        stages,
        applyAttempts: 1,
        recoveryAttempts,
        recovery: 'FUNCTION_ABSENT_PRESTATE_RESTORED',
      })
    } catch {
      writePrivateRunReport('BLOCKED', context.gitState.head, {
        stages,
        applyAttempts: 1,
        recoveryAttempts,
        recovery: 'MANUAL_VERIFICATION_REQUIRED',
      })
      fail('qa_application_failed_recovery_unverified')
    }
    fail('qa_application_failed_recovery_completed')
  }
}

export function assertNoSecretsInArgumentsV2(environment, argv) {
  const values = secretEnvironmentNames
    .map((name) => environment[name])
    .filter((value) => typeof value === 'string' && value.length > 0)
  if (argv.some((argument) => values.some((value) => argument.includes(value)))) {
    fail('secret_argument_rejected')
  }
}

export function planV2() {
  const { manifest } = verifyPackageManifestV2()
  return {
    gate: 'CP-3B.0A',
    mode: 'plan',
    status: 'PREPARED_NOT_AUTHORIZED',
    authorizationId: manifest.authorizationId,
    target: 'QA_ONLY',
    production: 'REJECTED',
    migrationSha256: manifest.migrationSha256,
    commands: ['--plan', '--preflight', '--execute'],
    executeAlias: false,
    preEffectOrder: PRE_EFFECT_ORDER,
    remoteWrites: 0,
  }
}

export function preflightV2(environment, dependencies = {}) {
  verifyPackageManifestV2()
  if (environment.CP3B0_PROJECT_REF === PRODUCTION_REF) fail('production_target_rejected')
  if (environment.CP3B0_PROJECT_REF !== QA_REF) fail('qa_target_required')
  validateDatabaseEnvironment(environment)
  ;(dependencies.assertLocalLink ?? assertLocalLinkV2)()
  const projects = (dependencies.readCliProjects ?? readCliProjectsV2)(
    environment,
    dependencies,
  )
  assertCliQaLinkedV2(projects)
  assertProductionNotLinkedV2(projects)
  const gitState = dependencies.gitState ?? currentGitStateV2(dependencies)
  const runId = dependencies.runId ?? makeRunId()
  const prestate = (dependencies.readPrestate ?? psqlFileCapture)(
    precheckPath,
    { project_ref: QA_REF, run_id: runId },
    environment,
    dependencies,
  )
  validatePrestateV2(prestate)
  const privateManifest = createPrivateBackupV2({
    environment,
    gitHead: gitState.head,
    prestate,
    dependencies,
  })
  return {
    verdict: 'READY_FOR_CP3B0_QA_V2',
    gate: 'CP-3B.0A',
    mode: 'preflight',
    package: 'PASS',
    privateBackup: 'PASS',
    privateSnapshot: 'PASS',
    privateManifest: path.basename(privateManifest),
    liveQaRead: 'PASS',
    databaseTarget: 'QA_MATCH',
    functionPrestate: 'ABSENT',
    executionAuthorization: 'NOT_GRANTED',
    remoteWrites: 0,
  }
}

async function main() {
  const modes = process.argv.slice(2)
  if (modes.length !== 1 || !['--plan', '--preflight', '--execute'].includes(modes[0])) {
    fail('mode_rejected')
  }
  assertNoSecretsInArgumentsV2(process.env, process.argv.slice(2))
  if (modes[0] === '--plan') {
    process.stdout.write(`${JSON.stringify(planV2(), null, 2)}\n`)
    return
  }
  if (modes[0] === '--preflight') {
    process.stdout.write(`${JSON.stringify(preflightV2(process.env), null, 2)}\n`)
    return
  }
  const result = await executeV2(process.env)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = error instanceof Error ? error.message : 'unknown_error'
    process.stderr.write(`BLOCKED: ${code}\n`)
    process.exitCode = 1
  })
}
