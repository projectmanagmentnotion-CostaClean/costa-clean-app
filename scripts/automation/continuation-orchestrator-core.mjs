import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  detectSensitiveContent,
  findAutomaticStopReason,
  validatePromptShape,
  validateReview,
} from '../ops/projectContinuationAgentCore.mjs'
import { approvalReason, hashPrompt } from './bridge-core.mjs'

export const DEFAULT_MAX_ITERATIONS = 10
export const CHAIN_STATUSES = new Set([
  'running',
  'awaiting_approval',
  'complete',
  'blocked',
  'stopped',
  'max_iterations',
  'failed',
])

export function normalizeMaxIterations(value) {
  const resolved = value === undefined || value === '' ? DEFAULT_MAX_ITERATIONS : Number(value)
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 10) {
    throw new Error('PROJECT_CONTINUATION_MAX_ITERATIONS must be an integer from 1 to 10.')
  }
  return resolved
}

export function workspaceFingerprint(workspace) {
  const input = [workspace.head ?? '', workspace.trackedDiffFingerprint ?? ''].join('\n')
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

export function safeChainMetadata(chain) {
  return {
    chainId: chain.chainId,
    projectKey: chain.projectKey,
    initialJobId: chain.initialJobId,
    currentJobId: chain.currentJobId,
    iteration: chain.iteration,
    maxIterations: chain.maxIterations,
    status: chain.status,
    startedAt: chain.startedAt,
    updatedAt: chain.updatedAt,
    ...(chain.stopReason ? { stopReason: chain.stopReason } : {}),
  }
}

export class ContinuationChainStore {
  constructor(root, now = () => new Date().toISOString()) {
    this.root = root
    this.now = now
    this.chains = new Map()
    fs.mkdirSync(root, { recursive: true })
    this.load()
  }

  load() {
    for (const directory of fs.readdirSync(this.root, { withFileTypes: true })) {
      if (!directory.isDirectory()) continue
      const manifestPath = path.join(this.root, directory.name, 'manifest.json')
      try {
        const chain = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        if (chain?.chainId && CHAIN_STATUSES.has(chain.status)) this.chains.set(chain.chainId, chain)
      } catch {
        // A partial private artifact must not resume work automatically.
      }
    }
  }

  create(input) {
    const chainId = crypto.randomUUID()
    const timestamp = this.now()
    const chain = {
      chainId,
      projectKey: input.projectKey,
      initialJobId: input.initialJobId,
      currentJobId: input.initialJobId,
      iteration: 1,
      maxIterations: input.maxIterations,
      status: input.status ?? 'running',
      startedAt: timestamp,
      updatedAt: timestamp,
      executedPromptHashes: [input.promptHash],
      lastExecutionFingerprint: input.workspaceFingerprint,
      noProgressRepeats: 0,
    }
    this.chains.set(chainId, chain)
    this.save(chain)
    return chain
  }

  save(chain) {
    chain.updatedAt = this.now()
    const directory = path.join(this.root, chain.chainId)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(chain, null, 2)}\n`, 'utf8')
  }

  writeArtifact(chain, name, value) {
    const directory = path.join(this.root, chain.chainId)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }

  forJob(jobId) {
    return [...this.chains.values()].find((chain) => chain.currentJobId === jobId) ?? null
  }
}

function stop(chain, store, status, reason) {
  chain.status = status
  chain.stopReason = reason
  store.save(chain)
  return { chain, action: status }
}

export class ContinuationOrchestrator {
  constructor({ store, enabled, maxIterations, inspectWorkspace, reviewer, enqueue, now = () => new Date().toISOString() }) {
    this.store = store
    this.enabled = enabled
    this.maxIterations = normalizeMaxIterations(maxIterations)
    this.inspectWorkspace = inspectWorkspace
    this.reviewer = reviewer
    this.enqueue = enqueue
    this.now = now
  }

  start(job, project) {
    if (!this.enabled) return null
    const workspace = this.inspectWorkspace(project)
    if (!workspace.matchesProject || !workspace.clean) {
      throw new Error('Continuation chain requires the configured project, branch and a clean initial worktree.')
    }
    const chain = this.store.create({
      projectKey: project.key,
      initialJobId: job.id,
      promptHash: hashPrompt(job.prompt),
      maxIterations: this.maxIterations,
      workspaceFingerprint: workspaceFingerprint(workspace),
      status: job.status === 'awaiting_approval' ? 'awaiting_approval' : 'running',
    })
    job.chainId = chain.chainId
    return chain
  }

  resume(job) {
    const chain = this.store.forJob(job.id)
    if (!chain || chain.status !== 'awaiting_approval') return null
    chain.status = 'running'
    delete chain.stopReason
    this.store.save(chain)
    return chain
  }

  async complete(job, output, project) {
    const chain = this.store.forJob(job.id)
    if (!chain || !this.enabled) return null
    if (chain.status !== 'running') return stop(chain, this.store, 'stopped', 'CHAIN_NOT_RUNNING')
    if (!output?.trim()) return stop(chain, this.store, 'failed', 'EMPTY_CODEX_OUTPUT')
    if (detectSensitiveContent(output)) return stop(chain, this.store, 'failed', 'SUSPECTED_SECRET_IN_OUTPUT')

    const workspace = this.inspectWorkspace(project)
    if (!workspace.matchesProject) return stop(chain, this.store, 'failed', 'WORKSPACE_OR_BRANCH_MISMATCH')

    this.store.writeArtifact(chain, `iteration-${chain.iteration}-executor-final.md`, output)
    let review
    try {
      review = validateReview(await this.reviewer({ chain, job, output, project }))
    } catch (error) {
      return stop(chain, this.store, 'failed', `INVALID_REVIEW:${error instanceof Error ? error.message : String(error)}`)
    }
    this.store.writeArtifact(chain, `iteration-${chain.iteration}-review.json`, review)

    if (review.verdict !== 'continue') {
      const status = review.verdict === 'complete' ? 'complete' : review.verdict === 'blocked' ? 'blocked' : 'stopped'
      return stop(chain, this.store, status, review.stop_reason)
    }

    try {
      validatePromptShape(review.next_prompt)
    } catch (error) {
      return stop(chain, this.store, 'failed', `INVALID_NEXT_PROMPT:${error instanceof Error ? error.message : String(error)}`)
    }
    if (detectSensitiveContent(review.next_prompt)) return stop(chain, this.store, 'failed', 'SUSPECTED_SECRET_IN_NEXT_PROMPT')

    this.store.writeArtifact(chain, `iteration-${chain.iteration}-next-prompt.md`, `${review.next_prompt.trim()}\n`)
    if (chain.iteration >= chain.maxIterations) return stop(chain, this.store, 'max_iterations', 'MAX_ITERATIONS_REACHED')

    const promptHash = hashPrompt(review.next_prompt)
    if (chain.executedPromptHashes.includes(promptHash)) return stop(chain, this.store, 'stopped', 'REPEATED_CONTINUATION_PROMPT')

    const approval = approvalReason(review.next_prompt) || findAutomaticStopReason(review.next_prompt)
    if (approval) {
      const nextJob = this.enqueue(review.next_prompt, job, chain)
      if (!nextJob?.id) return stop(chain, this.store, 'failed', 'NEXT_JOB_CREATION_FAILED')
      nextJob.status = 'awaiting_approval'
      nextJob.approvalReason = approval
      nextJob.chainId = chain.chainId
      chain.executedPromptHashes.push(promptHash)
      chain.iteration += 1
      chain.currentJobId = nextJob.id
      chain.status = 'awaiting_approval'
      chain.stopReason = `APPROVAL_REQUIRED:${approval}`
      this.store.save(chain)
      return { chain, action: 'awaiting_approval', nextJob }
    }

    const currentFingerprint = workspaceFingerprint(workspace)
    chain.noProgressRepeats = currentFingerprint === chain.lastExecutionFingerprint ? chain.noProgressRepeats + 1 : 0
    chain.lastExecutionFingerprint = currentFingerprint
    if (chain.noProgressRepeats >= 2) return stop(chain, this.store, 'stopped', 'NO_PROGRESS_DETECTED')

    const nextJob = this.enqueue(review.next_prompt, job, chain)
    if (!nextJob?.id) return stop(chain, this.store, 'failed', 'NEXT_JOB_CREATION_FAILED')
    chain.executedPromptHashes.push(promptHash)
    chain.iteration += 1
    chain.currentJobId = nextJob.id
    nextJob.chainId = chain.chainId
    this.store.save(chain)
    return { chain, action: 'continue', nextJob }
  }
}
