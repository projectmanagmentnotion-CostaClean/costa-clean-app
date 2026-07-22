$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
Set-Location $repoRoot

$promptFile = Join-Path $repoRoot 'docs\GATE_4B_DIRECT_QA_EXECUTION_AFTER_AUTH_20260722.md'
if (-not (Test-Path $promptFile)) {
  throw "Missing Gate 4B direct execution prompt: $promptFile"
}

$active = Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='codex.exe'" |
  Where-Object { $_.CommandLine -match 'run-project-continuation-agent|gate-4b-providerless|production-db-recovery' }
if ($active) {
  $active | Select-Object ProcessId, Name, CommandLine | Format-List
  throw 'Another continuation or recovery agent is still running. Stop it before direct Gate 4B execution.'
}

Write-Host 'Checking Supabase CLI authentication...'
$projectsOutput = & npx supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ($projectsOutput | Out-String)
  throw 'Supabase CLI is not authenticated. Run: npx supabase login'
}

$projectsText = $projectsOutput | Out-String
if ($projectsText -notmatch 'kpvvydthlxupjjqqdpxy') {
  throw 'Authenticated account cannot see the authorized QA project kpvvydthlxupjjqqdpxy.'
}

$privateDir = Join-Path $repoRoot ('.project-agent\private\gate-4b-direct\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$report = Join-Path $privateDir 'final-report.md'

$prompt = Get-Content -Path $promptFile -Raw
$codex = Join-Path $env:USERPROFILE '.codex\plugins\.plugin-appserver\codex.exe'
if (-not (Test-Path $codex)) {
  $cmd = Get-Command codex -ErrorAction SilentlyContinue
  if (-not $cmd) { throw 'Codex CLI not found.' }
  $codex = $cmd.Source
}

Write-Host 'Starting direct authenticated Gate 4B QA execution...'
Write-Host "Private report: $report"

& $codex exec $prompt --ephemeral --sandbox workspace-write --model gpt-5.6-sol --cd $repoRoot --output-last-message $report --color never
if ($LASTEXITCODE -ne 0) {
  throw "Direct Gate 4B agent exited with code $LASTEXITCODE."
}

if (Test-Path $report) {
  Write-Host ''
  Get-Content -Path $report
}
