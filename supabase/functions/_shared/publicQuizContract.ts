export const PUBLIC_QUIZ_VERSION = 'gym-manual-2026-07-22-v1' as const
export const PUBLIC_QUIZ_MAX_BODY_BYTES = 16 * 1024
export const PUBLIC_QUIZ_MIN_INTERACTION_MS = 30_000
export const PUBLIC_QUIZ_MAX_INTERACTION_MS = 2 * 60 * 60 * 1000
export const PUBLIC_QUIZ_CLOCK_SKEW_MS = 10_000

export const PUBLIC_QUIZ_QUESTION_IDS = [
  'q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10',
  'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18', 'q19', 'q20',
] as const

export type PublicQuizQuestionId = (typeof PUBLIC_QUIZ_QUESTION_IDS)[number]
export type PublicQuizOptionId = 'a' | 'b' | 'c' | 'd'

export const PUBLIC_QUIZ_CORRECT_ANSWERS: Readonly<Record<PublicQuizQuestionId, PublicQuizOptionId>> = {
  q01: 'b', q02: 'c', q03: 'd', q04: 'a', q05: 'c',
  q06: 'b', q07: 'd', q08: 'a', q09: 'b', q10: 'c',
  q11: 'a', q12: 'd', q13: 'b', q14: 'c', q15: 'a',
  q16: 'd', q17: 'b', q18: 'c', q19: 'b', q20: 'c',
}

export interface PublicQuizRequest {
  workerName: string
  quizVersion: typeof PUBLIC_QUIZ_VERSION
  answers: Record<PublicQuizQuestionId, PublicQuizOptionId>
  honeypot: ''
  interactionStartedAt: number
  interactionDurationMs: number
  requestNonce: string
}

export interface PublicQuizResult {
  score: number
  percentage: number
  passed: boolean
  totalQuestions: 20
  incorrectQuestionIds: PublicQuizQuestionId[]
}

export type PublicQuizSuccessResponse = { ok: true; result: PublicQuizResult }
export type PublicQuizErrorCode = 'invalid_request' | 'rate_limited' | 'temporarily_unavailable'
export type PublicQuizErrorResponse = {
  ok: false
  error: { code: PublicQuizErrorCode; message: string }
  retryAfterSeconds?: number
}
export type PublicQuizResponse = PublicQuizSuccessResponse | PublicQuizErrorResponse

const requestKeys = [
  'workerName', 'quizVersion', 'answers', 'honeypot',
  'interactionStartedAt', 'interactionDurationMs', 'requestNonce',
] as const
const optionIds = new Set<PublicQuizOptionId>(['a', 'b', 'c', 'd'])
const noncePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

export function normalizePublicQuizWorkerName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

export function validatePublicQuizRequest(value: unknown, now = Date.now()): PublicQuizRequest | null {
  if (!isPlainObject(value) || !hasExactKeys(value, requestKeys)) return null
  if (typeof value.workerName !== 'string') return null
  const normalizedName = normalizePublicQuizWorkerName(value.workerName)
  if (value.workerName !== normalizedName || normalizedName.length < 2 || normalizedName.length > 120) return null
  if (value.quizVersion !== PUBLIC_QUIZ_VERSION || value.honeypot !== '') return null
  const interactionStartedAt = value.interactionStartedAt
  const interactionDurationMs = value.interactionDurationMs
  if (typeof interactionStartedAt !== 'number' || typeof interactionDurationMs !== 'number'
    || !Number.isInteger(interactionStartedAt) || !Number.isInteger(interactionDurationMs)) return null
  if (interactionDurationMs < PUBLIC_QUIZ_MIN_INTERACTION_MS
    || interactionDurationMs > PUBLIC_QUIZ_MAX_INTERACTION_MS) return null
  const elapsed = now - interactionStartedAt
  if (interactionStartedAt > now + PUBLIC_QUIZ_CLOCK_SKEW_MS
    || elapsed > PUBLIC_QUIZ_MAX_INTERACTION_MS + PUBLIC_QUIZ_CLOCK_SKEW_MS
    || Math.abs(elapsed - interactionDurationMs) > PUBLIC_QUIZ_CLOCK_SKEW_MS) return null
  if (typeof value.requestNonce !== 'string' || !noncePattern.test(value.requestNonce)) return null
  if (!isPlainObject(value.answers) || !hasExactKeys(value.answers, PUBLIC_QUIZ_QUESTION_IDS)) return null
  for (const questionId of PUBLIC_QUIZ_QUESTION_IDS) {
    if (typeof value.answers[questionId] !== 'string' || !optionIds.has(value.answers[questionId] as PublicQuizOptionId)) return null
  }
  return value as unknown as PublicQuizRequest
}

export function scorePublicQuizAnswers(answers: PublicQuizRequest['answers']): PublicQuizResult {
  const incorrectQuestionIds = PUBLIC_QUIZ_QUESTION_IDS.filter(
    (questionId) => answers[questionId] !== PUBLIC_QUIZ_CORRECT_ANSWERS[questionId],
  )
  const score = PUBLIC_QUIZ_QUESTION_IDS.length - incorrectQuestionIds.length
  const percentage = Math.round((score * 100) / PUBLIC_QUIZ_QUESTION_IDS.length)
  return { score, percentage, passed: percentage >= 80, totalQuestions: 20, incorrectQuestionIds }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}
