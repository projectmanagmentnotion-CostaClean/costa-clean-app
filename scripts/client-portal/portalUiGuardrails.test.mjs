import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const accessScreenSource = readFileSync(
  new URL('../../src/portal/PortalAccessScreen.tsx', import.meta.url),
  'utf8',
)
const authScreenSource = readFileSync(
  new URL('../../src/portal/PortalAuthScreen.tsx', import.meta.url),
  'utf8',
)
const motionSurfaceSource = readFileSync(
  new URL('../../src/portal/PortalMotionSurface.tsx', import.meta.url),
  'utf8',
)
const portalCssSource = readFileSync(
  new URL('../../src/portal/portal.css', import.meta.url),
  'utf8',
)

describe('portal authentication UI guardrails', () => {
  it('keeps iPhone-safe sizing, dynamic viewport and safe-area support', () => {
    expect(portalCssSource.includes('100dvh')).toBe(true)
    expect(portalCssSource.includes('env(safe-area-inset-top)')).toBe(true)
    expect(portalCssSource.includes('env(safe-area-inset-right)')).toBe(true)
    expect(portalCssSource.includes('env(safe-area-inset-bottom)')).toBe(true)
    expect(portalCssSource.includes('env(safe-area-inset-left)')).toBe(true)
    expect(portalCssSource.includes('font-size: 16px')).toBe(true)
    expect(portalCssSource.includes('min-height: 44px')).toBe(true)
  })

  it('supports autofill, password managers and accessible field errors', () => {
    expect(authScreenSource.includes('autoComplete="email"')).toBe(true)
    expect(authScreenSource.includes('autoComplete="current-password"')).toBe(true)
    expect(authScreenSource.includes('autoComplete="new-password"')).toBe(true)
    expect(authScreenSource.includes('aria-invalid')).toBe(true)
    expect(authScreenSource.includes('aria-describedby')).toBe(true)
    expect(authScreenSource.includes('aria-pressed')).toBe(true)
    expect(authScreenSource.includes('label htmlFor={id}')).toBe(true)
    expect(authScreenSource.includes('tabIndex={-1}')).toBe(true)
    expect(portalCssSource.includes(':-webkit-autofill')).toBe(true)
  })

  it('preserves native button semantics and announces access-state changes', () => {
    expect(accessScreenSource.includes('role="listitem"')).toBe(false)
    expect(accessScreenSource.includes('<ul className="portal-account-choice"')).toBe(true)
    expect(accessScreenSource.includes("role={isUrgent ? 'alert' : 'status'}")).toBe(true)
    expect(accessScreenSource.includes("aria-live={isUrgent ? 'assertive' : 'polite'}")).toBe(true)
    expect(accessScreenSource.includes('titleRef.current?.focus()')).toBe(true)
  })

  it('uses scoped GSAP cleanup and no ScrollTrigger in authentication', () => {
    expect(motionSurfaceSource.includes('useGSAP')).toBe(true)
    expect(motionSurfaceSource.includes('revertOnUpdate: true')).toBe(true)
    expect(motionSurfaceSource.includes('portalReducedMotion')).toBe(true)
    expect(motionSurfaceSource.includes('stateKey')).toBe(true)
    expect(motionSurfaceSource.includes("clearProps: 'transform'")).toBe(true)
    expect(motionSurfaceSource.includes('autoAlpha')).toBe(false)
    expect(
      `${authScreenSource}${motionSurfaceSource}`.includes('ScrollTrigger'),
    ).toBe(false)
  })

  it('defines a reduced-motion fallback without hiding semantic content in CSS', () => {
    expect(portalCssSource.includes('@media (prefers-reduced-motion: reduce)')).toBe(true)
    expect(portalCssSource.includes('visibility: hidden')).toBe(false)
  })
})
