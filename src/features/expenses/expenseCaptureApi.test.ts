import { describe, expect, it } from 'vitest'
import { sha256File, validateExpenseCaptureFile } from './expenseCaptureApi'

describe('expense capture foundation', () => {
  it('accepts supported non-empty files and rejects unsafe inputs', () => {
    expect(validateExpenseCaptureFile({ type: 'application/pdf', size: 12, name: 'ticket.pdf' })).toBeNull()
    expect(validateExpenseCaptureFile({ type: 'application/pdf', size: 0, name: 'ticket.pdf' })).toContain('vacío')
    expect(validateExpenseCaptureFile({ type: 'text/plain', size: 12, name: 'ticket.txt' })).toContain('PDF')
    expect(validateExpenseCaptureFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1, name: 'ticket.png' })).toContain('10 MB')
    expect(validateExpenseCaptureFile({ type: 'image/png', size: 12, name: '../ticket.png' })).toContain('nombre')
  })

  it('calculates a deterministic SHA-256 from bytes, not the filename', async () => {
    const bytes = new TextEncoder().encode('same bytes')
    const first = await sha256File({ arrayBuffer: async () => bytes.buffer })
    const second = await sha256File({ arrayBuffer: async () => bytes.buffer })
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })
})
