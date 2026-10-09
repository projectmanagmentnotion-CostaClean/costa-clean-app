import type { ExtractionAttemptIdentity, ExtractionAttemptRecord, ExtractionProviderMetadata, ExtractionProposal, ExtractionStatus } from './expenseExtractionContract'

export function buildExtractionAttemptIdempotencyKey(identity: Omit<ExtractionAttemptIdentity, 'idempotencyKey' | 'attempt'>, attempt: number): string {
  return `N52-${identity.captureDocumentId}-${identity.documentSha256}-${identity.schemaVersion}-${identity.provider}-${attempt}`
}

export function createPendingExtractionAttempt(identity: Omit<ExtractionAttemptIdentity, 'idempotencyKey'> & { attempt: number }, metadata: ExtractionProviderMetadata, now = new Date().toISOString()): ExtractionAttemptRecord {
  return {
    ...identity,
    id: `local-${identity.captureDocumentId}-${identity.attempt}`,
    idempotencyKey: buildExtractionAttemptIdempotencyKey(identity, identity.attempt),
    ...metadata,
    status: 'PENDING', proposal: null, rawText: null, startedAt: null, completedAt: null, failedAt: null, errorCode: null, errorMessageSafe: null, createdAt: now, updatedAt: now,
  }
}

export function startExtractionAttempt(record: ExtractionAttemptRecord, now = new Date().toISOString()): ExtractionAttemptRecord {
  if (record.status !== 'PENDING') throw new Error('Solo se puede iniciar un intento pendiente.')
  return { ...record, status: 'PROCESSING', startedAt: now, updatedAt: now }
}

export function finishExtractionAttempt(record: ExtractionAttemptRecord, result: { status: Extract<'SUCCEEDED' | 'FAILED', ExtractionStatus>; proposal?: ExtractionProposal | null; errorCode?: string | null; errorMessageSafe?: string | null }, now = new Date().toISOString()): ExtractionAttemptRecord {
  if (record.status !== 'PROCESSING') throw new Error('Solo se puede finalizar un intento en proceso.')
  if (result.status === 'SUCCEEDED' && !result.proposal) throw new Error('Un intento correcto debe conservar una propuesta.')
  if (result.status === 'FAILED' && !result.errorCode) throw new Error('Un intento fallido debe conservar un código de error.')
  return { ...record, status: result.status, proposal: result.proposal ?? null, completedAt: result.status === 'SUCCEEDED' ? now : null, failedAt: result.status === 'FAILED' ? now : null, errorCode: result.errorCode ?? null, errorMessageSafe: result.errorMessageSafe ?? null, updatedAt: now }
}
