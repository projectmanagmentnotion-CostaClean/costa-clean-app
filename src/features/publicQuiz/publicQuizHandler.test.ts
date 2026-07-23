import { describe, expect, it } from 'vitest'
import {
  PUBLIC_QUIZ_CORRECT_ANSWERS,
  PUBLIC_QUIZ_VERSION,
} from '../../../supabase/functions/_shared/publicQuizContract'
import { createPublicQuizHandler } from '../../../supabase/functions/_shared/publicQuizHandler'

const now = 1_800_000_000_000
const validPayload = {
  workerName: 'QA Synthetic Worker',
  quizVersion: PUBLIC_QUIZ_VERSION,
  answers: PUBLIC_QUIZ_CORRECT_ANSWERS,
  honeypot: '',
  interactionStartedAt: now - 31_000,
  interactionDurationMs: 31_000,
  requestNonce: '123e4567-e89b-42d3-a456-426614174000',
}

function setup(rpcResponse: Response = Response.json({
  ok: true,
  result: { score: 20, percentage: 100, passed: true, totalQuestions: 20, incorrectQuestionIds: [] },
})) {
  const fetchCalls: Array<[string, RequestInit]> = []
  const logCalls: Array<{ event: string; status: number }> = []
  const handler = createPublicQuizHandler({
    env: (name) => ({
      SUPABASE_URL: 'https://kpvvydthlxupjjqqdpxy.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'private-test-placeholder',
      PUBLIC_QUIZ_FINGERPRINT_PEPPER: 'pepper-test-placeholder-that-is-long-enough-for-qa',
    })[name],
    fetch: async (input, init) => { fetchCalls.push([input, init]); return rpcResponse },
    now: () => now,
    log: (event) => logCalls.push(event),
  })
  return { handler, fetchCalls, logCalls }
}

function request(body: unknown = validPayload, headers: Record<string, string> = {}) {
  return new Request('https://example.test/quiz', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  })
}

describe('public quiz Edge handler', () => {
  it('forwards only validated data and returns the compact authoritative result', async () => {
    const { handler, fetchCalls, logCalls } = setup()
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      result: { score: 20, percentage: 100, passed: true, totalQuestions: 20, incorrectQuestionIds: [] },
    })
    expect(fetchCalls.length).toBe(1)
    const rpcCall = fetchCalls[0]!
    expect(String(rpcCall[0]).includes('submit_public_gym_manual_quiz_attempt_private')).toBe(true)
    const rpcBody = JSON.parse(String(rpcCall[1]?.body))
    expect(/^[0-9a-f]{64}$/u.test(rpcBody.p_fingerprint_hash)).toBe(true)
    expect(/^[0-9a-f]{64}$/u.test(rpcBody.p_nonce_hash)).toBe(true)
    expect(JSON.stringify(logCalls).includes('203.0.113.7')).toBe(false)
    expect(JSON.stringify(logCalls).includes('QA Synthetic Worker')).toBe(false)
  })

  const invalidCases: Array<[string, Request, number]> = [
    ['wrong method', new Request('https://example.test', { method: 'GET' }), 405],
    ['wrong content type', request(validPayload, { 'content-type': 'text/plain' }), 415],
    ['unknown field', request({ ...validPayload, score: 20 }), 400],
    ['honeypot', request({ ...validPayload, honeypot: 'filled' }), 400],
    ['too fast', request({ ...validPayload, interactionDurationMs: 100 }), 400],
  ]
  for (const [label, input, status] of invalidCases) {
    it(`rejects ${label} with a generic response`, async () => {
      const { handler, fetchCalls } = setup()
      const response = await handler(input)
      expect(response.status).toBe(status)
      expect(/SQL|RPC|REST|worker|payload/iu.test(JSON.stringify(await response.json()))).toBe(false)
      expect(fetchCalls.length).toBe(0)
    })
  }

  it('rejects an oversized declared body before parsing', async () => {
    const { handler } = setup()
    const response = await handler(request(validPayload, { 'content-length': '16385' }))
    expect(response.status).toBe(413)
  })

  it('maps replay, cooldown and window denials to one generic rate response', async () => {
    const { handler } = setup(Response.json({ ok: false, error: { code: 'rate_limited', message: 'private detail' } }))
    const response = await handler(request())
    expect(response.status).toBe(429)
    const text = await response.text()
    expect(text.includes('private detail')).toBe(false)
    expect(response.headers.get('retry-after')).toBe('60')
  })

  it('fails closed when the resolved project is production', async () => {
    const { fetchCalls, logCalls } = setup()
    const handler = createPublicQuizHandler({
      env: (name) => ({
        SUPABASE_URL: 'https://wfxnwfcdjainpojhbdri.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'private-test-placeholder',
        PUBLIC_QUIZ_FINGERPRINT_PEPPER: 'pepper-test-placeholder-that-is-long-enough-for-qa',
      })[name],
      fetch: async (input, init) => { fetchCalls.push([input, init]); return Response.json({ ok: true }) },
      now: () => now,
      log: (event) => logCalls.push(event),
    })
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(fetchCalls.length).toBe(0)
  })
})
