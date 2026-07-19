import fs from 'node:fs/promises'
import path from 'node:path'

function normalizeEnvValue(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

function parseDotEnvFile(raw) {
  const env = {}
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex < 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) env[key] = value
  }
  return env
}

async function readOptionalEnvFile(filePath) {
  try {
    return parseDotEnvFile(await fs.readFile(filePath, 'utf8'))
  } catch {
    return {}
  }
}

export async function loadSupabasePublicEnv(rootDir = process.cwd()) {
  const envLocal = await readOptionalEnvFile(path.join(rootDir, '.env.local'))
  const envPlain = await readOptionalEnvFile(path.join(rootDir, '.env'))
  const supabaseUrl = normalizeEnvValue(process.env.VITE_SUPABASE_URL ?? envLocal.VITE_SUPABASE_URL ?? envPlain.VITE_SUPABASE_URL)
  const supabaseAnonKey = normalizeEnvValue(process.env.VITE_SUPABASE_ANON_KEY ?? envLocal.VITE_SUPABASE_ANON_KEY ?? envPlain.VITE_SUPABASE_ANON_KEY)
  return {
    supabaseUrl,
    supabaseAnonKey,
    available: Boolean(supabaseUrl && supabaseAnonKey),
  }
}

function buildHeaders(supabaseAnonKey, preferRepresentation = false) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    ...(preferRepresentation ? { Prefer: 'return=representation' } : {}),
  }
}

function isoOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

const CLEANUP_REGISTRY = {
  'client-create': {
    table: 'clients',
    select: 'id,created_at,full_name,email,status,archived_at',
    buildMatch({ qaRunId }) {
      return [`full_name=eq.${encodeURIComponent(`QA Client ${qaRunId}`)}`]
    },
    cleanupPayload() {
      return {
        status: 'inactive',
        archived_at: new Date().toISOString(),
      }
    },
  },
  'property-create': {
    table: 'properties',
    select: 'id,created_at,name,address,notes,archived_at,deleted_at',
    buildMatch({ qaRunId }) {
      return [`notes=eq.${encodeURIComponent(`QA-RUN ${qaRunId}`)}`]
    },
    cleanupPayload() {
      const now = new Date().toISOString()
      return {
        archived_at: now,
        deleted_at: now,
      }
    },
  },
  'quote-create': {
    table: 'quotes',
    select: 'id,created_at,notes,status,archived_at,deleted_at',
    buildMatch({ qaRunId }) {
      return [`notes=eq.${encodeURIComponent(`QA-RUN ${qaRunId}`)}`]
    },
    cleanupPayload() {
      const now = new Date().toISOString()
      return {
        archived_at: now,
        deleted_at: now,
      }
    },
  },
  'expense-create': {
    table: 'expenses',
    select: 'id,created_at,supplier_name,description,notes,archived_at,deleted_at',
    buildMatch({ qaRunId }) {
      const notes = encodeURIComponent(`QA-RUN ${qaRunId}`)
      const supplier = encodeURIComponent(`QA Supplier ${qaRunId}`)
      const description = encodeURIComponent(`QA expense ${qaRunId}`)
      return [`or=(notes.eq.${notes},supplier_name.eq.${supplier},description.eq.${description})`]
    },
    cleanupPayload() {
      const now = new Date().toISOString()
      return {
        archived_at: now,
        deleted_at: now,
      }
    },
  },
}

export function getCleanupEntry(flowId) {
  return CLEANUP_REGISTRY[flowId] ?? null
}

export function listWriteAndCleanEnabledFlowIds() {
  return Object.keys(CLEANUP_REGISTRY)
}

export async function findCreatedEntityByQaRun({
  rootDir = process.cwd(),
  flowId,
  qaRunId,
  createdAfter,
}) {
  const entry = getCleanupEntry(flowId)
  if (!entry) return null

  const env = await loadSupabasePublicEnv(rootDir)
  if (!env.available) {
    throw new Error('Supabase public env is unavailable for write-and-clean cleanup.')
  }

  const params = [
    ...entry.buildMatch({ qaRunId }),
    `select=${encodeURIComponent(entry.select)}`,
    'order=created_at.desc',
    'limit=1',
  ]
  const createdAfterIso = isoOrNull(createdAfter)
  if (createdAfterIso) {
    params.push(`created_at=gte.${encodeURIComponent(createdAfterIso)}`)
  }

  const requestUrl = `${env.supabaseUrl}/rest/v1/${entry.table}?${params.join('&')}`
  const response = await fetch(requestUrl, {
    headers: buildHeaders(env.supabaseAnonKey),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`Could not read ${entry.table} cleanup candidate: ${message || response.statusText}`)
  }

  const rows = await response.json().catch(() => [])
  return Array.isArray(rows) ? (rows[0] ?? null) : rows
}

export async function cleanupCreatedEntity({
  rootDir = process.cwd(),
  flowId,
  entityId,
}) {
  const entry = getCleanupEntry(flowId)
  if (!entry) {
    return {
      status: 'cleanup-not-available',
      table: null,
      entityId,
    }
  }

  const env = await loadSupabasePublicEnv(rootDir)
  if (!env.available) {
    throw new Error('Supabase public env is unavailable for write-and-clean cleanup.')
  }

  const requestUrl = `${env.supabaseUrl}/rest/v1/${entry.table}?id=eq.${encodeURIComponent(entityId)}`
  const response = await fetch(
    requestUrl,
    {
      method: 'PATCH',
      headers: buildHeaders(env.supabaseAnonKey, true),
      body: JSON.stringify(entry.cleanupPayload()),
    },
  )

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`Could not cleanup ${entry.table}/${entityId}: ${message || response.statusText}`)
  }


  const cleanedRows = await response.json().catch(() => [])
  if (!Array.isArray(cleanedRows) || cleanedRows.length === 0) {
    throw new Error(`Cleanup did not affect ${entry.table}/${entityId}.`)
  }

  return {
    status: 'cleaned',
    table: entry.table,
    entityId,
  }
}
