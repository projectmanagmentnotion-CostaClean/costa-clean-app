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

  it('blocks secrets and automatic publication actions', () => {
    expect(detectSensitiveContent('OPENAI_API_KEY=secret-value')).toBe(true)
    expect(findAutomaticStopReason('Run git push origin main')).toBe('git-publication-not-automatic')
    expect(findAutomaticStopReason('Emitir una factura real')).toBe('invoice-emission-not-safe')
  })

  it('wraps a safe prompt with automatic execution boundaries', () => {
    const prompt = buildExecutorPrompt(safePrompt, 1, 3)
    expect(prompt).toContain('Never commit, push, deploy')
    expect(prompt).toContain('AUTOMATED PROJECT CONTINUATION 1/3')
  })
})
