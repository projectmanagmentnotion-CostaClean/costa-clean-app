$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
Set-Location $repoRoot

$privateInput = Join-Path $repoRoot '.project-agent\private\inputs\gate-4b-autonomous.md'
if (-not (Test-Path $privateInput)) {
  throw 'Gate 4B private input is missing. Run start-gate-4b-autonomous.ps1 once to create it.'
}

$env:PROJECT_CONTINUATION_ALLOW_EXEC = '1'
Write-Host 'Resuming autonomous Gate 4B continuation agent with the supported iteration limit...'
& npm run agent:continue -- --input '.project-agent\private\inputs\gate-4b-autonomous.md' --execute --max-iterations 10

if ($LASTEXITCODE -ne 0) {
  throw "Continuation agent exited with code $LASTEXITCODE. Review its final report before taking further action."
}
