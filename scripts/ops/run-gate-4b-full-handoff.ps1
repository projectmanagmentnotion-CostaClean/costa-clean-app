$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
Set-Location $repoRoot

$directRunner = Join-Path $repoRoot 'scripts\ops\run-gate-4b-after-supabase-login.ps1'
if (-not (Test-Path $directRunner)) {
  throw "Missing direct Gate 4B runner: $directRunner"
}

Write-Host 'Checking Supabase CLI authentication for the authorized QA project...'
$projectsOutput = & npx supabase projects list 2>&1
$authenticated = $LASTEXITCODE -eq 0
$projectsText = $projectsOutput | Out-String

if (-not $authenticated) {
  Write-Host ''
  Write-Host 'One private human authentication step is required.' -ForegroundColor Yellow
  Write-Host 'Complete the Supabase CLI login prompt without sharing the token in chat, files, logs or Git.' -ForegroundColor Yellow
  Write-Host 'After successful authentication this launcher will continue automatically.' -ForegroundColor Yellow
  Write-Host ''

  & npx supabase login
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase CLI login did not complete successfully. Use a Supabase Personal Access Token beginning with sbp_.'
  }

  $projectsOutput = & npx supabase projects list 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase CLI authentication completed but projects list still failed.'
  }
  $projectsText = $projectsOutput | Out-String
}

if ($projectsText -notmatch 'kpvvydthlxupjjqqdpxy') {
  throw 'The authenticated Supabase account cannot see the authorized QA project kpvvydthlxupjjqqdpxy.'
}

Write-Host 'Supabase QA authentication verified. Handing the remaining Gate 4B work to Codex...'
& powershell -ExecutionPolicy Bypass -File $directRunner
if ($LASTEXITCODE -ne 0) {
  throw "Direct Gate 4B runner exited with code $LASTEXITCODE."
}
