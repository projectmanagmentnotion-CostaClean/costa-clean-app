import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const evidencePath = path.join(root, 'docs', 'release', 'critical-evidence.json')
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
// No independent evidence verifier/key is configured in this repository. A PR-editable
// JSON file containing status strings is not proof of backup, restore, or approval.
const trustedEvidenceVerifierId = ''
const required = [
  'dataBackupRestore', 'rollback', 'runtimeAclRls', 'authenticatedPreview',
  'edgeRuntime', 'independentSecurityReview', 'humanReleaseApproval',
]
const missing = required.filter((key) => {
  const item = evidence.gates?.[key]
  return !item || item.status !== 'PASS' || item.candidateSha !== evidence.candidateSha
    || typeof item.evidence !== 'string' || item.evidence.trim().length < 8
})
if (!trustedEvidenceVerifierId || evidence.verifier?.id !== trustedEvidenceVerifierId) {
  missing.push('trustedExternalEvidenceVerifier')
}
if (!/^[a-f0-9]{40}$/u.test(evidence.candidateSha ?? '') || missing.length) {
  process.stderr.write(`CRITICAL_RELEASE_BLOCKED=${missing.join(',') || 'candidate_sha_invalid'}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`CRITICAL_EVIDENCE_BOUND_TO=${evidence.candidateSha}\n`)
}
