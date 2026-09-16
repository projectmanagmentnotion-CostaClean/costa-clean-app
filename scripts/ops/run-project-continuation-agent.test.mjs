import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { runCandidateDiffCheck, runManagedValidation } from './run-project-continuation-agent.mjs'

const runner = readFileSync('scripts/ops/run-project-continuation-agent.mjs', 'utf8')

describe('continuation publication pipeline', () => {
  it('blocks a dirty initial worktree before the workspace-write executor starts', () => {
    const executeGuard = runner.indexOf('if (options.execute) {')
    const guard = runner.indexOf("assertCleanInitialWorktree(gitResult(['status', '--porcelain']))")
    const executor = runner.indexOf("sandbox: 'workspace-write'")
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

  it('uses bounded validation processes and captures their private evidence', () => {
    expect(runner).toContain('async function runManagedValidation')
    expect(runner).toContain('terminateProcessTree(child)')
    expect(runner).toContain('detached: process.platform !== \'win32\'')
    expect(runner).toContain('setTimeout(() => finish(null), VALIDATION_TERMINATION_GRACE_MS)')
    expect(runner).toContain('timedOut: result.timedOut')
    expect(runner).toContain('assertPublicationValidationResults(validationResults)')
    expect(runner).toContain('iteration-${iteration}-validation-${name}.log')
    for (const timeout of ['900_000', '300_000', '600_000', '120_000']) expect(runner).toContain(timeout)
  })

  it('terminates an owned validation child when its hard timeout expires', async () => {
    const result = await runManagedValidation({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      timeoutMs: 100,
    })
    expect(result.timedOut).toBe(true)
    expect(result.status).not.toBe(0)
    expect(result.durationMs).toBeLessThan(10_000)
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
