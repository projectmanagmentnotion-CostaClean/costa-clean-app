$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
Set-Location $repoRoot

$authorizationDoc = Join-Path $repoRoot 'docs\GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md'
$agentDoc = Join-Path $repoRoot 'docs\CODEX_FINAL_CLOSEOUT_AGENT.md'
$runner = Join-Path $repoRoot 'scripts\ops\run-project-continuation-agent.mjs'
$privateInputDir = Join-Path $repoRoot '.project-agent\private\inputs'
$privateInput = Join-Path $privateInputDir 'gate-4b-autonomous.md'

foreach ($requiredPath in @($authorizationDoc, $agentDoc, $runner)) {
  if (-not (Test-Path $requiredPath)) {
    throw "Required file is missing: $requiredPath"
  }
}

New-Item -ItemType Directory -Path $privateInputDir -Force | Out-Null

$inputContent = @'
# Gate 4B Autonomous Execution Agent

Execute the active Gate 4B from the versioned project instructions.

Read first:

- docs/GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md
- docs/CODEX_FINAL_CLOSEOUT_AGENT.md
- docs/PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUDIT_20260722.md
- docs/PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_IMPLEMENTATION_PLAN_20260722.md
- docs/PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md
- docs/FINAL_CLOSEOUT_ROADMAP.md
- docs/FINAL_CLOSEOUT_CHECKLIST.md
- docs/DB_PUSH_LOCK.md

The owner has authorized autonomous operational control of Gate 4B exclusively in Supabase QA kpvvydthlxupjjqqdpxy.

Inspect the actual hosting, DNS, deployment and provider state. Reuse or provision a stable QA hostname under the app's actual domain without changing the live production hostname. Use existing authenticated local sessions or private provider credentials when available. Create and configure Cloudflare Turnstile Managed, QA frontend environment, Supabase QA Edge secrets, Edge Function, private RPC, one reviewed 14-digit migration, local disposable PostgreSQL proof, QA-only deployment, synthetic tests, cleanup, documentation, commit and push.

Do not ask for values that can be discovered or provisioned safely. Stop only for a minimal unavoidable human-only action such as login, MFA, email verification, account creation, billing acceptance or missing provider access. Never print or commit secrets.

Never touch production wfxnwfcdjainpojhbdri. Never run db push. Never start Gate 4C. Never touch financial/fiscal flows or full-submit.

After Gate 4B passes, reactivate continuation and stop before Gate 4C with the exact production authorization package.
'@

Set-Content -Path $privateInput -Value $inputContent -Encoding UTF8

$ignored = git check-ignore --quiet -- '.project-agent/private/inputs/gate-4b-autonomous.md'
if ($LASTEXITCODE -ne 0) {
  throw 'Private Gate 4B input is not ignored by Git. Aborting before execution.'
}

$env:PROJECT_CONTINUATION_ALLOW_EXEC = '1'
Write-Host 'Starting autonomous Gate 4B continuation agent...'
& npm run agent:continue -- --input '.project-agent\private\inputs\gate-4b-autonomous.md' --execute --max-iterations 12

if ($LASTEXITCODE -ne 0) {
  throw "Continuation agent exited with code $LASTEXITCODE. Review its final report; do not bypass a documented safety block."
}
