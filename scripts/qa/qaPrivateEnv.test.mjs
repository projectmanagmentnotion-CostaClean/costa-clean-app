import { describe, expect, it } from 'vitest'
import { parseQaPrivateEnv, requireQaAuthCredentials, resolveQaAuthCredentials } from './qaPrivateEnv.mjs'

describe('QA private auth environment resolution', () => {
  const qaEnv = parseQaPrivateEnv([
    'COSTACLEAN_QA_AUTH_EMAIL=file@example.test',
    'COSTACLEAN_QA_AUTH_PASSWORD= file-password-with-leading-space ',
    'VITE_SUPABASE_URL=https://qa.example.test',
    'VITE_SUPABASE_ANON_KEY=synthetic-anon-key',
  ].join('\n'))

  it('falls back to private-file email and password values', () => {
    expect(resolveQaAuthCredentials({ processEnv: {}, qaEnv })).toEqual({
      email: 'file@example.test',
      password: ' file-password-with-leading-space ',
    })
  })

  it('allows explicit process environment overrides', () => {
    expect(resolveQaAuthCredentials({
      processEnv: {
        COSTACLEAN_QA_AUTH_EMAIL: ' process@example.test ',
        COSTACLEAN_QA_AUTH_PASSWORD: 'process-password',
      },
      qaEnv,
    })).toEqual({ email: 'process@example.test', password: 'process-password' })
  })

  it('can prefer the current private file to protect against stale shell credentials', () => {
    expect(resolveQaAuthCredentials({
      processEnv: {
        COSTACLEAN_QA_AUTH_EMAIL: 'stale@example.test',
        COSTACLEAN_QA_AUTH_PASSWORD: 'stale-password',
      },
      qaEnv,
      preferPrivateFile: true,
    })).toEqual({ email: 'file@example.test', password: ' file-password-with-leading-space ' })
  })

  it('does not trim passwords', () => {
    expect(resolveQaAuthCredentials({ qaEnv }).password).toBe(' file-password-with-leading-space ')
  })

  it('fails closed when either credential is missing', () => {
    expect(() => requireQaAuthCredentials({ qaEnv: { COSTACLEAN_QA_AUTH_EMAIL: 'file@example.test' } }))
      .toThrow('QA_AUTH_INPUT_MISSING')
  })

  it('does not expose synthetic secret values in missing-input diagnostics', () => {
    const syntheticPassword = 'synthetic-password-never-log'
    let message = ''
    try {
      requireQaAuthCredentials({ qaEnv: { COSTACLEAN_QA_AUTH_PASSWORD: syntheticPassword } })
    } catch (error) {
      message = String(error.message)
    }
    expect(message).toBe('QA_AUTH_INPUT_MISSING')
    expect(message).not.toContain(syntheticPassword)
  })
})
