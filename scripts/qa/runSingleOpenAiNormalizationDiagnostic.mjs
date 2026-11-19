import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  assertNoDiagnosticSecrets,
  buildDiagnosticReport,
  loadAuthoritativeQaEnv,
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  sanitizeProposal,
  verifySyntheticInvoiceProposal,
  writeDiagnosticReport,
} from './expenseNormalizationDiagnostic.mjs'

const rootDir = process.cwd()
const FUNCTION_NAME = 'expense-document-openai-extraction'
const BUCKET = 'expense-receipts'
const SYNTHETIC_PDF = 'src/features/expenses/fixtures/smart-expense-synthetic-invoice.pdf'

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function safeHeaders(response) {
  return {
    requestId: response.headers.get('x-request-id') ?? response.headers.get('x-requestid'),
    edgeRegion: response.headers.get('x-sb-edge-region'),
    servedBy: response.headers.get('x-served-by'),
  }
}

function safeProviderBody(body) {
  if (!isRecord(body)) return { bodyType: body === null ? 'null' : typeof body }
  const safe = {}
  for (const key of ['ok', 'errorCode', 'errorMessageSafe', 'extractionId', 'attempt', 'reused']) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue
    const value = body[key]
    safe[key] = key === 'ok' || key === 'reused'
      ? value === true
      : key === 'attempt'
        ? (Number.isInteger(value) ? value : null)
        : (typeof value === 'string' ? value.slice(0, 240) : null)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'proposal')) safe.proposal = sanitizeProposal(body.proposal)
  if (isRecord(body.metadata)) {
    safe.metadata = Object.fromEntries(['provider', 'providerVersion', 'model']
      .filter((key) => typeof body.metadata[key] === 'string')
      .map((key) => [key, body.metadata[key]]))
  }
  return safe
}

function safeError(error) {
  return error instanceof Error ? error.message.slice(0, 240) : 'unknown-error'
}

const summary = {
  projectRef: QA_PROJECT_REF,
  productionRefGuard: PRODUCTION_PROJECT_REF,
  openAiCallsThisGate: 0,
  providerRequestCount: 0,
  sessionId: null,
  documentId: null,
  extractionId: null,
  normalizationId: null,
  reportPath: null,
}
let client = null
let storagePath = null
let diagnosticReport = null
let failure = null

try {
  const env = await loadAuthoritativeQaEnv(rootDir)
  client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const auth = await client.auth.signInWithPassword({ email: env.COSTACLEAN_QA_AUTH_EMAIL, password: env.COSTACLEAN_QA_AUTH_PASSWORD })
  if (auth.error || !auth.data.session) throw new Error('QA authentication failed.')
  const accessToken = auth.data.session.access_token

  const idempotencyKey = `qa-n55-diagnostic-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const sessionResult = await client.rpc('create_expense_capture_session', { p_source: 'upload', p_idempotency_key: idempotencyKey })
  if (sessionResult.error || !isRecord(sessionResult.data) || typeof sessionResult.data.id !== 'string') throw new Error('QA capture session creation failed.')
  summary.sessionId = sessionResult.data.id

  const pdf = await readFile(path.join(rootDir, SYNTHETIC_PDF))
  if (!pdf.subarray(0, 8).toString('ascii').startsWith('%PDF-1.')) throw new Error('Synthetic PDF fixture is invalid.')
  const sha256 = crypto.createHash('sha256').update(pdf).digest('hex')
  storagePath = `captures/${summary.sessionId}/${sha256}.pdf`
  const upload = await client.storage.from(BUCKET).upload(storagePath, new Blob([pdf], { type: 'application/pdf' }), { cacheControl: '3600', upsert: true, contentType: 'application/pdf' })
  if (upload.error) throw new Error('QA document upload failed.')
  const documentResult = await client.rpc('attach_expense_capture_document', {
    p_capture_session_id: summary.sessionId,
    p_storage_path: storagePath,
    p_original_filename: 'qa-diagnostic-invoice-007.pdf',
    p_mime_type: 'application/pdf',
    p_file_size_bytes: pdf.length,
    p_sha256: sha256,
    p_page_index: 0,
  })
  if (documentResult.error || !isRecord(documentResult.data) || typeof documentResult.data.id !== 'string') throw new Error('QA document registration failed.')
  summary.documentId = documentResult.data.id

  const providerResponse = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ captureDocumentId: summary.documentId }),
  })
  summary.providerRequestCount = 1
  summary.openAiCallsThisGate = 1
  const providerBody = await providerResponse.json().catch(() => null)
  const providerEvidence = { status: providerResponse.status, headers: safeHeaders(providerResponse), body: safeProviderBody(providerBody) }
  summary.extractionChecks = verifySyntheticInvoiceProposal(providerBody?.proposal)
  summary.extractionChecksPass = Object.values(summary.extractionChecks).every(Boolean)
  if (isRecord(providerBody) && typeof providerBody.extractionId === 'string') summary.extractionId = providerBody.extractionId
  if (!summary.extractionId) {
    const extractionLookup = await client.from('expense_capture_extractions').select('id').eq('capture_document_id', summary.documentId).order('attempt', { ascending: false }).limit(1).maybeSingle()
    if (extractionLookup.error || !extractionLookup.data?.id) throw new Error('Provider response did not expose an extraction row.')
    summary.extractionId = extractionLookup.data.id
  }

  const diagnostic = await buildDiagnosticReport({ rootDir, extractionId: summary.extractionId, invokeNormalization: true })
  diagnosticReport = { ...diagnostic, provider: providerEvidence, providerRequestCount: summary.providerRequestCount }
  assertNoDiagnosticSecrets(diagnosticReport)
  summary.reportPath = await writeDiagnosticReport(diagnosticReport, rootDir)
  const normalizationRows = Array.isArray(diagnostic.normalizationRowsAfter) ? diagnostic.normalizationRowsAfter : []
  summary.normalizationId = normalizationRows.at(-1)?.id ?? null
  summary.provider = providerEvidence
  summary.normalization = diagnostic.normalization
  summary.normalizationRowsAfter = normalizationRows
  console.log(JSON.stringify(summary, null, 2))
} catch (error) {
  failure = safeError(error)
} finally {
  const cleanup = { storageObjectRemoved: null, captureSessionCancelled: null, auditRetained: true }
  if (client && summary.sessionId) {
    if (storagePath) {
      try {
        const removal = await client.storage.from(BUCKET).remove([storagePath])
        cleanup.storageObjectRemoved = !removal.error
      } catch {
        cleanup.storageObjectRemoved = false
      }
    }
    try {
      const cancellation = await client.rpc('cancel_expense_capture_session', { p_capture_session_id: summary.sessionId })
      cleanup.captureSessionCancelled = !cancellation.error && cancellation.data?.status === 'CANCELLED'
    } catch {
      cleanup.captureSessionCancelled = false
    }
  }
  summary.cleanup = cleanup
  if (diagnosticReport) {
    diagnosticReport.cleanup = cleanup
    try {
      summary.reportPath = await writeDiagnosticReport(diagnosticReport, rootDir)
    } catch {
      failure ??= 'Sanitized diagnostic report could not be finalized.'
    }
  }
  if (failure) {
    summary.error = failure
    process.exitCode = 1
  }
  console.log(JSON.stringify(summary, null, 2))
}
