import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { gitBlobSha256AtPath } from './cp3b2aCanonicalJsonV6.mjs'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('CP3B2A V6 raw Git blob identity', () => {
  it('preserves leading whitespace, trailing spaces, and multiple trailing newlines', () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'costa-clean-git-blob-'))
    const relativePath = 'artifact.txt'
    const filePath = path.join(repoRoot, relativePath)
    mkdirSync(repoRoot, { recursive: true })
    const bytes = Buffer.from('  example  \n\n', 'utf8')
    writeFileSync(filePath, bytes)

    execFileSync('git', ['init', '--quiet'], { cwd: repoRoot })
    execFileSync('git', ['config', 'user.email', 'qa@example.invalid'], { cwd: repoRoot })
    execFileSync('git', ['config', 'user.name', 'Costa Clean QA'], { cwd: repoRoot })
    execFileSync('git', ['add', relativePath], { cwd: repoRoot })
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: repoRoot })

    expect(gitBlobSha256AtPath(repoRoot, relativePath)).toBe(sha256(bytes))
    expect(gitBlobSha256AtPath(repoRoot, relativePath)).not.toBe(sha256(Buffer.from('example', 'utf8')))
    expect(readFileSync(filePath)).toEqual(bytes)
  })
})
