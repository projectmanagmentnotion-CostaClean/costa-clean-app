import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function historicalBlobSha256(relativePath, expectedSha256) {
  let commits
  try {
    commits = execFileSync('git', ['rev-list', '--all', '--', relativePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split(/\r?\n/u).filter(Boolean)
  } catch {
    return false
  }

  return commits.some((commit) => {
    try {
      const bytes = execFileSync('git', ['show', `${commit}:${relativePath}`], {
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return sha256(bytes) === expectedSha256
    } catch {
      return false
    }
  })
}

export function matchesFrozenArtifact(filePath, relativePath, expectedSha256) {
  try {
    if (sha256(readFileSync(filePath)) === expectedSha256) return true
  } catch {
    return false
  }
  return historicalBlobSha256(relativePath, expectedSha256)
}
