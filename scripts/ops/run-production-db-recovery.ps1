$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
Set-Location $repoRoot

$promptFile = Join-Path $repoRoot 'docs\PRODUCTION_DATABASE_RECOVERY_AGENT_20260722.md'
if (-not (Test-Path $promptFile)) { throw "Missing recovery prompt: $promptFile" }

$active = Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='codex.exe'" |
  Where-Object { $_.CommandLine -match 'run-project-continuation-agent|gate-4b-providerless' }
if ($active) {
  $active | Select-Object ProcessId, Name, CommandLine | Format-List
  throw 'Gate 4B is still running. Stop that terminal with Ctrl+C before production recovery.'
}

$privateDir = Join-Path $repoRoot ('.project-agent\private\production-db-recovery\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$report = Join-Path $privateDir 'final-report.md'

$prompt = Get-Content -Path $promptFile -Raw
$codex = Join-Path $env:USERPROFILE '.codex\plugins\.plugin-appserver\codex.exe'
if (-not (Test-Path $codex)) {
  $cmd = Get-Command codex -ErrorAction SilentlyContinue
  if (-not $cmd) { throw 'Codex CLI not found.' }
  $codex = $cmd.Source
}

Write-Host 'Starting production database recovery agent...'
Write-Host "Private report: $report"

& $codex exec $prompt --ephemeral --sandbox workspace-write --model gpt-5.6-sol --cd $repoRoot --output-last-message $report --color never
if ($LASTEXITCODE -ne 0) { throw "Recovery agent exited with code $LASTEXITCODE." }

if (Test-Path $report) {
  Write-Host ''
  Get-Content -Path $report
}
