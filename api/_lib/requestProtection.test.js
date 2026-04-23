import { describe, expect, it } from 'vitest'
import {
  getClientIp,
  isHoneypotTriggered,
  registerIpAttempt,
  requestProtectionConfig,
  validateSubmissionTiming,
} from './requestProtection.js'

describe('requestProtection', () => {
  it('detects honeypot submissions', () => {
    expect(isHoneypotTriggered({ website: '' })).toBe(false)
    expect(isHoneypotTriggered({ website: 'https://spam.test' })).toBe(true)
  })

  it('validates form age boundaries', () => {
    const startedAt = '2026-04-23T10:00:00.000Z'
    const tooFast = validateSubmissionTiming({
      startedAt,
      submittedAt: '2026-04-23T10:00:02.000Z',
      nowMs: Date.parse('2026-04-23T10:00:02.000Z'),
    })
    expect(tooFast.ok).toBe(false)

    const valid = validateSubmissionTiming({
      startedAt,
      submittedAt: '2026-04-23T10:00:08.000Z',
      nowMs: Date.parse('2026-04-23T10:00:08.000Z'),
    })
    expect(valid.ok).toBe(true)
  })

  it('extracts the client ip from forwarded headers', () => {
    const ip = getClientIp({
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.1',
      },
    })

    expect(ip).toBe('198.51.100.10')
  })

  it('throttles repeated ip attempts inside the same window', () => {
    const baseMs = Date.parse('2026-04-23T10:00:00.000Z')
    const ip = '203.0.113.10'

    for (let attempt = 0; attempt < requestProtectionConfig.maxSubmissionsPerIpWindow; attempt += 1) {
      expect(registerIpAttempt(ip, baseMs + attempt)).toBe(true)
    }

    expect(registerIpAttempt(ip, baseMs + 60_000)).toBe(false)
    expect(registerIpAttempt(ip, baseMs + requestProtectionConfig.ipWindowMs + 1)).toBe(true)
  })
})
