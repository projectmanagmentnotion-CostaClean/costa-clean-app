import fs from 'node:fs/promises'
import path from 'node:path'

export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_PROJECT_REF = 'wfxnwfcdjainpojhbdri'
export const EXPENSE_RECEIPTS_BUCKET = 'expense-receipts'

function nonEmpty(value, label) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${label} is required`)
  return text
}

function exactIds(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`)
  return values.map((value, index) => {
    const id = nonEmpty(value, `${label}[${index}]`)
    if (/[,*%]/u.test(id)) throw new Error(`${label}[${index}] must be an exact identifier`)
    return id
  })
}

export function assertQaTarget({ projectRef, supabaseUrl }) {
  const ref = nonEmpty(projectRef, 'projectRef')
  const url = nonEmpty(supabaseUrl, 'supabaseUrl')
  const hostname = new URL(url).hostname
  const urlRef = hostname.match(/^([a-z0-9]+)\.supabase\.co$/u)?.[1] ?? null
  if (ref === PRODUCTION_PROJECT_REF || urlRef === PRODUCTION_PROJECT_REF) {
    throw new Error('QA cleanup aborted: production project detected.')
  }
  if (ref !== QA_PROJECT_REF || urlRef !== QA_PROJECT_REF) {
    throw new Error(`QA cleanup aborted: target must be ${QA_PROJECT_REF}.`)
  }
}

export function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Fixture manifest must be an object.')
  const manifest = raw
  const projectRef = nonEmpty(manifest.projectRef, 'projectRef')
  const storagePaths = exactIds(manifest.storagePaths ?? [], 'storagePaths')
  if (storagePaths.some((value) => !value.startsWith('expenses/'))) throw new Error('Storage paths must stay under expenses/.')
  return {
    projectRef,
    clientIds: exactIds(manifest.clientIds ?? [], 'clientIds'),
    invoiceIds: exactIds(manifest.invoiceIds ?? [], 'invoiceIds'),
    invoiceLineIds: exactIds(manifest.invoiceLineIds ?? [], 'invoiceLineIds'),
    paymentIds: exactIds(manifest.paymentIds ?? [], 'paymentIds'),
    expenseIds: exactIds(manifest.expenseIds ?? [], 'expenseIds'),
    auditEventIds: exactIds(manifest.auditEventIds ?? [], 'auditEventIds'),
    storagePaths,
    duplicateDecisionIds: exactIds(manifest.duplicateDecisionIds ?? [], 'duplicateDecisionIds'),
  }
}

function getEnv(name) {
  return String(process.env[name] ?? '').trim()
}

function headers(serviceRoleKey, representation = false) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(representation ? { Prefer: 'return=representation' } : {}),
  }
}

async function deleteRestRow({ supabaseUrl, serviceRoleKey, table, id }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(serviceRoleKey),
  })
  if (!response.ok) throw new Error(`Could not delete exact ${table}/${id}: ${response.status}`)
}

async function deleteStorageObject({ supabaseUrl, serviceRoleKey, bucket, filePath }) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filePath.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE',
    headers: headers(serviceRoleKey),
  })
  if (!response.ok && response.status !== 404) throw new Error(`Could not delete exact storage object ${filePath}: ${response.status}`)
}

export async function cleanupManifest({ manifest, supabaseUrl, projectRef, serviceRoleKey }) {
  const normalized = normalizeManifest(manifest)
  assertQaTarget({ projectRef, supabaseUrl })
  nonEmpty(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY')
  if (normalized.projectRef !== QA_PROJECT_REF) throw new Error('Fixture manifest projectRef is not the QA project.')
  if (normalized.duplicateDecisionIds.length > 0) throw new Error('Duplicate-decision table contract is not configured for this harness.')

  for (const filePath of normalized.storagePaths) await deleteStorageObject({ supabaseUrl, serviceRoleKey, bucket: EXPENSE_RECEIPTS_BUCKET, filePath })
  for (const id of normalized.auditEventIds) await deleteRestRow({ supabaseUrl, serviceRoleKey, table: 'audit_events', id })
  for (const id of normalized.paymentIds) await deleteRestRow({ supabaseUrl, serviceRoleKey, table: 'payments', id })
  for (const id of normalized.invoiceLineIds) await deleteRestRow({ supabaseUrl, serviceRoleKey, table: 'invoice_lines', id })
  for (const id of normalized.invoiceIds) await deleteRestRow({ supabaseUrl, serviceRoleKey, table: 'invoices', id })
  for (const id of normalized.expenseIds) await deleteRestRow({ supabaseUrl, serviceRoleKey, table: 'expenses', id })
  for (const id of normalized.clientIds) await deleteRestRow({ supabaseUrl, serviceRoleKey, table: 'clients', id })

  return { status: 'cleaned', projectRef: QA_PROJECT_REF, counts: { storage: normalized.storagePaths.length, audit: normalized.auditEventIds.length, payments: normalized.paymentIds.length, invoices: normalized.invoiceIds.length, expenses: normalized.expenseIds.length, clients: normalized.clientIds.length } }
}

async function readManifest(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const manifestPath = path.resolve(process.argv[2] ?? '.qa/v3-3b-fixtures.json')
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const projectRef = getEnv('SUPABASE_PROJECT_REF')
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  const result = await cleanupManifest({ manifest: await readManifest(manifestPath), supabaseUrl, projectRef, serviceRoleKey })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
