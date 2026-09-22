export const N2_QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const N2_PRODUCTION_PROJECT_REF = 'wfxnwfcdjainpojhbdri'
export const N2_QA_ISSUER = `https://${N2_QA_PROJECT_REF}.supabase.co/auth/v1`

export const CLEANUP_DEPENDENCY_ORDER = [
  'payments',
  'invoice_lines',
  'invoices',
  'recurring_invoice_plans',
  'job_lines',
  'jobs',
  'quote_lines',
  'quotes',
  'properties',
  'clients',
]

export function projectRefFromUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('SUPABASE_URL_INVALID')
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
    throw new Error('SUPABASE_URL_NOT_CANONICAL')
  }
  return url.hostname.slice(0, -'.supabase.co'.length)
}

export function decodeJwtIssuer(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const claims = JSON.parse(decoded)
    return typeof claims.iss === 'string' ? claims.iss : null
  } catch {
    return null
  }
}

export function assertN2QaIdentity({ supabaseUrl, accessToken }) {
  const projectRef = assertN2QaProjectUrl(supabaseUrl)
  if (decodeJwtIssuer(accessToken) !== N2_QA_ISSUER) throw new Error('N2_AUTH_ISSUER_MISMATCH')
  return { projectRef, productionRejected: true, signedQaIssuerVerified: true }
}

export function assertN2QaProjectUrl(supabaseUrl) {
  const projectRef = projectRefFromUrl(supabaseUrl)
  if (projectRef === N2_PRODUCTION_PROJECT_REF) throw new Error('N2_PRODUCTION_TARGET_REJECTED')
  if (projectRef !== N2_QA_PROJECT_REF) throw new Error('N2_UNKNOWN_PROJECT_REJECTED')
  return projectRef
}

export function isQaN2ClientFixture(client, runId = null) {
  if (!client || typeof client.full_name !== 'string' || typeof client.email !== 'string') return false
  const namespace = 'QA_N2_CLIENT_'
  if (!client.full_name.startsWith(namespace)) return false
  if (runId && !client.full_name.startsWith(`${namespace}${runId}_`)) return false
  if (!client.email.startsWith('qa_n2+') || !client.email.endsWith('@qa.invalid')) return false
  if (!runId) return true
  return client.email === `qa_n2+${runId}@qa.invalid`
}

export function isQaCertClientFixture(client, runId) {
  return Boolean(
    client
    && typeof client.full_name === 'string'
    && client.full_name.startsWith(`QA_CERT_${runId}_`),
  )
}

export function assertReadinessPlan(plan) {
  if (!plan || plan.authorized_internal_admin !== true || plan.qa_auth_issuer_verified !== true) {
    throw new Error('N2_QA_AUTHORIZATION_NOT_VERIFIED')
  }
  if (plan.cleanup_rpc_present !== true || plan.rollback_harness_present !== true || plan.transaction_supported !== true) {
    throw new Error('N2_QA_RECOVERY_CAPABILITY_NOT_VERIFIED')
  }
  if ((plan.missing_tables?.length ?? 0) !== 0 || (plan.missing_functions?.length ?? 0) !== 0 || (plan.missing_n1_migrations?.length ?? 0) !== 0) {
    throw new Error('N2_QA_DEPENDENCIES_MISSING')
  }
  if (plan.readiness !== true) throw new Error('N2_QA_READINESS_PLAN_FAILED')
  if (Number(plan.qa_n2_residue) !== 0) throw new Error('N2_QA_RESIDUE_PRESENT')
  return true
}

export function assertDraftFixturePlan(plan) {
  const expected = {
    clients: 1,
    properties: 1,
    quotes: 1,
    quote_lines: 1,
    jobs: 1,
    job_lines: 1,
    invoices: 1,
    invoice_lines: 1,
    payments: 0,
  }
  for (const [key, count] of Object.entries(expected)) {
    if (Number(plan?.[key]) !== count) throw new Error(`N2_FIXTURE_PLAN_MISMATCH_${key.toUpperCase()}`)
  }
  return true
}

export function assertRollbackHarnessResult(result) {
  if (
    result?.passed !== true
    || Number(result.rolled_back_jobs) !== 4
    || Number(result.rolled_back_issued_invoices) !== 3
    || Number(result.rolled_back_settlements) !== 2
    || result.fiscal_numbering_rows_unchanged !== true
    || result.fiscal_number_mapping_unchanged !== true
    || result.next_fiscal_number_unchanged !== true
    || result.duplicate_settlement_idempotent !== true
    || result.payment_rows_unchanged !== true
    || JSON.stringify(result.stages) !== JSON.stringify(['after_job', 'after_invoice', 'after_payment', 'duplicate_settlement'])
  ) {
    throw new Error('N2_TRANSACTION_ROLLBACK_HARNESS_FAILED')
  }
  return true
}

export function assertBaselineRestored(before, after) {
  const tables = ['clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments']
  for (const table of tables) {
    if (Number(before?.[table]) !== Number(after?.[table])) {
      throw new Error(`N2_QA_BASELINE_NOT_RESTORED_${table.toUpperCase()}`)
    }
  }
  for (const key of Object.keys(before?.invariants ?? {})) {
    if (Number(before.invariants[key]) !== Number(after?.invariants?.[key])) {
      throw new Error(`N2_QA_INVARIANT_CHANGED_${key.toUpperCase()}`)
    }
  }
  if (Number(after?.qa_n2_residue) !== 0) throw new Error('N2_QA_RESIDUE_PRESENT_AFTER_CLEANUP')
  return true
}
