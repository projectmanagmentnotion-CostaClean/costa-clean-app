$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
Set-Location $repoRoot

$authorizationDoc = Join-Path $repoRoot 'docs\GATE_4B_PROVIDERLESS_QA_FALLBACK_AUTHORIZATION_20260722.md'
$agentDoc = Join-Path $repoRoot 'docs\CODEX_FINAL_CLOSEOUT_AGENT.md'
$runner = Join-Path $repoRoot 'scripts\ops\run-project-continuation-agent.mjs'
$privateInputDir = Join-Path $repoRoot '.project-agent\private\inputs'
$privateInput = Join-Path $privateInputDir 'gate-4b-providerless.md'

foreach ($requiredPath in @($authorizationDoc, $agentDoc, $runner)) {
  if (-not (Test-Path $requiredPath)) {
    throw "Required file is missing: $requiredPath"
  }
}

New-Item -ItemType Directory -Path $privateInputDir -Force | Out-Null

$inputContent = @'
# Gate 4B Providerless QA Execution Agent

Execute the active providerless Gate 4B QA fallback.

Read first:

- docs/GATE_4B_PROVIDERLESS_QA_FALLBACK_AUTHORIZATION_20260722.md
- docs/CODEX_FINAL_CLOSEOUT_AGENT.md
- docs/PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUDIT_20260722.md
- docs/PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_IMPLEMENTATION_PLAN_20260722.md
- docs/FINAL_CLOSEOUT_ROADMAP.md
- docs/FINAL_CLOSEOUT_CHECKLIST.md
- docs/DB_PUSH_LOCK.md

The owner explicitly authorizes QA-only implementation in Supabase kpvvydthlxupjjqqdpxy without Cloudflare, Turnstile, DNS changes or a dedicated QA hostname.

Implement the provider-independent Edge Function, strict shared contract, honeypot and minimum-interaction checks, HMAC pseudonymous throttling, replay/cooldown protection, private transactional RPC, one unique reviewed 14-digit migration, frontend integration and tests. Generate and install the pepper privately in QA without printing it. Run the disposable PostgreSQL proof, apply only to QA through the reviewed transactional path, deploy only to QA, execute synthetic tests, clean all residues, update documentation, commit and push, then reactivate continuation and stop before Gate 4C.

Use an existing QA/staging URL when available. Otherwise use the local QA frontend preview together with the deployed QA Edge Function endpoint. Missing Cloudflare access, Turnstile keys, DNS access or a dedicated QA hostname is not a blocker.

Never touch production wfxnwfcdjainpojhbdri. Never run db push. Never start Gate 4C. Never expose server credentials or the pepper. Never touch financial/fiscal flows or full-submit.

Stop only for unavoidable Supabase QA login/MFA, inability to prove the exact QA identity, failed local proof, failed cleanup or scope expansion beyond the authorization.
'@

Set-Content -Path $privateInput -Value $inputContent -Encoding UTF8

git check-ignore --quiet -- '.project-agent/private/inputs/gate-4b-providerless.md'
if ($LASTEXITCODE -ne 0) {
  throw 'Private Gate 4B providerless input is not ignored by Git. Aborting.'
}

$env:PROJECT_CONTINUATION_ALLOW_EXEC = '1'
$env:PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = '1'
$env:PROJECT_CONTINUATION_ALLOW_QA_DEPLOY = '1'
$env:PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH = '1'
$env:PROJECT_CONTINUATION_AUTHORIZED_QA_REF = 'kpvvydthlxupjjqqdpxy'
$env:PROJECT_CONTINUATION_FORBIDDEN_PROD_REF = 'wfxnwfcdjainpojhbdri'

Write-Host 'Starting providerless Gate 4B QA continuation...'
& npm run agent:continue -- --input '.project-agent\private\inputs\gate-4b-providerless.md' --execute --max-iterations 10

if ($LASTEXITCODE -ne 0) {
  throw "Continuation agent exited with code $LASTEXITCODE. Review the final report before continuing."
}
