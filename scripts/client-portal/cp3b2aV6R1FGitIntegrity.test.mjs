import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyPackageSnapshotV6R1F, verifyStageV6R1F } from './cp3b2aV6R1FGitIntegrity.mjs'

let temporaryRoots = []

function git(cwd, args, input = null) {
  const result = spawnSync('git', args, { cwd, input, encoding: null, windowsHide: true })
  return { status: result.status, error: result.error, stdout: result.stdout, stderr: result.stderr }
}

function fixture() {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'cp3b2a-v6r1f-'))
  temporaryRoots.push(repoRoot)
  execFileSync('git', ['init', '-q'], { cwd: repoRoot })
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: repoRoot })
  execFileSync('git', ['config', 'user.name', 'fixture'], { cwd: repoRoot })
  mkdirSync(path.join(repoRoot, 'safe'), { recursive: true })
  writeFileSync(path.join(repoRoot, 'safe', 'fixture.txt'), 'fixture bytes\n')
  execFileSync('git', ['add', '--', 'safe/fixture.txt'], { cwd: repoRoot })
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repoRoot })
  const authorizedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  return { repoRoot, authorizedCommit, paths: ['safe/fixture.txt'], git: (args, input) => git(repoRoot, args, input) }
}

afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true })
  temporaryRoots = []
})

describe('CP3B V6R1F batched integrity', () => {
  it('checks a clean package in five Git processes and returns reproducible byte hashes', () => {
    const options = fixture()
    const result = verifyPackageSnapshotV6R1F(options)
    expect(result.gitProcesses).toBe(5)
    expect(result.checked).toHaveLength(1)
    expect(result.checked[0].blobId).toBe(execFileSync('git', ['hash-object', '--no-filters', '--', 'safe/fixture.txt'], {
      cwd: options.repoRoot, encoding: 'utf8',
    }).trim())
    expect(result.checked[0].sha256).toBe(createHash('sha256').update('fixture bytes\n').digest('hex'))
  })

  it('rejects a staged change before trusting worktree bytes', () => {
    const options = fixture()
    writeFileSync(path.join(options.repoRoot, 'safe', 'fixture.txt'), 'modified\n')
    execFileSync('git', ['add', '--', 'safe/fixture.txt'], { cwd: options.repoRoot })
    expect(() => verifyPackageSnapshotV6R1F(options)).toThrow('V6R1F_INDEX_DIVERGENCE')
  })

  it('rejects worktree divergence and HEAD movement', () => {
    const options = fixture()
    writeFileSync(path.join(options.repoRoot, 'safe', 'fixture.txt'), 'modified\n')
    expect(() => verifyPackageSnapshotV6R1F(options)).toThrow('V6R1F_WORKTREE_DIVERGENCE')
    expect(() => verifyPackageSnapshotV6R1F({ ...options, authorizedCommit: 'f'.repeat(40) }))
      .toThrow('V6R1F_AUTHORIZED_HEAD_MOVED')
  })

  it('rejects traversal and revalidates an individual stage against its exact commit', () => {
    const options = fixture()
    expect(() => verifyPackageSnapshotV6R1F({ ...options, paths: ['../outside'] }))
      .toThrow('V6R1F_PATH_REJECTED')
    expect(verifyStageV6R1F(options, options.paths[0]).path).toBe(options.paths[0])
  })

  it('rejects symlinks/reparse points where the host can create them', () => {
    const options = fixture()
    const relative = 'safe/nested/fixture.txt'
    const trackedFile = path.join(options.repoRoot, relative)
    mkdirSync(path.dirname(trackedFile), { recursive: true })
    writeFileSync(trackedFile, 'tracked target bytes\n')
    execFileSync('git', ['add', '--', relative], { cwd: options.repoRoot })
    execFileSync('git', ['commit', '-qm', 'nested fixture'], { cwd: options.repoRoot })
    options.authorizedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: options.repoRoot, encoding: 'utf8' }).trim()
    const outside = mkdtempSync(path.join(os.tmpdir(), 'cp3b2a-v6r1f-outside-'))
    temporaryRoots.push(outside)
    writeFileSync(path.join(outside, 'fixture.txt'), 'tracked target bytes\n')
    rmSync(path.dirname(trackedFile), { recursive: true, force: true })
    try {
      symlinkSync(outside, path.dirname(trackedFile), process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      expect.fail('HOST_COULD_NOT_CREATE_TEMPORARY_REPARSE_FIXTURE')
    }
    expect(() => verifyPackageSnapshotV6R1F({ ...options, paths: [relative] }))
      .toThrow('V6R1F_REPARSE_OR_NONFILE_REJECTED')
  })
})
