import { describe, expect, it } from 'vitest'
import {
  buildExecutorPrompt,
  detectSensitiveContent,
  findAutomaticStopReason,
  validatePromptShape,
  validateReview,
} from './projectContinuationAgentCore.mjs'

const safePrompt = `
# Objective
Fix the isolated UI regression.
# Evidence
The current output reports a reproducible viewport failure.
# Scope
Inspect and adjust the shared overlay.
# Non-goals
Do not alter persistence or routes.
# Acceptance criteria
The CTA remains visible in all required viewports.
# Validation
Run lint, build, tests, and visible QA.
# Stop conditions
Stop if authenticated QA is unavailable.
# Delivery
Report files, evidence, and blockers.
`

const authorizedQaPrompt = `
# Objective
Deploy the reviewed quiz protection to QA and publish the validated repository changes.
# Evidence
The versioned Gate 4B authorization limits work to the approved QA project.
# Scope
Run git commit and git push after the QA-only deployment passes validation.
# Non-goals
Do not deploy to production or touch financial flows.
# Acceptance criteria
QA is verified and production remains unchanged.
# Validation
Run lint, build, tests, QA probes, and secret scanning.
# Stop conditions
Stop on any production deployment target or missing private provider access.
# Delivery
Report QA evidence, commit, push, and blockers.
`

function withAuthorizedQaCapabilities(callback) {
  const names = [
    'PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION',
    'PROJECT_CONTINUATION_ALLOW_QA_DEPLOY',
    'PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH',
    'PROJECT_CONTINUATION_AUTHORIZED_QA_REF',
    'PROJECT_CONTINUATION_FORBIDDEN_PROD_REF',
  ]
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = '1'
  process.env.PROJECT_CONTINUATION_ALLOW_QA_DEPLOY = '1'
  process.env.PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH = '1'
  process.env.PROJECT_CONTINUATION_AUTHORIZED_QA_REF = 'qa-ref'
  process.env.PROJECT_CONTINUATION_FORBIDDEN_PROD_REF = 'prod-ref'
  try {
    return callback()
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
}

describe('projectContinuationAgentCore', () => {
  it('accepts a bounded continuation review', () => {
    const review = validateReview({
      verdict: 'continue',
      summary: 'A bounded UI follow-up remains.',
      quality_score: 88,
      verified_evidence: ['lint passed'],
      missing_evidence: ['deployed QA'],
      risks: ['production serves an old build'],
      stop_reason: '',
      next_prompt: safePrompt,
    })
    expect(review.verdict).toBe('continue')
    expect(validatePromptShape(review.next_prompt)).toContain('Acceptance criteria')
  })

  it('requires a reason for non-continuation verdicts', () => {
    expect(() => validateReview({
      verdict: 'blocked',
      summary: 'Blocked.',
      quality_score: 50,
      verified_evidence: [],
      missing_evidence: [],
      risks: [],
      stop_reason: '',
      next_prompt: '',
    })).toThrow('requires stop_reason')
  })

  it('blocks secrets and automatic publication actions by default', () => {
    expect(detectSensitiveContent('OPENAI_API_KEY=secret-value')).toBe(true)
    expect(findAutomaticStopReason('Run git push origin main')).toBe('git-publication-not-automatic')
    expect(findAutomaticStopReason('Deploy the QA build')).toBe('deployment-not-automatic')
    expect(findAutomaticStopReason('Emitir una factura real')).toBe('invoice-emission-not-safe')
  })

  it('permits explicitly authorized QA deployment and publication while still blocking positive production deployment', () => {
    withAuthorizedQaCapabilities(() => {
      expect(findAutomaticStopReason('Deploy the QA build and run git push origin main')).toBeNull()
      expect(findAutomaticStopReason('Deploy to production prod-ref')).toBe('production-deployment-not-authorized')
      expect(findAutomaticStopReason('Production deployment to prod-ref is required now')).toBe('production-deployment-not-authorized')
      const prompt = buildExecutorPrompt(authorizedQaPrompt, 1, 3)
      expect(prompt).toContain('QA-only deployment is permitted')
      expect(prompt).toContain('Commit and push are permitted')
      expect(prompt).toContain('Never deploy to production')
      expect(prompt).toContain('qa-ref')
      expect(prompt).toContain('prod-ref')
    })
  })

  it('does not misclassify explicit production prohibitions as deployment requests', () => {
    withAuthorizedQaCapabilities(() => {
      expect(findAutomaticStopReason('Do not deploy to production prod-ref.')).toBeNull()
      expect(findAutomaticStopReason('Never deploy to production.')).toBeNull()
      expect(findAutomaticStopReason('Production deployment is prohibited.')).toBeNull()
      expect(findAutomaticStopReason('Deploy only to QA; production remains unchanged.')).toBeNull()
      expect(findAutomaticStopReason(authorizedQaPrompt)).toBeNull()
    })
  })

  it('wraps a safe prompt with default automatic execution boundaries', () => {
    const prompt = buildExecutorPrompt(safePrompt, 1, 3)
    expect(prompt).toContain('Never commit or push')
    expect(prompt).toContain('Never deploy')
    expect(prompt).toContain('AUTOMATED PROJECT CONTINUATION 1/3')
  })
})
