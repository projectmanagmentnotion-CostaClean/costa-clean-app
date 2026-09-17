import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { runCandidateDiffCheck, runManagedValidation, terminateProcessTree } from './run-project-continuation-agent.mjs'

const runner = readFileSync('scripts/ops/run-project-continuation-agent.mjs', 'utf8')

describe('continuation publication pipeline', () => {
  it('blocks a dirty initial worktree before the workspace-write executor starts', () => {
    const executeGuard = runner.indexOf('if (options.execute) {')
    const guard = runner.indexOf("assertCleanInitialWorktree(gitResult(['status', '--porcelain']))")
    const executor = runner.lastIndexOf("sandbox: 'workspace-write'")
    expect(executeGuard).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(executeGuard)
    expect(executor).toBeGreaterThan(guard)
  })

  it('runs post-execution secret scanning, validation, and independent review before staging', () => {
    const postExecutionGate = runner.indexOf('runPostExecutionPublicationGate({')
    const stage = runner.indexOf("gitOutput(['add', '--all'])")
    expect(postExecutionGate).toBeGreaterThan(-1)
    expect(stage).toBeGreaterThan(postExecutionGate)
    expect(runner).toContain('scanPublicationCandidates(candidates)')
    expect(runner).toContain('assertPublicationValidationResults(validationResults)')
    expect(runner).toContain('assertPublicationIndependentReview(review)')
    expect(runner).toContain('runCandidateDiffCheck(candidates)')
    expect(runner).toContain("['diff', '--cached', '--check']")
  })

  it('confines reviewer tool caches and fails closed for frozen child Git environments', () => {
    expect(runner).toContain("sandbox: 'workspace-write'")
    expect(runner).toContain('HOME and USERPROFILE to an ignored review home')
    expect(runner).toContain('frozen child test which strips its environment is a capability blocker')
    expect(runner).toContain('single exact repository trust setting')
    expect(runner).toContain('Do not weaken Git trust with a wildcard')
    expect(runner).toContain('Do not trust any other repository')
  })

  it('uses one exact repository trust entry and temporary Git objects for candidate checks', () => {
    expect(runner).toContain("environment.GIT_CONFIG_COUNT = '1'")
    expect(runner).toContain("environment.GIT_CONFIG_KEY_0 = 'safe.directory'")
    expect(runner).toContain("environment.GIT_CONFIG_VALUE_0 = repoRoot.replace(/\\\\/g, '/')")
    expect(runner).not.toContain("environment.GIT_CONFIG_VALUE_0 = '*'")
    expect(runner).toContain('GIT_OBJECT_DIRECTORY: temporaryObjects')
    expect(runner).toContain('GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(commonDirectory, \'objects\')')
  })

  it('uses bounded validation processes and captures their private evidence', () => {
    expect(runner).toContain('async function runManagedValidation')
    expect(runner).toContain('terminate = terminateProcessTree')
    expect(runner).toContain('detached: process.platform !== \'win32\'')
    expect(runner).toContain('setTimeout(() => finish(null), VALIDATION_TERMINATION_GRACE_MS)')
    expect(runner).toContain('timedOut: result.timedOut')
    expect(runner).toContain('assertPublicationValidationResults(validationResults)')
    expect(runner).toContain('iteration-${iteration}-validation-${name}.log')
    for (const timeout of ['900_000', '300_000', '600_000', '120_000']) expect(runner).toContain(timeout)
  })

  it('terminates an owned validation child when its hard timeout expires', async () => {
    const child = new EventEmitter()
    child.pid = 12345
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    let terminationCalls = 0
    const result = await runManagedValidation({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      timeoutMs: 25,
      spawnProcess: () => child,
      terminate: async (ownedChild) => {
        terminationCalls += 1
        expect(ownedChild).toBe(child)
        return { attempted: true, terminated: true }
      },
    })
    expect(result.timedOut).toBe(true)
    expect(result.status).not.toBe(0)
    expect(terminationCalls).toBe(1)
    expect(result.durationMs).toBeLessThan(1_000)
  })

  it('uses taskkill tree termination for an owned Windows child', async () => {
    const child = { pid: 24680, kill: () => true }
    const killer = new EventEmitter()
    killer.kill = () => true
    const calls = []
    const completion = terminateProcessTree(child, {
      platform: 'win32',
      graceMs: 100,
      spawn(command, args, options) {
        calls.push({ command, args, options })
        queueMicrotask(() => killer.emit('close', 0))
        return killer
      },
    })
    await expect(completion).resolves.toEqual({ attempted: true, terminated: true })
    expect(calls).toEqual([{
      command: 'taskkill',
      args: ['/PID', '24680', '/T', '/F'],
      options: expect.objectContaining({ windowsHide: true }),
    }])
  })

  it('checks every reviewed candidate in a temporary index before actual staging', async () => {
    const fixture = path.join('scripts', 'ops', `.publication-candidate-${process.pid}.txt`)
    writeFileSync(fixture, 'trailing whitespace  \n', 'utf8')
    try {
      const result = await runCandidateDiffCheck([{ path: fixture }])
      expect(result.status).not.toBe(0)
      expect(result.timedOut).toBe(false)
      expect(`${result.stdout}${result.stderr}`).toContain('trailing whitespace')
    } finally {
      rmSync(fixture, { force: true })
    }
  })

  it('rechecks reviewed candidates, staged content, and branch safety at the publication boundary', () => {
    expect(runner).toContain('assertReviewedCandidatesUnchanged(reviewedCandidates)')
    expect(runner).toContain('assertStagedCandidatesMatch(reviewedCandidates)')
    expect(runner).toContain('const refspecBeforeStage = resolveSafePublicationRefspec()')
    expect(runner).toContain('const refspecBeforePush = resolveSafePublicationRefspec()')
    expect(runner).toContain("gitOutput(['push', 'origin', refspecBeforePush])")
  })

  it('requires the committed tree to equal the reviewed staged tree before push', () => {
    const expectedTree = runner.indexOf("const expectedTree = gitOutput(['write-tree']).trim()")
    const commit = runner.indexOf("gitOutput(['commit', '-m', `chore(agents): publish continuation iteration ${iteration}`])")
    const committedTree = runner.indexOf("const committedTree = gitOutput(['rev-parse', 'HEAD^{tree}']).trim()")
    const push = runner.indexOf("gitOutput(['push', 'origin', refspecBeforePush])")
    expect(expectedTree).toBeGreaterThan(-1)
    expect(commit).toBeGreaterThan(expectedTree)
    expect(committedTree).toBeGreaterThan(commit)
    expect(push).toBeGreaterThan(committedTree)
    expect(runner).toContain('assertPublicationTreeIntegrity(expectedTree, committedTree)')
  })
})
