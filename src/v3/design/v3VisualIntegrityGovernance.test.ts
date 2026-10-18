import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const tokens = read('src/v3/design/tokens.css')
const v3Css = read('src/v3/design/v3.css')
const primitives = read('src/v3/components/V3Primitives.tsx')
const contract = read('docs/V3_VISUAL_INTEGRITY_SYSTEM.md')
const auditScript = read('scripts/qa/v3-10b-auth-audit.mjs')

describe('V3 visual integrity governance', () => {
  it('keeps the versioned contract explicit and scoped', () => {
    for (const heading of [
      '## Purpose and authority',
      '### Full-width shell',
      '### Spacing and rhythm',
      '### Buttons and interactive controls',
      '### Status/chip primitive',
      '## Required responsive certification matrix',
      '## Certification record',
    ]) expect(contract).toContain(heading)
    expect(contract).toContain('WAITING_FOR_STITCH')
    expect(contract).toContain('Any material failure keeps recovery open.')
  })

  it('protects the canonical spacing and governed control geometry', () => {
    for (const value of [4, 8, 12, 16, 20, 24, 32, 40, 48]) {
      expect(tokens).toContain(`--v3-space-${[4, 8, 12, 16, 20, 24, 32, 40, 48].indexOf(value) + 1}: ${value}px`)
    }
    for (const token of [
      '--v3-control-height-primary',
      '--v3-control-height-compact',
      '--v3-control-padding-inline',
      '--v3-control-icon-gap',
      '--v3-status-height',
      '--v3-status-padding-block',
      '--v3-status-padding-inline',
    ]) expect(tokens).toContain(token)
    expect(v3Css).toContain('min-height: var(--v3-control-height-primary)')
    expect(v3Css).toContain('min-height: var(--v3-status-height)')
  })

  it('keeps the shell full-width and the responsive matrix complete', () => {
    expect(v3Css).toContain('html[data-app-surface="v3"] #root')
    expect(v3Css).toContain('max-width: none')
    expect(v3Css).toContain('width: 100%')
    for (const viewport of ['320x568', '390x844', '430x932', '768x1024', '820x1180', '834x1194', '1024x1366', '1280x800', '1440x900', '1920x1080']) {
      expect(contract).toContain(`\`${viewport}\``)
      expect(auditScript).toContain(`id: '${viewport}'`)
    }
  })

  it('has one canonical status primitive and governed action variants', () => {
    expect(primitives).toContain('export function V3EntityStatus')
    expect(primitives).toContain('export const V3Status = V3EntityStatus')
    expect(primitives.match(/export function V3EntityStatus/g)).toHaveLength(1)
    expect(primitives).not.toContain('export function V3Status')
    expect(primitives).not.toContain('export function V3Chip')
    for (const variant of ['v3-action--primary', 'v3-action--secondary', 'v3-action--ghost']) expect(v3Css).toContain(variant)
  })

  it('stacks the Cierres heading at tablet widths and prevents status word fragmentation', () => {
    expect(v3Css).toContain('overflow-wrap: normal')
    expect(v3Css).toContain('word-break: normal')
    expect(v3Css).toContain('@media (max-width: 820px)')
    expect(v3Css).toContain('.v3-closing-section-heading { align-items: stretch; flex-direction: column; }')
  })

  it('keeps reduced motion governance present', () => {
    expect(v3Css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(contract).toContain('prefers-reduced-motion: reduce')
  })
})
