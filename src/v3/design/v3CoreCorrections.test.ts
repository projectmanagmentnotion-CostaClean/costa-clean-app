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
})
