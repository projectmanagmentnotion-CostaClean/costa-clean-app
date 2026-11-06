import { describe, expect, it, vi } from 'vitest'
import handler from './expense-fiscal-intelligence.js'

function createResponse() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
}

describe('legacy fiscal intelligence endpoint', () => {
  it('fails closed with 410 without processing a POST body', () => {
    const response = createResponse()

    handler(
      {
        method: 'POST',
        body: {
          expense: { receipt_file_path: 'attacker-controlled/path.pdf' },
        },
      },
      response,
    )

    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith({
      error: 'La inteligencia fiscal heredada ya no esta disponible. Usa el flujo Smart Expense.',
      code: 'LEGACY_FISCAL_INTELLIGENCE_RETIRED',
    })
    expect(response.setHeader).not.toHaveBeenCalled()
  })

  it('advertises POST only while still remaining retired for other methods', () => {
    const response = createResponse()

    handler({ method: 'GET' }, response)

    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'POST')
    expect(response.status).toHaveBeenCalledWith(410)
  })
})
