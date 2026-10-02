import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_PROJECT_REF = 'wfxnwfcdjainpojhbdri'
export const QA_SUPABASE_ORIGIN = `https://${QA_PROJECT_REF}.supabase.co`
const NORMALIZATION_FUNCTION = 'expense-document-normalization'
const SAFE_RESPONSE_KEYS = new Set([
  'ok', 'errorCode', 'errorMessageSafe', 'normalizationId', 'extractionId',
  'attempt', 'status', 'reviewStatus', 'reconciliationStatus', 'reused',
  'rejectedField', 'rejectedPath', 'field', 'path', 'expectedType', 'actualType',
])

function parseDotEnv(raw) {
  const env = {}
  for (const line of raw.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u)
    if (match) env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/u, '$2')
  }
  return env
}

export function isExactQaSupabaseUrl(value) {
  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === 'https:' && parsedUrl.origin === QA_SUPABASE_ORIGIN
  } catch {
    return false
  }
}

export async function loadAuthoritativeQaEnv(rootDir = process.cwd()) {
  const env = parseDotEnv(await fs.readFile(path.join(rootDir, '.env.qa.local'), 'utf8'))
  if (!isExactQaSupabaseUrl(env.VITE_SUPABASE_URL) || env.VITE_SUPABASE_URL.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('Diagnostic requires the authoritative QA project.')
  }
  if (!env.VITE_SUPABASE_ANON_KEY || !env.COSTACLEAN_QA_AUTH_EMAIL || !env.COSTACLEAN_QA_AUTH_PASSWORD) {
    throw new Error('Diagnostic requires QA public/auth configuration.')
  }
  return env
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function typeOf(value) {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

export function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')
}

function structuralNode(value) {
  if (Array.isArray(value)) return { kind: 'array', length: value.length, items: value.map(structuralNode) }
  if (!isRecord(value)) return { kind: typeOf(value) }
  const keys = Object.keys(value).sort()
  const isField = ['value', 'rawValue', 'confidence', 'source', 'evidence'].every((key) => Object.prototype.hasOwnProperty.call(value, key))
  if (isField) {
    const evidence = isRecord(value.evidence)
      ? { keys: Object.keys(value.evidence).sort(), pageType: typeOf(value.evidence.page), textType: typeOf(value.evidence.text) }
      : { kind: typeOf(value.evidence) }
    return {
      kind: 'extracted-field',
      keys,
      valueType: typeOf(value.value),
      rawValueType: typeOf(value.rawValue),
      confidenceType: typeOf(value.confidence),
      source: typeof value.source === 'string' ? value.source : typeOf(value.source),
      evidence,
    }
  }
  return { kind: 'object', keys, children: Object.fromEntries(keys.map((key) => [key, structuralNode(value[key])])) }
}

export function sanitizeProposal(proposal) {
  return {
    schemaVersion: isRecord(proposal) ? proposal.schemaVersion : null,
    topLevelKeys: isRecord(proposal) ? Object.keys(proposal).sort() : [],
    structure: structuralNode(proposal),
    sha256: sha256Json(proposal),
  }
}

export function safeResponseBody(body) {
  if (!isRecord(body)) return { bodyType: typeOf(body) }
  const safe = {}
  for (const key of SAFE_RESPONSE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = body[key]
      safe[key] = ['errorMessageSafe', 'errorCode', 'status', 'reviewStatus', 'reconciliationStatus', 'rejectedField', 'rejectedPath', 'field', 'path', 'expectedType', 'actualType'].includes(key)
        ? (typeof value === 'string' ? value.slice(0, 240) : null)
        : ['ok', 'reused'].includes(key)
          ? value === true
          : ['attempt'].includes(key)
            ? (Number.isInteger(value) ? value : null)
            : (typeof value === 'string' ? value : null)
    }
  }
  safe.normalizedProposalPresent = Object.prototype.hasOwnProperty.call(body, 'normalizedProposal')
  return safe
}

function safeHeaders(response) {
  return {
    requestId: response.headers.get('x-request-id') ?? response.headers.get('x-requestid'),
    edgeRegion: response.headers.get('x-sb-edge-region'),
    servedBy: response.headers.get('x-served-by'),
  }
}

export function assertNoDiagnosticSecrets(value) {
  const serialized = JSON.stringify(value)
  if (/(?:Bearer\s+eyJ|sk-[A-Za-z0-9]|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/u.test(serialized)) {
    throw new Error('Diagnostic refused to persist suspected secret material.')
  }
  return true
}

function sanitizeExtraction(row) {
  if (!row) return null
  return {
    id: row.id,
    captureDocumentId: row.capture_document_id,
    captureSessionId: row.capture_session_id,
    schemaVersion: row.schema_version,
    status: row.status,
    attempt: row.attempt,
    provider: row.provider,
    providerVersion: row.provider_version,
    modelPresent: typeof row.model === 'string' && row.model.length > 0,
    createdByPresent: typeof row.created_by === 'string',
    rawTextNull: row.raw_text === null,
    proposal: sanitizeProposal(row.proposal),
  }
}

function sanitizeNormalizations(rows) {
  return rows.map((row) => ({
    id: row.id,
    extractionId: row.extraction_id,
    schemaVersion: row.schema_version,
    normalizerVersion: row.normalizer_version,
    attempt: row.attempt_number,
    status: row.status,
    errorCode: row.error_code,
    errorMessageSafe: typeof row.error_message_safe === 'string' ? row.error_message_safe.slice(0, 240) : null,
    errorMessageSafePresent: typeof row.error_message_safe === 'string' && row.error_message_safe.length > 0,
    inputHash: typeof row.input_hash === 'string' && /^[0-9a-f]{64}$/iu.test(row.input_hash) ? row.input_hash : null,
    outputHash: typeof row.output_hash === 'string' && /^[0-9a-f]{64}$/iu.test(row.output_hash) ? row.output_hash : null,
    inputHashPresent: typeof row.input_hash === 'string' && row.input_hash.length === 64,
    outputHashPresent: typeof row.output_hash === 'string' && row.output_hash.length === 64,
    reviewStatus: row.review_status,
    reconciliationStatus: row.reconciliation_status,
  }))
}

export async function buildDiagnosticReport({ rootDir = process.cwd(), extractionId, invokeNormalization = true }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(extractionId)) {
    throw new Error('A valid extractionId is required.')
  }
  const env = await loadAuthoritativeQaEnv(rootDir)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const auth = await client.auth.signInWithPassword({ email: env.COSTACLEAN_QA_AUTH_EMAIL, password: env.COSTACLEAN_QA_AUTH_PASSWORD })
  if (auth.error || !auth.data.session) throw new Error('QA authentication failed.')
  const accessToken = auth.data.session.access_token
  const extractionResult = await client.from('expense_capture_extractions').select('id,capture_document_id,capture_session_id,schema_version,status,attempt,provider,provider_version,model,proposal,raw_text,created_by').eq('id', extractionId).maybeSingle()
  if (extractionResult.error || !extractionResult.data) throw new Error('Extraction row is unavailable for diagnostics.')
  const beforeResult = await client.from('expense_capture_normalizations').select('id,extraction_id,schema_version,normalizer_version,attempt_number,status,error_code,error_message_safe,input_hash,output_hash,review_status,reconciliation_status').eq('extraction_id', extractionId).order('attempt_number', { ascending: true })
  if (beforeResult.error) throw new Error('Normalization rows could not be read.')

  const report = {
    generatedAt: new Date().toISOString(),
    projectRef: QA_PROJECT_REF,
    openAiCalls: 0,
    requestShape: { method: 'POST', bodyKeys: ['extractionId'] },
    extraction: sanitizeExtraction(extractionResult.data),
    normalizationRowsBefore: sanitizeNormalizations(beforeResult.data ?? []),
    normalization: null,
    normalizationRowsAfter: null,
    evidenceCaptureCompletedBeforeCallerCleanup: false,
  }

  if (invokeNormalization) {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${NORMALIZATION_FUNCTION}`, {
      method: 'POST',
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractionId }),
    })
    const body = await response.json().catch(() => null)
    report.normalization = { status: response.status, headers: safeHeaders(response), body: safeResponseBody(body) }
    const afterResult = await client.from('expense_capture_normalizations').select('id,extraction_id,schema_version,normalizer_version,attempt_number,status,error_code,error_message_safe,input_hash,output_hash,review_status,reconciliation_status').eq('extraction_id', extractionId).order('attempt_number', { ascending: true })
    if (afterResult.error) throw new Error('Normalization rows could not be read after invocation.')
    report.normalizationRowsAfter = sanitizeNormalizations(afterResult.data ?? [])
  }

  assertNoDiagnosticSecrets(report)
  report.evidenceCaptureCompletedBeforeCallerCleanup = true
  return report
}

export async function writeDiagnosticReport(report, rootDir = process.cwd()) {
  assertNoDiagnosticSecrets(report)
  const directory = path.join(rootDir, 'qa-reports', 'private', 'expense-normalization-diagnostics')
  await fs.mkdir(directory, { recursive: true })
  const filename = `diagnostic-${report.generatedAt.replace(/[^0-9]/gu, '')}.json`
  const reportPath = path.join(directory, filename)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return reportPath
}

async function main() {
  const extractionId = process.argv[2]
  if (process.argv.includes('--help') || !extractionId) {
    console.log('Usage: node scripts/qa/expenseNormalizationDiagnostic.mjs <extraction-id>')
    console.log('Runs one provider-independent normalization call and writes sanitized evidence before cleanup. It never calls OpenAI.')
    return
  }
  const report = await buildDiagnosticReport({ extractionId })
  const reportPath = await writeDiagnosticReport(report)
  console.log(JSON.stringify({ reportPath, projectRef: report.projectRef, openAiCalls: report.openAiCalls, secretLeak: 0, evidenceCaptureCompletedBeforeCallerCleanup: report.evidenceCaptureCompletedBeforeCallerCleanup }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
