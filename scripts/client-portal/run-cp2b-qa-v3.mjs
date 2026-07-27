import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  PRODUCTION_REF,
  QA_REF,
} from './cp2b_qa_auth_fixtures_v2.mjs'
import {
  privateInputStatus,
  verifyPrivateBackup,
} from './run-cp2b-qa-v2.mjs'
import {
  runCommandV3,
  runSupabaseCliV3,
} from './cp2b_command_launcher_v3.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_package_v3.manifest.json',
)
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260723160000_client_portal_security_boundary.sql',
)
const v2RunnerPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'run-cp2b-qa-v2.mjs',
)
const preloadPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_v3_preload.mjs',
)
const V3_AUTHORIZATION_ID = 'CP2B-V3-AUTHORIZATION-PENDING'
const V2_INTERNAL_AUTHORIZATION_ID = 'CP2B-V2-AUTHORIZATION-PENDING'

export function verifyManifestV3(manifest) {
  if (manifest.version !== 3
    || manifest.status !== 'PREPARED_NOT_AUTHORIZED'
    || manifest.authorizationId !== V3_AUTHORIZATION_ID
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || !Array.isArray(manifest.artifacts)
    || !Array.isArray(manifest.reusedV2Artifacts)
    || !Array.isArray(manifest.reusedOriginalArtifacts)
    || !Array.isArray(manifest.supportedPlatforms)
    || !manifest.supportedPlatforms.includes('win32')
    || !manifest.supportedPlatforms.includes('linux')
    || !manifest.supportedPlatforms.includes('darwin')) {
    throw new Error('invalid_v3_manifest')
  }

  for (const artifact of [
    ...manifest.artifacts,
    ...manifest.reusedV2Artifacts,
    ...manifest.reusedOriginalArtifacts,
  ]) {
    const artifactPath = path.join(repoRoot, artifact.path)
    if (!existsSync(artifactPath) || sha256(artifactPath) !== artifact.sha256) {
      throw new Error('v3_manifest_hash_mismatch')
    }
  }
  if (sha256(migrationPath) !== manifest.migrationSha256) {
    throw new Error('migration_hash_mismatch')
  }
  return true
}

export function assertExecutionGateV3({ environment, manifest, gitHead, clean }) {
  if (environment.CP2B_EXECUTION_AUTHORIZED !== 'true') {
    throw new Error('execution_not_authorized')
  }
  if (environment.CP2B_PROJECT_REF === PRODUCTION_REF) {
    throw new Error('production_target_rejected')
  }
  if (environment.CP2B_PROJECT_REF !== QA_REF) throw new Error('qa_target_required')
  if (environment.CP2B_V3_AUTHORIZATION_ID !== manifest.authorizationId) {
    throw new Error('v3_authorization_mismatch')
  }
  if (!environment.CP2B_V3_AUTHORIZED_HEAD
    || environment.CP2B_V3_AUTHORIZED_HEAD !== gitHead
    || !clean) {
    throw new Error('git_authorization_mismatch')
  }
  if (Object.values(privateInputStatus(environment)).includes('MISSING')) {
    throw new Error('private_input_missing')
  }
  if (!environment.SUPABASE_URL.includes(QA_REF)
    || environment.SUPABASE_URL.includes(PRODUCTION_REF)) {
    throw new Error('supabase_target_rejected')
  }
  if (!environment.CP2B_QA_DATABASE_URL.includes(QA_REF)
    || environment.CP2B_QA_DATABASE_URL.includes(PRODUCTION_REF)) {
    throw new Error('database_target_rejected')
  }
  verifyPrivateBackup(environment.CP2B_PRIVATE_BACKUP_MANIFEST, gitHead)
  return true
}

export function planV3() {
  const manifest = readManifestIfPresent()
  return {
    gate: 'CP-2B-V3',
    mode: 'plan',
    status: 'NOT_AUTHORIZED',
    qaProjectRef: QA_REF,
    productionRejected: true,
    remoteWrites: 0,
    manifestPresent: Boolean(manifest),
    authorizationId: manifest?.authorizationId ?? V3_AUTHORIZATION_ID,
    stages: manifest?.expectedStages ?? [],
    requiredPrivateInputs: manifest?.requiredPrivateInputNames ?? [],
    supportedPlatforms: manifest?.supportedPlatforms ?? [],
  }
}

export function preflightV3(environment) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (environment.CP2B_PROJECT_REF === PRODUCTION_REF) {
    throw new Error('production_target_rejected')
  }
  if (environment.CP2B_PROJECT_REF && environment.CP2B_PROJECT_REF !== QA_REF) {
    throw new Error('qa_target_required')
  }
  verifyManifestV3(manifest)
  return {
    gate: 'CP-2B-V3',
    mode: 'preflight',
    status: 'PREPARED_NOT_AUTHORIZED',
    remoteWrites: 0,
    projectRef: environment.CP2B_PROJECT_REF === QA_REF ? 'QA_MATCH' : 'MISSING',
    production: 'PRODUCTION_REJECTED',
    manifest: 'PASS',
    privateInputs: privateInputStatus(environment),
  }
}

export function assertTripleIdentityV3(environment) {
  const localRef = readFileSync(
    path.join(repoRoot, 'supabase', '.temp', 'project-ref'),
    'utf8',
  ).trim()
  if (localRef !== QA_REF || localRef === PRODUCTION_REF) {
    throw new Error('local_link_rejected')
  }
  if (!environment.CP2B_QA_DATABASE_URL.includes(QA_REF)
    || environment.CP2B_QA_DATABASE_URL.includes(PRODUCTION_REF)) {
    throw new Error('database_target_rejected')
  }
  const projectsResult = runSupabaseCliV3(
    ['--workdir', repoRoot, 'projects', 'list', '--output', 'json'],
    {
      repoRoot,
      cwd: neutralCliDirectory(),
      environment,
      redactFailure: true,
      timeout: 120_000,
    },
  )
  const projects = JSON.parse(projectsResult.stdout)
  const qaLinked = projects.some((project) => project.id === QA_REF && project.linked === true)
  const productionLinked = projects.some(
    (project) => project.id === PRODUCTION_REF && project.linked === true,
  )
  if (!qaLinked || productionLinked) throw new Error('cli_target_rejected')
  return true
}

async function executeV3(environment) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  verifyManifestV3(manifest)
  const gitHead = gitOutput(['rev-parse', 'HEAD'])
  const clean = gitOutput(['status', '--porcelain']) === ''
  assertExecutionGateV3({ environment, manifest, gitHead, clean })
  assertTripleIdentityV3(environment)

  const childEnvironment = {
    ...environment,
    CP2B_V2_AUTHORIZATION_ID: V2_INTERNAL_AUTHORIZATION_ID,
    CP2B_V2_AUTHORIZED_HEAD: gitHead,
  }
  const result = runCommandV3(
    process.execPath,
    ['--import', pathToFileURL(preloadPath).href, v2RunnerPath, '--execute'],
    {
      cwd: repoRoot,
      environment: childEnvironment,
      redactFailure: true,
      timeout: 30 * 60_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  )
  const execution = JSON.parse(result.stdout)
  if (execution.status !== 'PASS' || execution.remoteTarget !== QA_REF) {
    throw new Error('v2_execution_result_rejected')
  }
  return {
    status: 'PASS',
    runId: 'REDACTED',
    remoteTarget: QA_REF,
    runnerVersion: 3,
  }
}

function gitOutput(args) {
  return runCommandV3('git', args, {
    cwd: repoRoot,
    redactFailure: true,
  }).stdout.trim()
}

function neutralCliDirectory() {
  return process.env.TEMP ?? process.env.TMPDIR ?? repoRoot
}

function readManifestIfPresent() {
  return existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : null
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function main() {
  if (process.argv.includes('--plan')) {
    process.stdout.write(`${JSON.stringify(planV3(), null, 2)}\n`)
    return
  }
  if (process.argv.includes('--preflight')) {
    process.stdout.write(`${JSON.stringify(preflightV3(process.env), null, 2)}\n`)
    return
  }
  if (process.argv.includes('--execute')) {
    const result = await executeV3(process.env)
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
