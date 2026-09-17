import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createSandboxEnvironmentV6,
  createSandboxProfileV6,
  removeSandboxProfileV6,
  runSandboxCompatibilityProofV6,
  verifyManifestV6,
} from './cp2b_sandbox_compat_v6.mjs'

const normalizedRepositoryRoot = path.resolve(process.cwd()).replace(/\\/gu, '/')

describe('CP-2A.5 versioned Windows sandbox compatibility V6', () => {
  it('verifies the new package and every reused immutable artifact', () => {
    const manifest = JSON.parse(readFileSync('scripts/client-portal/cp2b_qa_package_v6.manifest.json', 'utf8'))
    expect(verifyManifestV6(manifest)).toBe(true)
    expect(manifest.reusedV5Artifacts).toHaveLength(1)
    expect(manifest.reusedV4Artifacts).toHaveLength(2)
    expect(manifest.reusedV3Artifacts).toHaveLength(3)
  })

  it('fails closed when a manifest tries to substitute a frozen artifact or route', () => {
    const manifest = JSON.parse(readFileSync('scripts/client-portal/cp2b_qa_package_v6.manifest.json', 'utf8'))
    const alteredHash = structuredClone(manifest)
    alteredHash.reusedV4Artifacts[0].sha256 = '0'.repeat(64)
    expect(() => verifyManifestV6(alteredHash)).toThrow('invalid_v6_frozen_artifact_hash')

    const alteredPath = structuredClone(manifest)
    alteredPath.reusedV3Artifacts[0].path = 'scripts/client-portal/other.mjs'
    expect(() => verifyManifestV6(alteredPath)).toThrow('invalid_v6_manifest_artifact_set')
  })

  it('creates a private profile and one exact non-wildcard Git trust entry', () => {
    const profile = createSandboxProfileV6()
    try {
      const environment = createSandboxEnvironmentV6({ profile })
      expect(environment.GIT_CONFIG_COUNT).toBe('1')
      expect(environment.GIT_CONFIG_KEY_0).toBe('safe.directory')
      expect(environment.GIT_CONFIG_VALUE_0).toBe(normalizedRepositoryRoot)
      expect(environment.GIT_CONFIG_NOSYSTEM).toBe('1')
      expect(environment.GIT_CONFIG_VALUE_0).not.toBe('*')
      expect(environment.HOME).toBe(profile.profile)
      expect(environment.USERPROFILE).toBe(profile.profile)
      expect(environment.LOCALAPPDATA).toBe(profile.localAppData)
      expect(environment).not.toHaveProperty('SUPABASE_ACCESS_TOKEN')
      expect(environment).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
      expect(existsSync(`${profile.profile}/.gitconfig`)).toBe(false)
    } finally {
      removeSandboxProfileV6(profile)
    }
  })

  it('proves the frozen V4 child fails closed after Git can inspect this exact repository', () => {
    expect(runSandboxCompatibilityProofV6()).toMatchObject({
      status: 'PASS',
      manifest: 'PASS',
      v4UnauthorizedExecution: 'BLOCKED',
      gitSafeDirectoryWildcard: 'NO',
      gitConfigurationIsolation: 'PASS',
      profileIsolation: 'PASS',
      supabaseLauncher: 'PASS',
      v3Preload: 'PASS',
      remoteWrites: 0,
      productionWrites: 0,
    })
  })
})
