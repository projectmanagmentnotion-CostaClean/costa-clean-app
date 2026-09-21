import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('invoice workspace responsive action targets', () => {
  it('keeps invoice detail header actions at the 44px touch minimum through iPad', () => {
    const source = readFileSync('src/features/invoices/invoiceWorkspace.css', 'utf8')

    expect(source).toMatch(
      /@media \(max-width: 1024px\)[\s\S]*?\.cc-detail-panel--invoice \.cc-detail-panel__actions \.cc-record-card__inline-action\s*\{[\s\S]*?min-height:\s*44px/,
    )
  })
})
