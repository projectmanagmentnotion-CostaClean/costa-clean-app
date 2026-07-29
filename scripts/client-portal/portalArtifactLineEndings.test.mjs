import { readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const manifestDirectory = 'scripts/client-portal'

function collectArtifactPaths(value, artifactPaths) {
  if (Array.isArray(value)) {
    for (const item of value) collectArtifactPaths(item, artifactPaths)
    return
  }

  if (!value || typeof value !== 'object') return
  if (typeof value.path === 'string' && typeof value.sha256 === 'string') {
    artifactPaths.add(value.path)
  }
  for (const item of Object.values(value)) collectArtifactPaths(item, artifactPaths)
}

describe('client portal byte-pinned artifact checkout policy', () => {
  it('forces LF for every artifact declared by a portal manifest', () => {
    const artifactPaths = new Set()
    const manifestPaths = readdirSync(manifestDirectory)
      .filter((name) => name.endsWith('.manifest.json'))
      .sort()

    for (const manifestName of manifestPaths) {
      const manifest = JSON.parse(
        readFileSync(path.join(manifestDirectory, manifestName), 'utf8'),
      )
      collectArtifactPaths(manifest, artifactPaths)
    }

    const sortedPaths = [...artifactPaths].sort()
    const result = spawnSync(
      'git',
      ['check-attr', 'eol', '--', ...sortedPaths],
      { encoding: 'utf8', windowsHide: true },
    )

    expect(result.status, result.stderr).toBe(0)
    const attributes = new Map(
      result.stdout
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => line.split(': eol: ')),
    )

    expect(sortedPaths.length).toBeGreaterThan(0)
    for (const artifactPath of sortedPaths) {
      expect(attributes.get(artifactPath), artifactPath).toBe('lf')
    }
  })
})
