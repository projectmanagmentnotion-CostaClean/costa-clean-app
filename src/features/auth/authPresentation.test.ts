import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage, getAuthSubmitLabel } from './authPresentation'

describe('auth presentation', () => {
  it('normalizes invalid credentials without exposing provider internals', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe('El email o la contraseña no son correctos.')
  })

  it('uses a recoverable network message', () => {
    expect(getAuthErrorMessage(new Error('Failed to fetch'))).toContain('conectar')
  })

  it('keeps submit feedback deterministic', () => {
    expect(getAuthSubmitLabel(false)).toBe('Entrar al CRM')
    expect(getAuthSubmitLabel(true)).toBe('Accediendo...')
  })
})
