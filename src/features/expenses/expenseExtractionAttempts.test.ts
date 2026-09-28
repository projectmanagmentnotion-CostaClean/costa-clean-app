import { describe, expect, it } from 'vitest'
import { createPendingExtractionAttempt, finishExtractionAttempt, startExtractionAttempt } from './expenseExtractionAttempts'
import { createFixtureExtractionProvider } from './expenseExtractionProvider'

describe('N5.2 extraction attempts', () => {
  it('creates stable idempotency and preserves attempt history', async () => {
    const provider = createFixtureExtractionProvider()
    const attempt = createPendingExtractionAttempt({ captureDocumentId: 'doc-1', captureSessionId: 'session-1', documentSha256: 'a'.repeat(64), schemaVersion: 1, provider: 'fixture', attempt: 1 }, provider.metadata, '2026-09-28T10:00:00.000Z')
    const processing = startExtractionAttempt(attempt, '2026-09-28T10:00:30.000Z')
    const result = await provider.extractDocument({ captureDocumentId: 'doc-1', captureSessionId: 'session-1', originalFilename: 'fixture-invoice.png', mimeType: 'image/png', sizeBytes: 10, sha256: 'a'.repeat(64) })
    if (!result.ok) throw new Error('fixture result should succeed')
    const finished = finishExtractionAttempt(processing, { status: 'SUCCEEDED', proposal: result.proposal }, '2026-09-28T10:01:00.000Z')
    expect(attempt.status).toBe('PENDING')
    expect(processing.status).toBe('PROCESSING')
    expect(attempt.idempotencyKey).toContain('N52-doc-1')
    expect(finished.status).toBe('SUCCEEDED')
    expect(finished.completedAt).toBe('2026-09-28T10:01:00.000Z')
  })

  it('rejects invalid lifecycle finalization', () => {
    const provider = createFixtureExtractionProvider()
    const attempt = createPendingExtractionAttempt({ captureDocumentId: 'doc-1', captureSessionId: 'session-1', documentSha256: 'a'.repeat(64), schemaVersion: 1, provider: 'fixture', attempt: 1 }, provider.metadata)
    const done = finishExtractionAttempt(startExtractionAttempt(attempt), { status: 'FAILED', errorCode: 'EXTRACTION_TIMEOUT', errorMessageSafe: 'Tiempo de espera agotado.' })
    expect(() => finishExtractionAttempt(done, { status: 'SUCCEEDED' })).toThrow('Solo se puede finalizar')
    expect(() => startExtractionAttempt(done)).toThrow('Solo se puede iniciar')
    const pending = createPendingExtractionAttempt({ captureDocumentId: 'doc-2', captureSessionId: 'session-1', documentSha256: 'b'.repeat(64), schemaVersion: 1, provider: 'fixture', attempt: 1 }, provider.metadata)
    expect(() => finishExtractionAttempt(pending, { status: 'FAILED', errorCode: 'EXTRACTION_TIMEOUT' })).toThrow('Solo se puede finalizar un intento en proceso')
  })
})
