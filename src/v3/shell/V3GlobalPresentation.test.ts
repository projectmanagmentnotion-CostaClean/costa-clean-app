import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3GlobalErrorState, V3GlobalLoadingState } from './V3GlobalPresentation'

describe('V3 global presentation', () => {
  it('uses an accessible native loading state without legacy shell markers', () => {
    const html = renderToStaticMarkup(createElement(V3GlobalLoadingState))

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('v3-global-state')
    expect(html).toContain('v3-brand-lockup')
    expect(html).toContain('Costa Clean')
    expect(html).not.toContain('cc-boot-screen')
    expect(html).not.toContain('auth-card')
    expect(html).not.toMatch(/[\u2600-\u27bf]/u)
  })

  it('keeps recovery copy generic and provides a reload action', () => {
    const html = renderToStaticMarkup(createElement(V3GlobalErrorState))

    expect(html).toContain('role="alert"')
    expect(html).toContain('Recargar')
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)
  })
})
