import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
export const LEDGER_STATES = Object.freeze([
  'initialized',
  'backup_complete',
  'migration_applied',
  'staff_membership_verified',
  'auth_users_created',
  'fixtures_created',
  'edge_deployed',
  'storage_verified',
  'matrix_passed',
  'cleanup_started',
  'cleanup_complete',
  'auth_users_deleted',
  'zero_residue_verified',
  'completed',
  'rollback_required',
  'blocked',
])

export const SYNTHETIC_AUTH_ROLES = Object.freeze([
  'suspended_staff',
  'client_admin_a',
  'client_member_a',
  'client_admin_b',
  'client_member_b',
  'pending',
  'suspended_member',
  'revoked_member',
  'unverified',
  'invitee',
])

const allowedTransitions = Object.freeze({
  initialized: ['backup_complete', 'blocked'],
  backup_complete: ['auth_users_created', 'rollback_required', 'blocked'],
  auth_users_created: ['migration_applied', 'rollback_required', 'blocked'],
  migration_applied: ['staff_membership_verified', 'rollback_required', 'blocked'],
  staff_membership_verified: ['fixtures_created', 'rollback_required', 'blocked'],
  fixtures_created: ['edge_deployed', 'rollback_required', 'blocked'],
  edge_deployed: ['storage_verified', 'rollback_required', 'blocked'],
  storage_verified: ['matrix_passed', 'rollback_required', 'blocked'],
  matrix_passed: ['cleanup_started', 'rollback_required', 'blocked'],
  cleanup_started: ['cleanup_complete', 'rollback_required', 'blocked'],
  cleanup_complete: ['auth_users_deleted', 'rollback_required', 'blocked'],
  auth_users_deleted: ['zero_residue_verified', 'blocked'],
  zero_residue_verified: ['completed', 'blocked'],
  completed: [],
  rollback_required: ['auth_users_deleted', 'blocked'],
  blocked: [],
})

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const runIdPattern = /^cp2b-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

export function createRunId() {
  return `cp2b-${randomUUID()}`
}

export function validateRunId(value) {
  return typeof value === 'string' && runIdPattern.test(value)
}

export function validateQaTarget({ projectRef, supabaseUrl }) {
  if (projectRef === PRODUCTION_REF || String(supabaseUrl).includes(PRODUCTION_REF)) {
    throw new Error('production_target_rejected')
  }
  if (projectRef !== QA_REF || !String(supabaseUrl).includes(`${QA_REF}.supabase.co`)) {
    throw new Error('qa_target_required')
  }
}

export function createEmptyLedger(ledgerPath, runId) {
  if (!validateRunId(runId)) throw new Error('invalid_run_id')
  if (existsSync(ledgerPath)) throw new Error('ledger_already_exists')
  mkdirSync(path.dirname(ledgerPath), { recursive: true })
  const ledger = {
    version: 2,
    runId,
    state: 'initialized',
    created: {
      authUserIds: {},
      rowIds: {},
      storageObjectKeys: [],
    },
    transitions: [{ state: 'initialized', at: new Date().toISOString() }],
  }
  persistLedger(ledgerPath, ledger)
  return ledger
}

export function readLedger(ledgerPath) {
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  validateLedger(ledger)
  return ledger
}

export function transitionLedger(ledgerPath, state, additions = {}) {
  if (!LEDGER_STATES.includes(state)) throw new Error('invalid_ledger_state')
  const ledger = readLedger(ledgerPath)
  if (!allowedTransitions[ledger.state]?.includes(state)) {
    throw new Error('invalid_ledger_transition')
  }
  ledger.state = state
  ledger.transitions.push({ state, at: new Date().toISOString() })
  mergeIdentifiers(ledger, additions)
  persistLedger(ledgerPath, ledger)
  return ledger
}

export function recordLedgerIdentifiers(ledgerPath, additions) {
  const ledger = readLedger(ledgerPath)
  mergeIdentifiers(ledger, additions)
  persistLedger(ledgerPath, ledger)
  return ledger
}

function mergeIdentifiers(ledger, additions) {
  if (additions.authUserIds) Object.assign(ledger.created.authUserIds, additions.authUserIds)
  if (additions.rowIds) Object.assign(ledger.created.rowIds, additions.rowIds)
  if (additions.storageObjectKeys) {
    ledger.created.storageObjectKeys.push(...additions.storageObjectKeys)
  }
}

export function validateLedger(ledger) {
  if (!ledger || ledger.version !== 2 || !validateRunId(ledger.runId)
    || !LEDGER_STATES.includes(ledger.state)
    || !ledger.created || Array.isArray(ledger.created)
    || !ledger.created.authUserIds || !ledger.created.rowIds
    || !Array.isArray(ledger.created.storageObjectKeys)
    || !Array.isArray(ledger.transitions)) {
    throw new Error('invalid_ledger')
  }
  for (const value of Object.values(ledger.created.authUserIds)) {
    if (!uuidPattern.test(value)) throw new Error('invalid_ledger_auth_id')
  }
  for (const value of Object.values(ledger.created.rowIds)) {
    if (!uuidPattern.test(value)) throw new Error('invalid_ledger_row_id')
  }
  for (const value of ledger.created.storageObjectKeys) {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/u.test(value)) {
      throw new Error('invalid_ledger_storage_key')
    }
  }
  for (const transition of ledger.transitions) {
    if (!LEDGER_STATES.includes(transition.state)) throw new Error('invalid_ledger_transition')
  }
  const serialized = JSON.stringify(ledger).toLowerCase()
  for (const forbidden of ['password', 'token', 'secret', 'pepper', 'authorization', '@example.invalid']) {
    if (serialized.includes(forbidden)) throw new Error('ledger_contains_forbidden_material')
  }
  return true
}

export async function createSyntheticAuthUsers({
  fetchImpl = fetch,
  supabaseUrl,
  serviceRoleKey,
  projectRef,
  runId,
  ledgerPath,
}) {
  validateQaTarget({ projectRef, supabaseUrl })
  if (!serviceRoleKey || !validateRunId(runId)) throw new Error('private_input_missing')
  const ledger = readLedger(ledgerPath)
  if (ledger.runId !== runId || Object.keys(ledger.created.authUserIds).length !== 0) {
    throw new Error('ledger_not_empty')
  }

  const credentials = Object.fromEntries(SYNTHETIC_AUTH_ROLES.map((role) => [
    role,
    {
      email: `${role.replaceAll('_', '-')}.${runId}@example.invalid`,
      password: base64Url(randomBytes(36)),
      confirmed: role !== 'unverified',
    },
  ]))
  await assertNoPreexistingUsers(fetchImpl, supabaseUrl, serviceRoleKey, credentials)

  const createdIds = {}
  try {
    for (const role of SYNTHETIC_AUTH_ROLES) {
      const response = await adminFetch(fetchImpl, supabaseUrl, serviceRoleKey, '/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials[role].email,
          password: credentials[role].password,
          email_confirm: credentials[role].confirmed,
          user_metadata: {},
          app_metadata: {},
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body || !uuidPattern.test(body.id)) throw new Error('auth_create_failed')
      createdIds[role] = body.id
    }
    transitionLedger(ledgerPath, 'auth_users_created', { authUserIds: createdIds })
    return { ids: createdIds, credentials }
  } catch (error) {
    await deleteAuthUsersExact({
      fetchImpl,
      supabaseUrl,
      serviceRoleKey,
      projectRef,
      ids: Object.values(createdIds),
    })
    transitionLedger(ledgerPath, 'blocked')
    throw error
  }
}

export async function deleteSyntheticAuthUsers({
  fetchImpl = fetch,
  supabaseUrl,
  serviceRoleKey,
  projectRef,
  ledgerPath,
}) {
  validateQaTarget({ projectRef, supabaseUrl })
  const ledger = readLedger(ledgerPath)
  await deleteAuthUsersExact({
    fetchImpl,
    supabaseUrl,
    serviceRoleKey,
    projectRef,
    ids: Object.values(ledger.created.authUserIds),
  })
  transitionLedger(ledgerPath, 'auth_users_deleted')
}

async function assertNoPreexistingUsers(fetchImpl, supabaseUrl, serviceRoleKey, credentials) {
  const expected = new Set(Object.values(credentials).map(({ email }) => email))
  for (let page = 1; page <= 10_000; page += 1) {
    const response = await adminFetch(
      fetchImpl,
      supabaseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users?page=${page}&per_page=1000`,
      { method: 'GET' },
    )
    const body = await response.json().catch(() => null)
    if (!response.ok || !body) throw new Error('auth_preflight_failed')
    const users = Array.isArray(body) ? body : body.users
    if (!Array.isArray(users)) throw new Error('auth_preflight_failed')
    if (users.some((user) => expected.has(user.email))) {
      throw new Error('synthetic_user_preexists')
    }
    const lastPage = Number(body.last_page ?? body.lastPage)
    if (users.length < 1000 || (Number.isInteger(lastPage) && page >= lastPage)) return
  }
  throw new Error('auth_preflight_pagination_limit')
}

async function deleteAuthUsersExact({ fetchImpl, supabaseUrl, serviceRoleKey, projectRef, ids }) {
  validateQaTarget({ projectRef, supabaseUrl })
  for (const id of [...new Set(ids)]) {
    if (!uuidPattern.test(id)) throw new Error('invalid_cleanup_auth_id')
    const response = await adminFetch(
      fetchImpl,
      supabaseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    )
    if (!response.ok && response.status !== 404) throw new Error('auth_cleanup_failed')
  }
  for (const id of [...new Set(ids)]) {
    const response = await adminFetch(
      fetchImpl,
      supabaseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users/${encodeURIComponent(id)}`,
      { method: 'GET' },
    )
    if (response.status !== 404) throw new Error('auth_cleanup_not_verified')
  }
}

function adminFetch(fetchImpl, supabaseUrl, serviceRoleKey, pathname, init) {
  return fetchImpl(`${supabaseUrl}${pathname}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  })
}

function persistLedger(ledgerPath, ledger) {
  validateLedger(ledger)
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}

function base64Url(value) {
  return value.toString('base64url')
}

function redactPlan() {
  return {
    gate: 'CP-2B-V2',
    mode: 'plan',
    remoteWrites: 0,
    projectRef: QA_REF,
    productionRejected: true,
    authUsers: SYNTHETIC_AUTH_ROLES.map((role) => ({ role, identifier: 'REDACTED' })),
    ledgerContainsSecrets: false,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--plan')) {
    process.stdout.write(`${JSON.stringify(redactPlan(), null, 2)}\n`)
  } else {
    process.stderr.write('BLOCKED: use the V2 runner; direct remote mutation is unavailable.\n')
    process.exitCode = 1
  }
}
