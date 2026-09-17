import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCommandV3, runSupabaseCliV3 } from './cp2b_command_launcher_v3.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..', '..')
const manifestPath = path.join(scriptDirectory, 'cp2b_qa_package_v6.manifest.json')
const v4RunnerPath = path.join(scriptDirectory, 'run-cp2b-qa-v4.mjs')
const v3PreloadPath = path.join(scriptDirectory, 'cp2b_v3_preload.mjs')
const controlPattern = /[\0\r\n]/u
const childEnvironmentAllowlist = Object.freeze([
  'PATH',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'PATHEXT',
  'LANG',
  'LC_ALL',
  'TZ',
])
const forbiddenEnvironmentNames = Object.freeze([
  'CP2B_QA_DATABASE_URL',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
  'GIT_CONFIG',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_NOSYSTEM',
])
const expectedManifestPathsV6 = Object.freeze({
  artifacts: Object.freeze([
    'scripts/client-portal/cp2b_sandbox_compat_v6.mjs',
    'scripts/client-portal/run-cp2a5-sandbox-proof.mjs',
    'scripts/client-portal/cp2bSandboxCompatibilityV6.test.mjs',
  ]),
  reusedV5Artifacts: Object.freeze([
    'scripts/client-portal/cp2b_qa_package_v5.manifest.json',
  ]),
  reusedV4Artifacts: Object.freeze([
    'scripts/client-portal/run-cp2b-qa-v4.mjs',
    'scripts/client-portal/cp2a3BootstrapV4.test.mjs',
  ]),
  reusedV3Artifacts: Object.freeze([
    'scripts/client-portal/cp2b_command_launcher_v3.mjs',
    'scripts/client-portal/cp2b_v3_preload.mjs',
    'scripts/client-portal/cp2bWindowsLauncherV3.test.mjs',
  ]),
})
const frozenArtifactHashesV6 = Object.freeze({
  'scripts/client-portal/cp2b_qa_package_v5.manifest.json': '64afb9b397f1656a5be8d2eb0bcd6e76300b43d096a95e673a3b90fca70e57bd',
  'scripts/client-portal/run-cp2b-qa-v4.mjs': '1846725f09f4dd18fa60a8becac60db7a613ad3d1ebcf508f32a96f363f33c66',
  'scripts/client-portal/cp2a3BootstrapV4.test.mjs': '089783b9b527e4feed30e1ff33bdfcfba97b8f76c025f6ffbaa562f13dd3091a',
  'scripts/client-portal/cp2b_command_launcher_v3.mjs': '392bfc23a17a709a59a0e592366677be2554e81fe1d01d9553a7903b832fbb85',
  'scripts/client-portal/cp2b_v3_preload.mjs': '7fe7f172a71fc6cff4d6fdc080622c8a181f9c6430f5387ba0e8d5502fe8f256',
  'scripts/client-portal/cp2bWindowsLauncherV3.test.mjs': 'e8a78d86248a6ae54ef281cdebd8f836df9a99e2a4bbdc545559c91f43668a92',
})
const requiredGuaranteesV6 = Object.freeze([
  'no_remote_execution_path',
  'exact_repository_git_trust_only',
  'no_global_git_configuration',
  'private_profile_and_cache_isolation',
  'frozen_v3_v4_v5_artifacts_verified',
])

function assertSafePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || controlPattern.test(value)) {
    throw new Error(`${label}_invalid`)
  }
}

function normalizedRepositoryPath(repositoryRoot) {
  assertSafePath(repositoryRoot, 'repository_root')
  return path.resolve(repositoryRoot).replace(/\\/gu, '/')
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function resolveRepositoryArtifactPath(artifactPath) {
  if (typeof artifactPath !== 'string' || !/^[A-Za-z0-9_./-]+$/u.test(artifactPath)) {
    throw new Error('invalid_v6_artifact_path')
  }
  const resolved = path.resolve(repoRoot, artifactPath)
  if (!resolved.startsWith(`${repoRoot}${path.sep}`)) throw new Error('invalid_v6_artifact_path')
  return resolved
}

function manifestArtifacts(manifest) {
  return [
    ...(manifest.artifacts ?? []),
    ...(manifest.reusedV5Artifacts ?? []),
    ...(manifest.reusedV4Artifacts ?? []),
    ...(manifest.reusedV3Artifacts ?? []),
  ]
}

function assertExpectedManifestCollection(manifest, name) {
  const expectedPaths = expectedManifestPathsV6[name]
  const artifacts = manifest[name]
  if (!Array.isArray(artifacts) || artifacts.length !== expectedPaths.length) {
    throw new Error('invalid_v6_manifest_artifact_set')
  }
  for (const [index, expectedPath] of expectedPaths.entries()) {
    const artifact = artifacts[index]
    if (artifact?.path !== expectedPath || !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? '')) {
      throw new Error('invalid_v6_manifest_artifact_set')
    }
    const expectedHash = frozenArtifactHashesV6[expectedPath]
    if (expectedHash && artifact.sha256 !== expectedHash) {
      throw new Error('invalid_v6_frozen_artifact_hash')
    }
  }
}

function verifyFrozenV5TransitiveArtifacts() {
  const manifest = JSON.parse(readFileSync(path.join(scriptDirectory, 'cp2b_qa_package_v5.manifest.json'), 'utf8'))
  const collections = [
    'artifacts',
    'reusedV4Artifacts',
    'reusedV3Artifacts',
    'reusedV2Artifacts',
    'reusedOriginalArtifacts',
  ]
  if (manifest.version !== 5 || !collections.every((name) => Array.isArray(manifest[name]))) {
    throw new Error('invalid_v6_frozen_v5_manifest')
  }
  let artifactCount = 0
  for (const name of collections) {
    for (const artifact of manifest[name]) {
      const filePath = resolveRepositoryArtifactPath(artifact?.path)
      if (!/^[a-f0-9]{64}$/u.test(artifact?.sha256 ?? '')
        || !existsSync(filePath)
        || sha256(filePath) !== artifact.sha256) {
        throw new Error('v6_frozen_v5_transitive_hash_mismatch')
      }
      artifactCount += 1
    }
  }
  return artifactCount
}

export function createSandboxProfileV6(parentDirectory = tmpdir()) {
  assertSafePath(parentDirectory, 'sandbox_parent_directory')
  const root = mkdtempSync(path.join(parentDirectory, 'cp2b-sandbox-v6-'))
  const profile = path.join(root, 'profile')
  const temp = path.join(root, 'temp')
  const appData = path.join(profile, 'AppData', 'Roaming')
  const localAppData = path.join(profile, 'AppData', 'Local')
  const xdgConfig = path.join(profile, '.config')
  const xdgCache = path.join(profile, '.cache')
  const xdgData = path.join(profile, '.local', 'share')
  for (const directory of [profile, temp, appData, localAppData, xdgConfig, xdgCache, xdgData]) {
    mkdirSync(directory, { recursive: true })
  }
  return { root, profile, temp, appData, localAppData, xdgConfig, xdgCache, xdgData }
}

export function removeSandboxProfileV6(profile) {
  if (profile?.root) rmSync(profile.root, { recursive: true, force: true })
}

export function createSandboxEnvironmentV6({
  sourceEnvironment = process.env,
  repositoryRoot = repoRoot,
  profile,
} = {}) {
  if (!profile?.profile || !profile?.temp || !profile?.appData || !profile?.localAppData) {
    throw new Error('sandbox_profile_required')
  }
  const environment = {}
  for (const name of childEnvironmentAllowlist) {
    const value = sourceEnvironment[name]
    if (typeof value === 'string' && value.length > 0) environment[name] = value
  }
  environment.HOME = profile.profile
  environment.USERPROFILE = profile.profile
  environment.APPDATA = profile.appData
  environment.LOCALAPPDATA = profile.localAppData
  environment.XDG_CONFIG_HOME = profile.xdgConfig
  environment.XDG_CACHE_HOME = profile.xdgCache
  environment.XDG_DATA_HOME = profile.xdgData
  environment.TEMP = profile.temp
  environment.TMP = profile.temp
  environment.GIT_CONFIG_COUNT = '1'
  environment.GIT_CONFIG_KEY_0 = 'safe.directory'
  environment.GIT_CONFIG_VALUE_0 = normalizedRepositoryPath(repositoryRoot)
  for (const name of forbiddenEnvironmentNames) delete environment[name]
  environment.GIT_CONFIG_NOSYSTEM = '1'
  return environment
}

export function verifyManifestV6(manifest) {
  if (manifest?.version !== 6
    || manifest.status !== 'LOCAL_SANDBOX_COMPATIBILITY_ONLY'
    || manifest.authorizationId !== 'CP2B-V6-NO_REMOTE_EXECUTION'
    || manifest.qaProjectRef !== 'kpvvydthlxupjjqqdpxy'
    || manifest.prohibitedProductionRef !== 'wfxnwfcdjainpojhbdri'
    || !Array.isArray(manifest.artifacts)
    || !Array.isArray(manifest.reusedV5Artifacts)
    || !Array.isArray(manifest.reusedV4Artifacts)
    || !Array.isArray(manifest.reusedV3Artifacts)
    || !Array.isArray(manifest.guarantees)
    || manifest.guarantees.length !== requiredGuaranteesV6.length
    || !requiredGuaranteesV6.every((guarantee, index) => manifest.guarantees[index] === guarantee)) {
    throw new Error('invalid_v6_manifest')
  }
  for (const name of Object.keys(expectedManifestPathsV6)) {
    assertExpectedManifestCollection(manifest, name)
  }
  for (const artifact of manifestArtifacts(manifest)) {
    const filePath = resolveRepositoryArtifactPath(artifact.path)
    if (!existsSync(filePath) || sha256(filePath) !== artifact.sha256) {
      throw new Error('v6_manifest_hash_mismatch')
    }
  }
  verifyFrozenV5TransitiveArtifacts()
  return true
}

export function runGitIsolationProofV6({ environment, spawn = spawnSync } = {}) {
  const result = spawn('git', ['config', '--show-origin', '--get-all', 'safe.directory'], {
    cwd: repoRoot,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  })
  const output = String(result.stdout ?? '').replace(/\r/gu, '')
  const exactLine = `command line:\t${environment?.GIT_CONFIG_VALUE_0}`
  if (result.error
    || result.status !== 0
    || environment?.GIT_CONFIG_NOSYSTEM !== '1'
    || output.trim() !== exactLine
    || output.includes('file:')) {
    throw new Error('git_configuration_isolation_proof_failed')
  }
  return output.trim()
}

export function runFrozenV4UnauthorizedProofV6({ environment, spawn = spawnSync } = {}) {
  const result = spawn(process.execPath, [v4RunnerPath, '--execute'], {
    cwd: repoRoot,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  })
  const stderr = String(result.stderr ?? '')
  if (result.error || result.status === 0 || !stderr.includes('BLOCKED: execution_not_authorized')) {
    throw new Error('v4_unauthorized_execution_proof_failed')
  }
  return { status: result.status, stderr }
}

export function runSupabaseLauncherProofV6({ environment } = {}) {
  const result = runSupabaseCliV3(['--version'], {
    repoRoot,
    cwd: repoRoot,
    environment,
    redactFailure: true,
  })
  if (!/^\d+\.\d+\.\d+/u.test(result.stdout.trim())) {
    throw new Error('supabase_launcher_proof_failed')
  }
  return result.stdout.trim()
}

export function runV3PreloadProofV6({ environment } = {}) {
  const shimPath = path.join(repoRoot, 'node_modules', '.bin', 'supabase.cmd')
  const script = [
    "const { spawnSync } = require('node:child_process')",
    `const result = spawnSync(${JSON.stringify(shimPath)}, ['--version'], { encoding: 'utf8' })`,
    "if (result.error || result.status !== 0) process.exit(1)",
    'process.stdout.write(result.stdout)',
  ].join(';')
  const result = runCommandV3(process.execPath, [
    '--import',
    pathToFileURL(v3PreloadPath).href,
    '-e',
    script,
  ], {
    cwd: repoRoot,
    environment,
    redactFailure: true,
  })
  if (!/^\d+\.\d+\.\d+/u.test(result.stdout.trim())) {
    throw new Error('v3_preload_proof_failed')
  }
  return result.stdout.trim()
}

export function runSandboxCompatibilityProofV6({ sourceEnvironment = process.env } = {}) {
  const profile = createSandboxProfileV6()
  try {
    const environment = createSandboxEnvironmentV6({ sourceEnvironment, profile })
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    verifyManifestV6(manifest)
    runGitIsolationProofV6({ environment })
    const v4 = runFrozenV4UnauthorizedProofV6({ environment })
    const supabaseVersion = runSupabaseLauncherProofV6({ environment })
    const preloadVersion = runV3PreloadProofV6({ environment })
    return {
      gate: 'CP-2A.5',
      status: 'PASS',
      manifest: 'PASS',
      v4UnauthorizedExecution: v4.status !== 0 ? 'BLOCKED' : 'FAIL',
      gitSafeDirectory: environment.GIT_CONFIG_VALUE_0,
      gitSafeDirectoryWildcard: 'NO',
      gitConfigurationIsolation: 'PASS',
      profileIsolation: 'PASS',
      supabaseLauncher: 'PASS',
      v3Preload: 'PASS',
      supabaseVersion,
      preloadVersion,
      remoteWrites: 0,
      productionWrites: 0,
    }
  } finally {
    removeSandboxProfileV6(profile)
  }
}
