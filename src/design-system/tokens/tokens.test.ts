import { describe, expect, it } from 'vitest'
import { dsSpacing, dsTypography } from './tokens'

describe('design system token registry', () => {
  it('exposes the canonical spacing scale through 64px', () => {
    expect(dsSpacing[10]).toBe('var(--ds-space-10)')
    expect(dsSpacing[11]).toBe('var(--ds-space-11)')
  })

  it('exposes semantic typography roles instead of page-local sizes', () => {
    expect(dsTypography.display).toBe('var(--ds-font-size-display)')
    expect(dsTypography.sectionTitle).toBe('var(--ds-font-size-section-title)')
    expect(dsTypography.metadata).toBe('var(--ds-font-size-metadata)')
  })
})
