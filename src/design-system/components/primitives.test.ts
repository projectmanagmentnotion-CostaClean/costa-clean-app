import { describe, expect, it } from 'vitest'
import { getDSBadgeSeverityTone } from './badgeModel'
import { getDSButtonClassNames } from './buttonModel'

describe('shared operational primitive models', () => {
  it('keeps the four button hierarchy variants distinct', () => {
    expect(getDSButtonClassNames({ tone: 'primary', fullWidth: false, loading: false })).toContain('primary-button')
    expect(getDSButtonClassNames({ tone: 'secondary', fullWidth: false, loading: false })).toContain('secondary-button')
    expect(getDSButtonClassNames({ tone: 'tertiary', fullWidth: false, loading: false })).toContain('tertiary-button')
    expect(getDSButtonClassNames({ tone: 'danger', fullWidth: false, loading: false })).toContain('danger-button')
  })

  it('marks loading buttons and full-width actions without losing hierarchy', () => {
    const classes = getDSButtonClassNames({ tone: 'primary', fullWidth: true, loading: true })
    expect(classes).toContain('ds-button--full')
    expect(classes).toContain('ds-button--loading')
    expect(classes).toContain('primary-button')
  })

  it('maps semantic danger to the existing critical severity rendering', () => {
    expect(getDSBadgeSeverityTone('danger')).toBe('critical')
    expect(getDSBadgeSeverityTone('warning')).toBe('warning')
  })
})
