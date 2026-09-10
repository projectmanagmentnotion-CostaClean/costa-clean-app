import { existsSync, readFileSync } from 'node:fs'
import { assertQaTarget, QA_REF } from './cp3c1_qa_fixture_plan.mjs'

export function readCp3c2Ledger(path = '.auth/cp3c2/ledger.json') {
  if (!existsSync(path)) throw new Error('CP3C2 private ledger is missing.')
  const ledger = JSON.parse(readFileSync(path, 'utf8'))
  if (ledger.gate !== 'CP-3C.2' || ledger.qaProjectRef !== QA_REF) {
    throw new Error('CP3C2 ledger is not bound to the verified QA target.')
  }
  return ledger
}

export function buildCp3c2CleanupPlan(ledger) {
  if (!ledger || ledger.gate !== 'CP-3C.2') throw new Error('CP3C2 ledger is required.')
  return {
    mode: 'LEDGER_BOUND_EXACT',
    target: { environment: 'QA_ONLY', projectRef: QA_REF },
    deleteOnly: {
      auditTargets: [...ledger.transient.applications, ...ledger.transient.serviceRequests],
      applications: [...ledger.transient.applications],
      legalAcceptances: [...ledger.transient.legalAcceptances],
      consents: [...ledger.transient.consents],
      serviceRequests: [...ledger.transient.serviceRequests],
    },
    protected: {
      cp3c1Fixtures: true,
      reusedClientA: true,
      existingInvoice: 'INV-QA-CP3B4-20260909-001',
      authUsers: 'CP3C1_KEEP_UNTIL_CP3C3',
      cp3c2r2ReplacementUsers: ['MEMBER_A_V2', 'ADMIN_B_V2'],
      cp3c2r2ActiveInvitation: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      legalCatalog: 'portal_privacy:qa-v1:es-ES',
    },
  }
}

export function assertCleanupTarget(projectRef) {
  return assertQaTarget({ projectRef, supabaseUrl: `https://${projectRef}.supabase.co` })
}

if (process.argv.includes('--dry-run')) {
  const ledger = readCp3c2Ledger()
  assertCleanupTarget(ledger.qaProjectRef)
  process.stdout.write(`${JSON.stringify(buildCp3c2CleanupPlan(ledger), null, 2)}\n`)
}
