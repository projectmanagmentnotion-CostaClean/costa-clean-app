import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync(resolve(process.cwd(), 'src/v3/design/tokens.css'), 'utf8')
const v3Css = readFileSync(resolve(process.cwd(), 'src/v3/design/v3.css'), 'utf8')

describe('V3 global visual system contracts', () => {
  it('keeps brand primitives separate from semantic action and status roles', () => {
    expect(tokens).toContain('--v3-brand-primary: #00AEF0')
    expect(tokens).toContain('--v3-brand-accessible: #006B8F')
    expect(tokens).toContain('--v3-color-accent: var(--v3-brand-primary)')
    expect(tokens).toContain('--v3-color-success:')
    expect(tokens).toContain('--v3-color-warning:')
    expect(tokens).toContain('--v3-color-danger:')
    for (const role of [
      '--v3-color-canvas:',
      '--v3-color-primary-surface:',
      '--v3-color-secondary-surface:',
      '--v3-color-elevated-surface:',
      '--v3-color-information:',
      '--v3-color-financial:',
      '--v3-color-financial-soft:',
      '--v3-color-attention:',
      '--v3-color-interactive-accent:',
      '--v3-color-nav-surface:',
      '--v3-color-header-surface:',
      '--v3-color-canvas-surface:',
      '--v3-chart-invoiced:',
      '--v3-chart-collected:',
    ]) expect(tokens).toContain(role)
  })

  it('defines semantic typography, rhythm, elevation and geometry roles', () => {
    for (const token of [
      '--v3-font-size-display',
      '--v3-font-size-page-title',
      '--v3-font-size-workspace-title',
      '--v3-space-section',
      '--v3-space-group',
      '--v3-shadow-hover',
      '--v3-shadow-sheet',
      '--v3-radius-control',
      '--v3-radius-surface',
      '--v3-radius-sheet',
    ]) {
      expect(tokens).toContain(token)
    }
  })

  it('keeps shared interactive geometry at the certified 44px minimum', () => {
    expect(tokens).toContain('--v3-touch-min: 44px')
    expect(v3Css).toContain('min-height: var(--v3-touch-preferred)')
    expect(v3Css).toContain('min-height: var(--v3-touch-min)')
  })

  it('keeps global V3 CSS free of raw color literals', () => {
    expect(v3Css).not.toMatch(/#[0-9a-f]{3,8}\b/iu)
    expect(v3Css).not.toMatch(/rgba?\(/iu)
    expect(v3Css).not.toMatch(/hsla?\(/iu)
  })

  it('governs brand identity, scrollbars and full viewport surfaces centrally', () => {
    expect(v3Css).toContain('[data-brand-lockup="CostaClean"]')
    expect(v3Css).toContain('scrollbar-width: none')
    expect(v3Css).toContain('min-height: 100dvh')
    expect(v3Css).toContain('var(--v3-color-nav-surface)')
    expect(v3Css).toContain('var(--v3-color-header-surface)')
  })
})
