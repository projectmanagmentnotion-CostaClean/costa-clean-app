import { describe, expect, it } from 'vitest'
import { parseSandboxEnv, validateSandboxReadiness } from './sandboxReadiness.mjs'

describe('sandboxReadiness', () => {
  const validSandbox = {
    VITE_SUPABASE_URL: 'https://qa-project-ref.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-placeholder',
    VITE_APP_ENV: 'qa',
    QA_SANDBOX_PROJECT_REF: 'qa-project-ref',
    QA_SANDBOX_RESET_STRATEGY: 'branch-discard',
  }

  it('parses names without requiring values to be logged', () => {
    expect(parseSandboxEnv('VITE_APP_ENV=qa\nQA_ENV=sandbox\n')).toEqual({
      VITE_APP_ENV: 'qa',
      QA_ENV: 'sandbox',
    })
  })

  it('accepts a distinct sandbox with an approved reset strategy', () => {
    expect(validateSandboxReadiness({
      sandboxEnv: validSandbox,
      referenceEnv: { VITE_SUPABASE_URL: 'https://production-ref.supabase.co' },
    })).toEqual({
      sandboxFingerprint: 'qa-project-ref',
      resetStrategy: 'branch-discard',
      distinctFromLocalReference: true,
    })
  })

  it('blocks a sandbox that matches the local reference project', () => {
    expect(() => validateSandboxReadiness({
      sandboxEnv: validSandbox,
      referenceEnv: { VITE_SUPABASE_URL: validSandbox.VITE_SUPABASE_URL },
    })).toThrow('isolation is not proven')
  })

  it('rejects private credential names even when their value is empty', () => {
    expect(() => validateSandboxReadiness({
      sandboxEnv: { ...validSandbox, SUPABASE_SERVICE_ROLE_KEY: '' },
    })).toThrow('forbidden private credential name')
  })

  it('requires an approved reset strategy before reporting readiness', () => {
    expect(() => validateSandboxReadiness({
      sandboxEnv: { ...validSandbox, QA_SANDBOX_RESET_STRATEGY: '' },
    })).toThrow('snapshot-restore or branch-discard')
  })
})
