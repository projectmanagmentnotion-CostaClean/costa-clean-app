import { afterEach, describe, expect, it, vi } from 'vitest'
import { openQuotePrintWindow } from './openQuotePrintWindow'
import type { QuoteListItem } from './types'

function createQuote(): QuoteListItem {
  return {
    id: 'quote-existing',
    display_code: 'QUO-0049',
    client_id: 'client-existing',
    property_id: null,
    status: 'draft',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('quote print output fallback', () => {
  it('returns a blocked-window result without invoking a native alert', () => {
    const alert = vi.fn()
    vi.stubGlobal('window', { open: vi.fn(() => null), alert })

    expect(openQuotePrintWindow(createQuote(), [], [], 'print')).toBe(false)
    expect(alert).not.toHaveBeenCalled()
  })
})
