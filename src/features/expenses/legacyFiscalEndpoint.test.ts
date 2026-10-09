import { describe, expect, it } from 'vitest'
// @ts-expect-error The legacy endpoint is intentionally kept as a JavaScript Vercel handler.
import handler from '../../../api/expense-fiscal-intelligence.js'

function responseHarness() {
  const response = {
    headers: {} as Record<string, string>,
    statusCode: null as number | null,
    payload: null as Record<string, string> | null,
    setHeader(name: string, value: string) {
      response.headers[name] = value
    },
    status(value: number) {
      response.statusCode = value
      return response
    },
    json(value: Record<string, string>) {
      response.payload = value
      return response
    },
  }
  return response
}

describe('retired fiscal intelligence endpoint', () => {
  it.each(['GET', 'POST', 'OPTIONS'])('returns a safe 410 for %s before request processing', (method) => {
    const response = responseHarness()

    handler({ method, body: { expense: { receipt_file_path: 'attacker-controlled/path.pdf' } } }, response)

    expect(response.statusCode).toBe(410)
    expect(response.payload).toEqual({
      error: 'La inteligencia fiscal heredada ya no esta disponible. Usa el flujo Smart Expense.',
      code: 'LEGACY_FISCAL_INTELLIGENCE_RETIRED',
    })
  })
})
