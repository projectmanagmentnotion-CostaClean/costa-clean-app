import { describe, expect, it } from 'vitest'
import { createCorsPreflightResponse, CORS_HEADERS } from '../../../supabase/functions/expense-document-extraction/cors'
import { jsonResponse } from '../../../supabase/functions/expense-document-extraction/responseContract'

const headerNames = [
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
] as const

describe('N5.2 Edge CORS contract', () => {
  it('returns a successful unauthenticated OPTIONS preflight', async () => {
    const response = createCorsPreflightResponse(new Request('https://qa.example/functions/v1/expense-document-extraction', { method: 'OPTIONS' }))

    expect(response?.status).toBe(204)
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response?.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    expect(response?.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(await response?.text()).toBe('')
  })

  it('does not handle POST as preflight and keeps the CORS contract on every JSON response', async () => {
    expect(createCorsPreflightResponse(new Request('https://qa.example/functions/v1/expense-document-extraction', { method: 'POST' }))).toBeNull()

    for (const status of [200, 202, 400, 401, 403, 404, 409, 422, 500]) {
      const response = jsonResponse({ error: 'SAFE_ERROR' }, status)
      expect(response.status).toBe(status)
      for (const headerName of headerNames) expect(response.headers.get(headerName)).toBe(CORS_HEADERS[headerName])
    }
  })
})
