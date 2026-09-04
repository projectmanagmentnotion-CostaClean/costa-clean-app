import { describe, expect, it } from 'vitest'
import { ALLOWED_NOTIFICATION_PATHS, sanitizeNotificationPath } from './notificationSystem'

describe('notification routing', () => {
  it('keeps only Costa Clean contextual destinations', () => {
    expect(sanitizeNotificationPath('/?view=invoices&filter=overdue')).toBe('/?view=invoices&filter=overdue')
    expect(sanitizeNotificationPath('/?view=expenses&filter=missing_support')).toBe('/?view=expenses&filter=missing_support')
    expect(sanitizeNotificationPath('https://evil.example')).toBe('/')
    expect(sanitizeNotificationPath('//evil.example')).toBe('/')
    expect(sanitizeNotificationPath('/admin')).toBe('/')
  })

  it('keeps the allowlist finite and explicit', () => {
    expect(ALLOWED_NOTIFICATION_PATHS.size).toBe(5)
  })
})
