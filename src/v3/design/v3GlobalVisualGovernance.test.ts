import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shell = readFileSync(resolve(process.cwd(), 'src/v3/shell/V3ShellChrome.tsx'), 'utf8')
const presentation = readFileSync(resolve(process.cwd(), 'src/v3/shell/V3GlobalPresentation.tsx'), 'utf8')
const css = readFileSync(resolve(process.cwd(), 'src/v3/design/v3.css'), 'utf8')
const tokens = readFileSync(resolve(process.cwd(), 'src/v3/design/tokens.css'), 'utf8')

describe('R5.5 global visual governance', () => {
  it('uses one canonical lockup and separates responsive brand zones', () => {
    expect(shell).toContain("import { V3BrandLockup } from '../brand/V3BrandLockup'")
    expect(shell).not.toContain('brandAssets.logoPrimary')
    expect(css).toContain('.v3-top-bar__screen-label')
    expect(shell.match(/<V3BrandLockup\s*\/>/g)).toHaveLength(1)
    expect(presentation).toContain('<V3BrandLockup />')
    expect(css).toContain('@media (max-width: 360px)')
    expect(css).toContain('.v3-top-bar__screen-label { max-width: 30vw;')
  })

  it('governs semantic nav/header/canvas surfaces and hidden scrollbars', () => {
    for (const token of ['--v3-color-nav-surface:', '--v3-color-header-surface:', '--v3-color-canvas-surface:', '--v3-chart-invoiced:', '--v3-chart-collected:']) expect(tokens).toContain(token)
    expect(css).toContain('scrollbar-width: none')
    expect(css).toContain('::-webkit-scrollbar')
    expect(css).toContain('min-height: 100dvh')
  })

  it('keeps reduced motion and branded loading contracts centralized', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(presentation).toContain('aria-busy="true"')
    expect(presentation).toContain('V3BrandLockup')
  })
})
