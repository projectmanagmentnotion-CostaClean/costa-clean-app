import { describe, expect, it } from 'vitest'
import {
  assertWriteAndCleanAllowed,
  createQaRunId,
  createFlowResult,
  finalizeFlowResult,
  getWriteAndCleanSkipReason,
  isDangerousFinalAction,
  isDryRunMode,
  isSafeOpeningAction,
  isWriteAndCleanMode,
  recordSkippedDangerousAction,
  resolveQaAgentMode,
} from './endUserFlowAgentCore.mjs'

describe('endUserFlowAgentCore', () => {
  it('detects dangerous final actions', () => {
    expect(isDangerousFinalAction('Guardar cambios')).toBe(true)
    expect(isDangerousFinalAction('Registrar cobro final')).toBe(true)
    expect(isDangerousFinalAction('Cancelar')).toBe(false)
  })

  it('allows safe opening actions', () => {
    expect(isSafeOpeningAction('Nueva factura')).toBe(true)
    expect(isSafeOpeningAction('Registrar servicio')).toBe(true)
    expect(isSafeOpeningAction('Guardar cliente')).toBe(false)
  })

  it('defaults to dry-run mode', () => {
    expect(isDryRunMode(undefined)).toBe(true)
    expect(resolveQaAgentMode(undefined)).toBe('dry-run')
  })

  it('accepts write-and-clean mode explicitly', () => {
    expect(isWriteAndCleanMode('write-and-clean')).toBe(true)
    expect(resolveQaAgentMode('write-and-clean')).toBe('write-and-clean')
  })

  it('aborts unsupported modes', () => {
    expect(() => resolveQaAgentMode('live-write')).toThrow('Unsupported QA_AGENT_MODE')
  })

  it('creates a qa run id with the expected prefix', () => {
    expect(createQaRunId(new Date('2026-07-18T10:11:12Z'))).toMatch(/^QA-AUTO-20260718-101112-[A-Z0-9]{6}$/)
  })

  it('blocks production-like write-and-clean runs without explicit allow flag', () => {
    expect(() => assertWriteAndCleanAllowed({
      mode: 'write-and-clean',
      appUrl: 'https://app.costacleanbcn.com/',
      allowWriteClean: '',
    })).toThrow('QA_ALLOW_WRITE_CLEAN=1')
  })

  it('allows local write-and-clean runs without the production gate flag', () => {
    expect(() => assertWriteAndCleanAllowed({
      mode: 'write-and-clean',
      appUrl: 'http://127.0.0.1:4173/',
      allowWriteClean: '',
    })).not.toThrow()
  })

  it('records skipped dangerous actions', () => {
    const result = createFlowResult({
      viewport: { id: 'mobile', width: 390, height: 844 },
      flowId: 'invoice-create',
      viewId: 'invoices',
    })

    recordSkippedDangerousAction(result, 'Guardar', 'dangerous-final-action')
    result.checks.example = true
    finalizeFlowResult(result)

    expect(result.skippedActions).toEqual([
      {
        label: 'Guardar',
        reason: 'dangerous-final-action',
      },
    ])
    expect(result.createdEntities).toEqual([])
    expect(result.cleanup).toBeNull()
    expect(result.passedChecks).toEqual(['example'])
  })

  it('reports explicit write-and-clean safety skips', () => {
    expect(getWriteAndCleanSkipReason('invoice-create', 'outdated')).toBe('production-build-outdated')
    expect(getWriteAndCleanSkipReason('invoice-create', 'current')).toBe('invoice-write-not-safe')
    expect(getWriteAndCleanSkipReason('payment-create')).toBe('payment-write-not-safe')
    expect(getWriteAndCleanSkipReason('fiscal-closing')).toBe('fiscal-write-not-safe')
  })
})
