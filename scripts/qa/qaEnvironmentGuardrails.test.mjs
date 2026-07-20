import { describe, expect, it } from 'vitest'
import {
  assertFullSubmitAllowed,
  assertNoPrivilegedFrontendConfig,
  assertQaAgentEnvironmentAllowed,
  assertSandboxPublicConfig,
  resolveQaEnvironment,
} from './qaEnvironmentGuardrails.mjs'

describe('qaEnvironmentGuardrails', () => {
  const sandboxEnv = {
    QA_ENV: 'sandbox',
    VITE_APP_ENV: 'qa',
    VITE_SUPABASE_URL: 'https://sandbox-ref.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-anon-placeholder',
    QA_SANDBOX_PROJECT_REF: 'sandbox-ref',
  }

  it('allows dry-run in production', () => {
    expect(assertQaAgentEnvironmentAllowed({
      mode: 'dry-run',
      appUrl: 'https://app.costacleanbcn.com/',
      env: {},
    })).toBe('production')
  })

  it('classifies local apps as local production config unless explicitly sandboxed', () => {
    expect(resolveQaEnvironment({ appUrl: 'http://127.0.0.1:4173/' })).toBe('local-production-config')
    expect(resolveQaEnvironment({ qaEnv: 'sandbox', appUrl: 'http://127.0.0.1:4174/' })).toBe('sandbox')
  })

  it('requires an explicit write-clean flag outside dry-run', () => {
    expect(() => assertQaAgentEnvironmentAllowed({
      mode: 'write-and-clean',
      appUrl: 'http://127.0.0.1:4173/',
      allowWriteClean: '',
      env: {},
    })).toThrow('QA_ALLOW_WRITE_CLEAN=1')
  })

  it.each(['invoice-create', 'payment-create', 'fiscal-closing'])(
    'blocks %s full submit outside sandbox',
    (flowId) => {
      expect(() => assertFullSubmitAllowed({
        environment: 'production',
        flowId,
        allowFullSubmit: '1',
        allowWriteClean: '1',
        qaRunId: 'QA-AUTO-20260720-120000-ABC123',
        cleanupStrategy: 'registry-and-reset',
        resetStrategy: 'snapshot-restore',
        env: sandboxEnv,
      })).toThrow('only in sandbox')
    },
  )

  it('requires both full-submit permission and a reset strategy', () => {
    const base = {
      environment: 'sandbox',
      flowId: 'invoice-create',
      allowWriteClean: '1',
      qaRunId: 'QA-AUTO-20260720-120000-ABC123',
      cleanupStrategy: 'registry-and-reset',
      env: sandboxEnv,
    }

    expect(() => assertFullSubmitAllowed({ ...base, allowFullSubmit: '', resetStrategy: 'snapshot-restore' }))
      .toThrow('QA_ALLOW_FULL_SUBMIT=1')
    expect(() => assertFullSubmitAllowed({ ...base, allowFullSubmit: '1', resetStrategy: '' }))
      .toThrow('requires snapshot-restore or branch-discard')
  })

  it('requires QA_ENV=sandbox and a matching public project fingerprint', () => {
    const base = {
      environment: 'sandbox',
      flowId: 'invoice-create',
      allowFullSubmit: '1',
      allowWriteClean: '1',
      qaRunId: 'QA-AUTO-20260720-120000-ABC123',
      cleanupStrategy: 'registry-and-reset',
      resetStrategy: 'snapshot-restore',
    }

    expect(() => assertFullSubmitAllowed({ ...base, env: { ...sandboxEnv, QA_ENV: '' } }))
      .toThrow('QA_ENV=sandbox')
    expect(() => assertFullSubmitAllowed({
      ...base,
      env: { ...sandboxEnv, QA_SANDBOX_PROJECT_REF: 'different-ref' },
    })).toThrow('fingerprint')
  })

  it('requires cleanup strategy for full submit', () => {
    expect(() => assertFullSubmitAllowed({
      environment: 'sandbox',
      flowId: 'invoice-create',
      allowFullSubmit: '1',
      allowWriteClean: '1',
      qaRunId: 'QA-AUTO-20260720-120000-ABC123',
      cleanupStrategy: '',
      resetStrategy: 'snapshot-restore',
      env: sandboxEnv,
    })).toThrow('registry-and-reset cleanup strategy')
  })

  it('accepts a fully gated sandbox submit policy', () => {
    expect(assertFullSubmitAllowed({
      environment: 'sandbox',
      flowId: 'invoice-create',
      allowFullSubmit: '1',
      allowWriteClean: '1',
      qaRunId: 'QA-AUTO-20260720-120000-ABC123',
      cleanupStrategy: 'registry-and-reset',
      resetStrategy: 'branch-discard',
      env: sandboxEnv,
    })).toBe(true)
  })

  it('rejects service-role and secret config from frontend/runtime env', () => {
    expect(() => assertNoPrivilegedFrontendConfig({ SUPABASE_SERVICE_ROLE_KEY: 'forbidden' }))
      .toThrow('SUPABASE_SERVICE_ROLE_KEY')
    expect(() => assertNoPrivilegedFrontendConfig({ SUPABASE_SECRET_KEY: 'forbidden' }))
      .toThrow('SUPABASE_SECRET_KEY')
  })

  it('requires a matching sandbox project fingerprint', () => {
    expect(() => assertSandboxPublicConfig({
      VITE_APP_ENV: 'qa',
      VITE_SUPABASE_URL: 'https://sandbox-ref.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-placeholder',
      QA_SANDBOX_PROJECT_REF: 'different-ref',
    })).toThrow('fingerprint')
  })
})
