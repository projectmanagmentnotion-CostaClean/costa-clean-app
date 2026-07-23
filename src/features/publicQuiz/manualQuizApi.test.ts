import { describe, expect, it } from 'vitest'
import { PUBLIC_QUIZ_CORRECT_ANSWERS, PUBLIC_QUIZ_VERSION } from '../../../supabase/functions/_shared/publicQuizContract'

import { createQuizAttempt, PUBLIC_QUIZ_GENERIC_ERROR } from './manualQuizApi'

const payload = {
  workerName: 'QA Synthetic Worker',
  quizVersion: PUBLIC_QUIZ_VERSION,
  answers: { ...PUBLIC_QUIZ_CORRECT_ANSWERS },
  honeypot: '' as const,
  interactionStartedAt: 1_800_000_000_000,
  interactionDurationMs: 31_000,
  requestNonce: '123e4567-e89b-42d3-a456-426614174000',
}

describe('manual quiz API', () => {
  it('uses the Edge Function and consumes only the compact result', async () => {
    const calls: Array<[string, RequestInit]> = []
    const result = await createQuizAttempt(payload, {
      getEnv: () => ({ supabaseUrl: 'https://kpvvydthlxupjjqqdpxy.supabase.co', supabaseAnonKey: 'public-test-placeholder' }),
      fetch: async (input, init) => {
        calls.push([input, init])
        return Response.json({
          ok: true,
          result: { score: 20, percentage: 100, passed: true, totalQuestions: 20, incorrectQuestionIds: [] },
        })
      },
    })
    expect(result).toMatchObject({ score: 20, passed: true })
    const call = calls[0]!
    expect(call[0].includes('/functions/v1/submit-public-gym-manual-quiz')).toBe(true)
    expect(call[0].includes('/rest/v1/rpc/')).toBe(false)
    expect(Object.hasOwn(JSON.parse(String(call[1]?.body)), 'score')).toBe(false)
  })

  it('never exposes a server error body', async () => {
    let message = ''
    try {
      await createQuizAttempt(payload, {
        getEnv: () => ({ supabaseUrl: 'https://kpvvydthlxupjjqqdpxy.supabase.co', supabaseAnonKey: 'public-test-placeholder' }),
        fetch: async () => new Response('SQL secret internal detail', { status: 500 }),
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toBe(PUBLIC_QUIZ_GENERIC_ERROR)
  })
})
