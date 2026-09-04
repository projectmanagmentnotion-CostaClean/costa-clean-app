import { describe, expect, it } from 'vitest'
import { sanitizeNotificationPath } from './notificationSystem'

describe('notification routing', () => {
  it('keeps only Costa Clean contextual destinations', () => {
    expect(sanitizeNotificationPath('/?view=invoices&filter=overdue')).toBe('/?view=invoices&filter=overdue')
    expect(sanitizeNotificationPath('/?view=expenses&filter=missing_support')).toBe('/?view=expenses&filter=missing_support')
    expect(sanitizeNotificationPath('https://evil.example')).toBe('/')
    expect(sanitizeNotificationPath('//evil.example')).toBe('/')
    expect(sanitizeNotificationPath('/admin')).toBe('/')
  })

  it('accepts only known contextual filters', () => {
    expect(sanitizeNotificationPath('/?view=jobs&filter=completed_without_invoice&job=JOB-0037')).toContain('job=JOB-0037')
    expect(sanitizeNotificationPath('/?view=alerts&filter=all')).toBe('/?view=alerts&filter=all')
    expect(sanitizeNotificationPath('/?view=expenses&filter=unknown')).toBe('/')
  })
})
