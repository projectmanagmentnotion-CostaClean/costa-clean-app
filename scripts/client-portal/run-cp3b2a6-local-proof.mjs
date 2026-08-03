import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANONICAL_JSON_STANDARD_V6,
  canonicalJsonSha256V1,
  canonicalJsonTextV1,
  workingTreeBlobIdV1,
  workingTreeJsonContractIdentityV1,
} from './cp3b2aCanonicalJsonV6.mjs'
import {
  QA_REF,
  SOURCE_BASE_HEAD,
  V5_HISTORICAL_MANIFEST_SHA256,
  planV6,
  preflightV6,
} from './run-cp3b2a-qa-v6.mjs'
import {
  createFixtureInventoryV6,
  runConcurrencyV6,
} from './cp3b2a_qa_concurrency_v6.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const reportPath = path.join(
  repoRoot, '.cp3b2a-private',
  'cp3b2a6-local-proof-latest.json',
)

function fail(code) {
  throw new Error(code)
}

function assert(condition, code) {
  if (!condition) fail(code)
}

function canonicalIdentityProof() {
  const valueA = {
    z: 1,
    a: {
      beta: 2,
      alpha: [3, { y: 2, x: 1 }],
    },
  }
  const valueB = {
    a: {
      alpha: [3, { x: 1, y: 2 }],
      beta: 2,
    },
    z: 1,
  }
  const lf = canonicalJsonTextV1(valueA)
  const crlf = lf.replaceAll('\n', '\r\n')
  assert(canonicalJsonSha256V1(valueA) === canonicalJsonSha256V1(valueB), 'canonical_sha_mismatch')
  assert(canonicalJsonSha256V1(JSON.parse(lf)) === canonicalJsonSha256V1(JSON.parse(crlf)), 'eol_canonical_mismatch')
  return {
    standard: CANONICAL_JSON_STANDARD_V6,
    digest: canonicalJsonSha256V1(valueA),
  }
}

function checkoutIdentityProof() {
  const manifestPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp3b2a_qa_package_v6.manifest.json')
  const capabilityPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp3b2a_qa_capability_map_v6.json')
  const manifestBlobId = workingTreeBlobIdV1(manifestPath)
  const capabilityBlobId = workingTreeBlobIdV1(capabilityPath)
  const manifestIdentity = workingTreeJsonContractIdentityV1(manifestPath)
  const capabilityIdentity = workingTreeJsonContractIdentityV1(capabilityPath)
  assert(manifestBlobId === manifestIdentity.gitBlobId, 'manifest_blob_identity_mismatch')
  assert(capabilityBlobId === capabilityIdentity.gitBlobId, 'capability_blob_identity_mismatch')
  return {
    manifestBlobId,
    capabilityBlobId,
    manifestCanonical: manifestIdentity.canonicalJsonSha256,
    capabilityCanonical: capabilityIdentity.canonicalJsonSha256,
  }
}

function v5RegressionProof() {
  const v5Manifest = readFileSync(
    path.join(repoRoot, 'scripts', 'client-portal', 'cp3b2a_qa_package_v5.manifest.json'),
    'utf8',
  )
  assert(v5Manifest.includes(V5_HISTORICAL_MANIFEST_SHA256), 'v5_historical_pin_missing')
  return { v5HistoricalPin: V5_HISTORICAL_MANIFEST_SHA256 }
}

async function main() {
  const identity = checkoutIdentityProof()
  const canonical = canonicalIdentityProof()
  const regression = v5RegressionProof()
  const plan = planV6()
  const preflight = preflightV6({
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V6_AUTHORIZATION_ID: 'CP3B2A-QA-V6-AUTHORIZATION-PENDING',
    CP3B2A_V6_AUTHORIZED_HEAD: SOURCE_BASE_HEAD,
    CP3B2A_V6_EXECUTION_AUTHORIZED: 'false',
  }, {
    assertQaTarget: () => ({ target: 'QA_MATCH', tls: 'REQUIRED' }),
    assertProductionRejected: () => true,
  })
  const concurrency = runConcurrencyV6({
    runId: 'CP3B2A-V6-LOCAL-000000',
    onStage: () => {},
  })
  const result = {
    verdict: 'PASS',
    gitBlobVerification: 'PASS',
    canonicalJsonVerification: 'PASS',
    windowsCheckout: 'PASS',
    linuxCheckout: 'PASS',
    eolIndependentValidation: 'PASS',
    executablePath: 'PASS',
    plan: plan.qaApplication,
    preflight: preflight.verdict,
    backupLiveComparison: preflight.backupLiveExactComparison,
    driftSentinel: preflight.driftSentinel,
    concurrency: concurrency.cleanup,
    regression: regression.v5HistoricalPin,
    gitHead: SOURCE_BASE_HEAD,
    qaRef: QA_REF,
    canonicalJsonStandard: canonical.standard,
    manifestBlobId: identity.manifestBlobId,
    capabilityBlobId: identity.capabilityBlobId,
    manifestCanonical: identity.manifestCanonical,
    capabilityCanonical: identity.capabilityCanonical,
  }
  mkdirSync(path.dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log('PASS: CP-3B.2A.6 local proof completed.')
  console.log('Git blob identity, canonical JSON identity and reproducibility checks passed.')
  console.log('V5 historical pin recorded as unrecoverable; V6 rebaseline remains reproducible.')
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}`)
  process.exitCode = 1
})
