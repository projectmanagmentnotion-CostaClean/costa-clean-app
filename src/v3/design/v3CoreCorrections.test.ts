/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/v3/design/v3.css'), 'utf8')

describe('V3 core correction contracts', () => {
  it('keeps the canonical V3 login logo visible and restrained', () => {
    const logoRule = css.match(/\.v3-auth-page \.auth-brand__logo \{[^}]+\}/u)?.[0] ?? ''

    expect(logoRule).toContain('display: block')
    expect(logoRule).toContain('object-fit: contain')
    expect(logoRule).not.toContain('display: none')
  })

  it('uses the shared 44px touch token for contact and ghost actions', () => {
    const contactRule = css.match(/\.v3-contact-action \{[^}]+\}/u)?.[0] ?? ''
    const ghostRule = css.match(/\.v3-action--ghost \{[^}]+\}/u)?.[0] ?? ''

    expect(contactRule).toContain('min-height: var(--v3-touch-min)')
    expect(ghostRule).toContain('min-height: var(--v3-touch-min)')
  })

  it('keeps compact operational filter tabs at the certified 44px minimum width', () => {
    const filterTabRule = css.match(/\.v3-filter-tabs button \{[^}]+\}/u)?.[0] ?? ''

    expect(filterTabRule).toContain('min-height: var(--v3-touch-preferred)')
    expect(filterTabRule).toContain('min-width: var(--v3-touch-min)')
    expect(filterTabRule).toContain('flex: 0 0 auto')
  })

  it('keeps invoice status pills compact when the invoice description is long', () => {
    const invoiceSideRule = css.match(/(?:^|\n)\.v3-invoice-row__side \{[^}]+\}/u)?.[0] ?? ''

    expect(invoiceSideRule).toContain('align-content: start')
  })

  it('wraps long invoice and payment text inside their grid columns', () => {
    const invoiceMainRule = css.match(/\.v3-invoice-row__main,\s*\.v3-payment-row__main\s*\{[^}]+\}/u)?.[0] ?? ''
    const wrappedTextRule = css.match(/\.v3-invoice-row__main span,\s*\.v3-invoice-row__main small,\s*\.v3-payment-row__main span,\s*\.v3-payment-row__main small\s*\{[^}]+\}/u)?.[0] ?? ''

    expect(invoiceMainRule).toContain('min-width: 0')
    expect(wrappedTextRule).toContain('overflow-wrap: anywhere')
  })

  it('keeps the Leads KPI mobile override after its four-column desktop rule', () => {
    const desktopRule = css.indexOf('.v3-leads-kpi-summary .v3-kpi strong')
    const mobileRuleStart = css.lastIndexOf('.v3-leads-kpi-summary .v3-kpi-group')
    const mobileRuleEnd = css.indexOf('}', mobileRuleStart)
    const mobileRule = css.slice(mobileRuleStart, mobileRuleEnd)

    expect(mobileRuleStart).toBeGreaterThan(desktopRule)
    expect(mobileRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })

  it('stacks dense Leads, invoice, and payment content at narrow phone widths', () => {
    const narrowRuleStart = css.lastIndexOf('@media (max-width: 360px)')
    const narrowRule = css.slice(narrowRuleStart)

    expect(narrowRuleStart).toBeGreaterThan(-1)
    expect(narrowRule).toContain('.v3-leads-kpi-summary .v3-kpi-group')
    expect(narrowRule).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(narrowRule).toContain('.v3-invoice-row__side')
    expect(narrowRule).toContain('.v3-payment-row__side')
    expect(narrowRule).toContain('grid-column: 1 / -1')
    expect(narrowRule).toContain('overflow-wrap: anywhere')
  })
})
