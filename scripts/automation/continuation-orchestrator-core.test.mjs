import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContinuationChainStore, ContinuationOrchestrator, normalizeMaxIterations, safeChainMetadata } from './continuation-orchestrator-core.mjs'

const roots = []
const project = { key: 'ecosystem-config', root: 'C:\\Users\\USUARIO\\costa-clean-app', branch: 'codex/ux-operational-mobile-v2' }
const safePrompt = `# Goal
Bounded local follow-up.
# Verified baseline
The current repository state was inspected.
# Current head
Keep the reviewed current HEAD.
# Scope
Only local code and tests.
# Non-goals
Do not access production, Supabase remote, secrets, or deploy.
# Files/areas
Focused local files only.
# Implementation requirements
Preserve contracts and implement the verified next step.
# Security constraints
No credentials, external actions, or publication.
# Tests
Run targeted local tests.
# Stop conditions
Stop if the worktree identity changes.
# Return format
Report evidence and blockers.`

function root() {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'continuation-orchestrator-'))
  roots.push(value)
  return value
}

function workspace(overrides = {}) {
  return { matchesProject: true, clean: true, head: 'head-1', trackedDiffFingerprint: 'clean', ...overrides }
}

function review(verdict = 'continue', overrides = {}) {
  return {
    verdict,
    summary: 'Verified local evidence.',
    quality_score: 90,
    verified_evidence: ['targeted tests passed'],
    missing_evidence: [],
    risks: [],
    stop_reason: verdict === 'continue' ? '' : 'terminal state',
    next_prompt: verdict === 'continue' ? safePrompt : '',
    ...overrides,
  }
}

function setup(options = {}) {
  const store = new ContinuationChainStore(root())
  const enqueue = vi.fn((prompt) => ({ id: `job-${Math.random().toString(16).slice(2)}`, prompt, status: 'queued' }))
  const orchestrator = new ContinuationOrchestrator({
    store,
    enabled: options.enabled ?? true,
    maxIterations: options.maxIterations ?? 3,
    inspectWorkspace: options.inspectWorkspace ?? (() => workspace()),
    reviewer: options.reviewer ?? vi.fn(async () => review()),
    enqueue,
  })
  const job = { id: 'job-1', prompt: options.initialPrompt ?? 'initial bounded task', status: 'queued' }
  const chain = orchestrator.start(job, project)
  return { store, enqueue, orchestrator, job, chain }
}

afterEach(() => {
  for (const directory of roots.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('continuation orchestrator core', () => {
  it('creates a continuation job after a read-only reviewer continues', async () => {
    const { orchestrator, job, enqueue } = setup()
    const result = await orchestrator.complete(job, 'A sufficiently detailed executor final report.', project)
    expect(result.action).toBe('continue')
    expect(enqueue).toHaveBeenCalledOnce()
    expect(result.nextJob.chainId).toBe(result.chain.chainId)
  })

  it.each([
    ['complete', 'complete'],
    ['blocked', 'blocked'],
    ['stop', 'stopped'],
  ])('stops the chain for a %s verdict', async (verdict, status) => {
    const { orchestrator, job } = setup({ reviewer: async () => review(verdict) })
    const result = await orchestrator.complete(job, 'A sufficiently detailed executor final report.', project)
    expect(result.chain.status).toBe(status)
  })

  it('pauses approval-sensitive follow-ups instead of creating a job', async () => {
    const { orchestrator, job, enqueue } = setup({ reviewer: async () => review('continue', { next_prompt: safePrompt.replace('Only local code and tests.', 'Apply a remote Supabase migration.') }) })
    const result = await orchestrator.complete(job, 'A sufficiently detailed executor final report.', project)
    expect(result.chain.status).toBe('awaiting_approval')
    expect(result.chain.stopReason).toContain('APPROVAL_REQUIRED')
    expect(result.nextJob.status).toBe('awaiting_approval')
    expect(enqueue).toHaveBeenCalledOnce()
    expect(orchestrator.resume(result.nextJob)?.status).toBe('running')
  })

  it('fails closed for invalid reviews, invalid prompts, sensitive output and wrong worktrees', async () => {
    const invalidReview = setup({ reviewer: async () => ({ verdict: 'continue' }) })
    expect((await invalidReview.orchestrator.complete(invalidReview.job, 'A sufficiently detailed executor final report.', project)).chain.status).toBe('failed')

    const invalidPrompt = setup({ reviewer: async () => review('continue', { next_prompt: '# Goal\nMissing required sections.' }) })
    expect((await invalidPrompt.orchestrator.complete(invalidPrompt.job, 'A sufficiently detailed executor final report.', project)).chain.stopReason).toContain('INVALID_NEXT_PROMPT')

    const sensitive = setup()
    expect((await sensitive.orchestrator.complete(sensitive.job, 'OPENAI_API_KEY=not-allowed', project)).chain.stopReason).toBe('SUSPECTED_SECRET_IN_OUTPUT')

    expect(() => setup({ inspectWorkspace: () => workspace({ matchesProject: false }) })).toThrow('configured project')
  })

  it('enforces max iterations, repeated prompts and no-progress guards', async () => {
    const maximum = setup({ maxIterations: 1 })
    expect((await maximum.orchestrator.complete(maximum.job, 'A sufficiently detailed executor final report.', project)).chain.status).toBe('max_iterations')

    const repeated = setup({ initialPrompt: safePrompt, reviewer: async () => review('continue', { next_prompt: safePrompt }) })
    expect((await repeated.orchestrator.complete(repeated.job, 'A sufficiently detailed executor final report.', project)).chain.stopReason).toBe('REPEATED_CONTINUATION_PROMPT')

    let sequence = 0
    const noProgress = setup({ reviewer: async () => review('continue', { next_prompt: `${safePrompt}\nIteration marker: ${++sequence}.` }) })
    const first = await noProgress.orchestrator.complete(noProgress.job, 'A sufficiently detailed executor final report.', project)
    const second = await noProgress.orchestrator.complete(first.nextJob, 'Another sufficiently detailed executor final report.', project)
    expect(second.chain.stopReason).toBe('NO_PROGRESS_DETECTED')
  })

  it('persists only private artifacts, survives restart and exposes metadata without prompt/output bodies', async () => {
    const { store, orchestrator, job, chain } = setup()
    await orchestrator.complete(job, 'A sufficiently detailed executor final report.', project)
    const reloaded = new ContinuationChainStore(store.root)
    const persisted = reloaded.chains.get(chain.chainId)
    const metadata = safeChainMetadata(persisted)
    expect(persisted.currentJobId).not.toBe(job.id)
    expect(metadata).not.toHaveProperty('prompt')
    expect(metadata).not.toHaveProperty('output')
    expect(fs.existsSync(path.join(store.root, chain.chainId, 'iteration-1-executor-final.md'))).toBe(true)
  })

  it('persists an approval pause across restart without dispatching its pending job', async () => {
    const { store, orchestrator, job } = setup({ reviewer: async () => review('continue', { next_prompt: safePrompt.replace('Only local code and tests.', 'Configure a remote Supabase schema change.') }) })
    const result = await orchestrator.complete(job, 'A sufficiently detailed executor final report.', project)
    const reloaded = new ContinuationChainStore(store.root)
    const persisted = reloaded.chains.get(result.chain.chainId)
    expect(persisted.status).toBe('awaiting_approval')
    expect(persisted.currentJobId).toBe(result.nextJob.id)
    expect(persisted.stopReason).toContain('APPROVAL_REQUIRED')
  })

  it('defaults to disabled execution and validates the configured maximum', () => {
    const disabled = setup({ enabled: false })
    expect(disabled.chain).toBeNull()
    expect(normalizeMaxIterations()).toBe(10)
    expect(() => normalizeMaxIterations(11)).toThrow('1 to 10')
  })
})
