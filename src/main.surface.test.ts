import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')

describe('V3 document surface contract', () => {
  it('keeps the clean release candidate scoped to the internal V3 CRM surface', () => {
    expect(source).toContain("document.documentElement.dataset.appSurface = 'v3'")
    expect(source).toContain("import('./bootstrapCrm')")
  })

  it('does not bootstrap an excluded client portal surface', () => {
    expect(source).not.toContain('resolveApplicationSurface')
    expect(source).not.toContain('bootstrapPortal')
  })
})
