import { describe, expect, it } from 'vitest'
import {
  PUBLIC_QUIZ_CORRECT_ANSWERS,
  PUBLIC_QUIZ_MAX_BODY_BYTES,
  PUBLIC_QUIZ_QUESTION_IDS,
  PUBLIC_QUIZ_VERSION,
  scorePublicQuizAnswers,
  validatePublicQuizRequest,
  type PublicQuizRequest,
} from '../../../supabase/functions/_shared/publicQuizContract'
import { gymManualQuizQuestions } from './quizQuestions'

const now = 1_800_000_000_000

function validRequest(): PublicQuizRequest {
  return {
    workerName: 'QA Synthetic Worker',
    quizVersion: PUBLIC_QUIZ_VERSION,
    answers: { ...PUBLIC_QUIZ_CORRECT_ANSWERS },
    honeypot: '',
    interactionStartedAt: now - 31_000,
    interactionDurationMs: 31_000,
    requestNonce: '123e4567-e89b-42d3-a456-426614174000',
  }
}

describe('public quiz shared contract', () => {
  it('keeps the UI questions aligned with the server-authoritative specification', () => {
    expect(gymManualQuizQuestions.map((question) => question.id).join(',')).toBe(PUBLIC_QUIZ_QUESTION_IDS.join(','))
    for (const question of gymManualQuizQuestions) {
      expect(question.correctOptionId).toBe(PUBLIC_QUIZ_CORRECT_ANSWERS[question.id as keyof typeof PUBLIC_QUIZ_CORRECT_ANSWERS])
      expect(question.options.map((option) => option.id).join(',')).toBe('a,b,c,d')
    }
  })

  it('accepts only the normalized exact versioned request', () => {
    expect(JSON.stringify(validatePublicQuizRequest(validRequest(), now))).toBe(JSON.stringify(validRequest()))
    expect(PUBLIC_QUIZ_MAX_BODY_BYTES).toBe(16_384)
  })

  const invalidRequests: Array<[string, unknown]> = [
    ['unknown field', { ...validRequest(), forgedScore: 20 }],
    ['missing field', (() => { const value = { ...validRequest() } as Partial<PublicQuizRequest>; delete value.honeypot; return value })()],
    ['unnormalized name', { ...validRequest(), workerName: ' QA  Worker ' }],
    ['honeypot', { ...validRequest(), honeypot: 'bot' }],
    ['wrong version', { ...validRequest(), quizVersion: 'other' }],
    ['too fast', { ...validRequest(), interactionStartedAt: now - 1_000, interactionDurationMs: 1_000 }],
    ['future timing', { ...validRequest(), interactionStartedAt: now + 20_000 }],
    ['invalid nonce', { ...validRequest(), requestNonce: 'not-a-uuid' }],
    ['missing answer', { ...validRequest(), answers: { ...validRequest().answers, q20: undefined } }],
    ['invalid option', { ...validRequest(), answers: { ...validRequest().answers, q20: 'z' } }],
  ]
  for (const [label, request] of invalidRequests) {
    it(`rejects ${label}`, () => {
      expect(validatePublicQuizRequest(request, now)).toBeNull()
    })
  }

  it('calculates the result from canonical answers', () => {
    const answers = { ...PUBLIC_QUIZ_CORRECT_ANSWERS, q01: 'a' as const }
    expect(scorePublicQuizAnswers(answers)).toMatchObject({
      score: 19,
      percentage: 95,
      passed: true,
      totalQuestions: 20,
      incorrectQuestionIds: ['q01'],
    })
  })
})
