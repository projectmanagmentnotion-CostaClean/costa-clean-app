import { existsSync, readFileSync } from 'node:fs'
import { buildCleanupPlan, QA_REF, assertQaTarget, sanitizeEvidence } from './cp3c1_qa_fixture_plan.mjs'

export function loadPrivateLedger(ledgerPath = '.auth/cp3c1/ledger.json') {
  if (!existsSync(ledgerPath)) throw new Error(`Private CP3C1 ledger is missing: ${ledgerPath}`)
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  if (ledger.qaProject !== QA_REF) throw new Error('Private ledger is not bound to the CP3C1 QA project.')
  return ledger
}

export function dryRunCleanup({ projectRef = QA_REF, ledger }) {
  assertQaTarget({ projectRef, supabaseUrl: `https://${projectRef}.supabase.co` })
  if (!ledger) throw new Error('A private ledger is required for cleanup planning.')
  return { ...buildCleanupPlan(), ledgerPresent: true, ledgerSecretsNotEmitted: true }
}

if (process.argv.includes('--dry-run')) {
  const ledger = loadPrivateLedger()
  process.stdout.write(`${JSON.stringify(sanitizeEvidence(dryRunCleanup({ ledger })), null, 2)}\n`)
}
