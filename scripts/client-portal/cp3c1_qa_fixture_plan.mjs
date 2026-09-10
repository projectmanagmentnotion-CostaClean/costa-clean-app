import { readFileSync } from 'node:fs'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'

export const CP3C1_FIXTURE_ALIASES = Object.freeze([
  'ADMIN_A',
  'MEMBER_A',
  'ADMIN_B',
  'APPLICANT_INDIVIDUAL',
  'APPLICANT_BUSINESS',
  'SUSPENDED_OR_INACTIVE_A',
  'REVOKED_A',
  'INVITEE',
])

export const SYNTHETIC_EMAILS = Object.freeze([
  'applicant-individual.cp3c1@qa.invalid',
  'applicant-business.cp3c1@qa.invalid',
  'suspended-a.cp3c1@qa.invalid',
  'revoked-a.cp3c1@qa.invalid',
  'invitee.cp3c1@qa.invalid',
  'expired-invitee.cp3c1@qa.invalid',
  'revoked-invitee.cp3c1@qa.invalid',
  'used-invitee.cp3c1@qa.invalid',
])

const IDENTITY_EMAILS = Object.freeze({
  APPLICANT_INDIVIDUAL: 'applicant-individual.cp3c1@qa.invalid',
  APPLICANT_BUSINESS: 'applicant-business.cp3c1@qa.invalid',
  SUSPENDED_OR_INACTIVE_A: 'suspended-a.cp3c1@qa.invalid',
  REVOKED_A: 'revoked-a.cp3c1@qa.invalid',
  INVITEE: 'invitee.cp3c1@qa.invalid',
})

export const CREATED_ROW_IDS = Object.freeze({
  client: 'QA-CP3C1-CLIENT-B-20260910',
  property: 'QA-CP3C1-PROPERTY-B-20260910',
  memberships: Object.freeze([
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555',
  ]),
  invitations: Object.freeze([
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ]),
})

export const REUSED_IDS = Object.freeze({
  client: 'QA-CP3B2B-PORTAL-20260908-CLIENT',
  properties: Object.freeze([
    'QA-CP3B2B-PORTAL-20260908-PROPERTY-A',
    'QA-CP3B2B-PORTAL-20260908-PROPERTY-B',
  ]),
  adminMembership: '9eb7b22d-0849-4122-b90b-5dd50b1784a4',
})

export function assertQaTarget({ projectRef, supabaseUrl = '' }) {
  if (projectRef === PRODUCTION_REF || supabaseUrl.includes(PRODUCTION_REF)) {
    throw new Error('CP3C1 refuses the production Supabase target.')
  }
  if (projectRef !== QA_REF || (supabaseUrl && !supabaseUrl.includes(QA_REF))) {
    throw new Error('CP3C1 requires the verified QA Supabase target.')
  }
  return true
}

export function createFixturePlan() {
  return {
    gate: 'CP-3C.1',
    target: { environment: 'QA_ONLY', projectRef: QA_REF },
    identities: CP3C1_FIXTURE_ALIASES.map((alias) => ({
      alias,
      email: IDENTITY_EMAILS[alias] || null,
      tenancy: ['APPLICANT_INDIVIDUAL', 'APPLICANT_BUSINESS'].includes(alias) ? 'none' : 'fixture-defined',
    })),
    states: ['active', 'pending_invitation', 'expired_invitation', 'revoked_invitation', 'accepted_invitation', 'suspended', 'revoked'],
    invariants: {
      noProductionWrites: true,
      noGoogleProviderChanges: true,
      noEmailDelivery: true,
      noFinancialFixtureCreation: true,
      noMarketingPreconsent: true,
      applicantsHaveNoMembership: true,
      reusedRowsProtectedFromCleanup: true,
    },
    createdRowIds: CREATED_ROW_IDS,
    reusedRowIds: REUSED_IDS,
  }
}

export function buildCleanupPlan() {
  return {
    target: { environment: 'QA_ONLY', projectRef: QA_REF },
    deleteOnly: {
      clients: [CREATED_ROW_IDS.client],
      properties: [CREATED_ROW_IDS.property],
      memberships: [...CREATED_ROW_IDS.memberships],
      invitations: [...CREATED_ROW_IDS.invitations],
    },
    protected: {
      clients: [REUSED_IDS.client],
      properties: [...REUSED_IDS.properties],
      memberships: [REUSED_IDS.adminMembership],
      invoices: ['INV-QA-CP3B4-20260909-001'],
    },
    mode: 'DRY_RUN_ONLY',
  }
}

export function sanitizeEvidence(value) {
  const secretKey = /(password|token|secret|jwt|access|refresh|authorization|cookie)/iu
  if (Array.isArray(value)) return value.map(sanitizeEvidence)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !secretKey.test(key))
    .map(([key, child]) => [key, sanitizeEvidence(child)]))
}

if (process.argv.includes('--plan')) {
  const projectRef = process.env.QA_SANDBOX_PROJECT_REF || QA_REF
  assertQaTarget({ projectRef, supabaseUrl: process.env.VITE_SUPABASE_URL || `https://${QA_REF}.supabase.co` })
  process.stdout.write(`${JSON.stringify(sanitizeEvidence(createFixturePlan()), null, 2)}\n`)
}
