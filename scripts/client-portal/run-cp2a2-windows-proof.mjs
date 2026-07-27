import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runCommandV3,
  runSupabaseCliV3,
} from './cp2b_command_launcher_v3.mjs'
import {
  assertExecutionGateV3,
  planV3,
  preflightV3,
  verifyManifestV3,
} from './run-cp2b-qa-v3.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const qaRef = 'kpvvydthlxupjjqqdpxy'
const productionRef = 'wfxnwfcdjainpojhbdri'

function expectBlocked(action, expectedMessage) {
  try {
    action()
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return true
    throw new Error(`unexpected_block_reason:${expectedMessage}`)
  }
  throw new Error(`expected_block_missing:${expectedMessage}`)
}

function createGateEnvironment() {
  return {
    ...process.env,
    CP2B_PROJECT_REF: qaRef,
    CP2B_EXECUTION_AUTHORIZED: 'true',
    CP2B_V3_AUTHORIZATION_ID: 'CP2B-V3-AUTHORIZATION-PENDING',
    CP2B_V3_AUTHORIZED_HEAD: 'authorized-head',
    CP2B_QA_DATABASE_URL: `postgresql://private@${qaRef}.example.invalid/postgres`,
    CP2B_ACTIVE_STAFF_USER_ID: '00000000-0000-4000-8000-000000000001',
    SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN ?? 'private-proof-token',
    SUPABASE_URL: `https://${qaRef}.supabase.co`,
    SUPABASE_ANON_KEY: 'private-proof-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'private-proof-service-role',
    PORTAL_INVITATION_PEPPER: 'private-proof-invitation-pepper',
    PORTAL_RATE_LIMIT_PEPPER: 'private-proof-rate-limit-pepper',
    PORTAL_ALLOWED_ORIGIN: 'https://app.costacleanbcn.com',
    CP2B_PRIVATE_BACKUP_MANIFEST: 'private-proof-manifest-not-read-by-negative-gates',
  }
}

function main() {
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error('private_supabase_auth_required')
  }
  const manifest = JSON.parse(
    runCommandV3(process.execPath, [
      '-e',
      `process.stdout.write(JSON.stringify(require(${JSON.stringify(
        path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_package_v3.manifest.json'),
      )})))`,
    ], {
      cwd: repoRoot,
      redactFailure: true,
    }).stdout,
  )
  verifyManifestV3(manifest)

  const shimPath = path.join(repoRoot, 'node_modules', '.bin', 'supabase.cmd')
  const shimVersion = process.platform === 'win32'
    ? runCommandV3(shimPath, ['--version'], {
      cwd: repoRoot,
      redactFailure: true,
    }).stdout.trim()
    : 'NOT_APPLICABLE'
  const directVersion = runSupabaseCliV3(['--version'], {
    repoRoot,
    cwd: repoRoot,
    redactFailure: true,
  }).stdout.trim()
  const projects = JSON.parse(runSupabaseCliV3(
    ['--workdir', repoRoot, 'projects', 'list', '--output', 'json'],
    {
      repoRoot,
      cwd: tmpdir(),
      environment: process.env,
      redactFailure: true,
      timeout: 120_000,
    },
  ).stdout)
  const qaLinked = projects.some((project) => project.id === qaRef && project.linked === true)
  const productionLinked = projects.some(
    (project) => project.id === productionRef && project.linked === true,
  )
  if (!qaLinked || productionLinked) throw new Error('project_identity_rejected')

  const plan = planV3()
  const preflight = preflightV3({
    ...process.env,
    CP2B_PROJECT_REF: qaRef,
  })
  const gateEnvironment = createGateEnvironment()
  const executeWithoutAuthorization = expectBlocked(
    () => assertExecutionGateV3({
      environment: { ...gateEnvironment, CP2B_EXECUTION_AUTHORIZED: 'false' },
      manifest,
      gitHead: 'authorized-head',
      clean: true,
    }),
    'execution_not_authorized',
  )
  const incorrectHead = expectBlocked(
    () => assertExecutionGateV3({
      environment: gateEnvironment,
      manifest,
      gitHead: 'different-head',
      clean: true,
    }),
    'git_authorization_mismatch',
  )
  const production = expectBlocked(
    () => assertExecutionGateV3({
      environment: { ...gateEnvironment, CP2B_PROJECT_REF: productionRef },
      manifest,
      gitHead: 'authorized-head',
      clean: true,
    }),
    'production_target_rejected',
  )
  const missingInput = expectBlocked(
    () => assertExecutionGateV3({
      environment: { ...gateEnvironment, PORTAL_RATE_LIMIT_PEPPER: '' },
      manifest,
      gitHead: 'authorized-head',
      clean: true,
    }),
    'private_input_missing',
  )

  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'cp2b-v3-redaction-'))
  try {
    const failingBatch = path.join(temporaryDirectory, 'redaction.cmd')
    writeFileSync(
      failingBatch,
      '@echo off\r\necho %CP2A2_REDACTION_PROOF% 1>&2\r\nexit /b 9\r\n',
      'utf8',
    )
    const secret = 'private-redaction-proof-value'
    let redactionPassed = false
    try {
      runCommandV3(failingBatch, [], {
        cwd: temporaryDirectory,
        environment: { ...process.env, CP2A2_REDACTION_PROOF: secret },
        redactFailure: true,
      })
    } catch (error) {
      redactionPassed = error instanceof Error
        && error.message.endsWith(':redacted')
        && !error.message.includes(secret)
    }
    if (!redactionPassed) throw new Error('redaction_proof_failed')
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }

  const result = {
    gate: 'CP-2A.2',
    status: 'PASS',
    platform: process.platform,
    windowsCmdShim: process.platform === 'win32' && shimVersion ? 'PASS' : 'NOT_APPLICABLE',
    supabaseVersionViaV3: directVersion ? 'PASS' : 'FAIL',
    projectsListViaV3: 'PASS',
    qaLinked: 'PASS',
    productionRejected: 'PASS',
    plan: plan.remoteWrites === 0 ? 'PASS' : 'FAIL',
    preflight: preflight.remoteWrites === 0 ? 'PASS' : 'FAIL',
    executeWithoutAuthorization: executeWithoutAuthorization ? 'BLOCKED' : 'FAIL',
    incorrectHead: incorrectHead ? 'BLOCKED' : 'FAIL',
    productionTarget: production ? 'BLOCKED' : 'FAIL',
    missingPrivateInput: missingInput ? 'BLOCKED' : 'FAIL',
    secretRedaction: 'PASS',
    remoteWrites: 0,
    cp2bExecuted: false,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}\n`)
  process.exitCode = 1
}
