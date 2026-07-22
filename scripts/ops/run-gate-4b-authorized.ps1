$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
Set-Location $repoRoot

$privateInput = Join-Path $repoRoot '.project-agent\private\inputs\gate-4b-autonomous.md'
$authorizationDoc = Join-Path $repoRoot 'docs\GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md'

foreach ($requiredPath in @($privateInput, $authorizationDoc)) {
  if (-not (Test-Path $requiredPath)) {
    throw "Required Gate 4B file is missing: $requiredPath"
  }
}

$env:PROJECT_CONTINUATION_ALLOW_EXEC = '1'
$env:PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = '1'
$env:PROJECT_CONTINUATION_ALLOW_QA_DEPLOY = '1'
$env:PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH = '1'
$env:PROJECT_CONTINUATION_AUTHORIZED_QA_REF = 'kpvvydthlxupjjqqdpxy'
$env:PROJECT_CONTINUATION_FORBIDDEN_PROD_REF = 'wfxnwfcdjainpojhbdri'

Write-Host 'Starting the explicitly authorized QA-only Gate 4B continuation...'
& npm run agent:continue -- --input '.project-agent\private\inputs\gate-4b-autonomous.md' --execute --max-iterations 10

if ($LASTEXITCODE -ne 0) {
  throw "Continuation agent exited with code $LASTEXITCODE. Review the final report before continuing."
}
