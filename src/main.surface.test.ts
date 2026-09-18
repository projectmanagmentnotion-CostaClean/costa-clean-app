import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')

describe('V3 document surface contract', () => {
  it('keeps the document canvas aligned with the V3 default feature flag', () => {
    expect(source).toContain("surface === 'crm' && new URLSearchParams(window.location.search).get('v2') !== '1'")
    expect(source).not.toContain("get('v3') === '1'")
  })

  it('does not apply CRM V3 canvas rules to the client portal surface', () => {
    expect(source).toContain("const surface = resolveApplicationSurface(window.location.pathname)")
  })
})
