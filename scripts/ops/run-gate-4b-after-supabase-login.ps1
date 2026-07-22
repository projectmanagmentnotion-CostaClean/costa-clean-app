$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
Set-Location $repoRoot

$qaRef = 'kpvvydthlxupjjqqdpxy'
$productionRef = 'wfxnwfcdjainpojhbdri'
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

if ($env:GATE_4B_QA_AUTH_VERIFIED -ne '1') {
  throw 'QA authentication handoff is missing. Run scripts/ops/run-gate-4b-full-handoff.ps1 instead.'
}

if (-not $env:SUPABASE_ACCESS_TOKEN -or $env:SUPABASE_ACCESS_TOKEN -notmatch '^sbp_[A-Za-z0-9]+$') {
  throw 'A temporary valid Supabase Personal Access Token was not inherited by the direct runner.'
}

$linkedRefPath = Join-Path $repoRoot 'supabase\.temp\project-ref'
if (-not (Test-Path $linkedRefPath)) {
  throw 'The local Supabase workspace is not linked. Run the full Gate 4B handoff launcher.'
}

$linkedRef = (Get-Content -Path $linkedRefPath -Raw).Trim()
if ($linkedRef -eq $productionRef) {
  throw 'Safety stop: the local Supabase workspace is linked to production.'
}
if ($linkedRef -ne $qaRef) {
  throw "Safety stop: expected QA link $qaRef but found $linkedRef."
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

Write-Host "Supabase QA authentication and link verified for $qaRef."
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
