[CmdletBinding()]
param(
  [switch]$Supervisor
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch = (& git -C $repoRoot branch --show-current).Trim()
$standaloneCodex = 'C:\Users\USUARIO\AppData\Local\OpenAI\Codex\bin\bffc5354119c8421\codex.exe'
$privateRoot = Join-Path $repoRoot '.project-agent\private'

function Assert-SafeRepository {
  if ($branch -in @('main', 'master')) { throw 'Refusing to run autopilot on main/master.' }
  if ((& git -C $repoRoot status --porcelain)) { throw 'Refusing to launch from a dirty worktree.' }
  if (-not (Test-Path -LiteralPath $standaloneCodex)) { throw 'Standalone Codex CLI is unavailable.' }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is unavailable.' }
}

function Set-DetachedEnvironment {
  $env:CODEX_CLI_PATH = $standaloneCodex
  $env:QA_AUTH_NAMESPACE = 'costaclean-v3'
  $env:QA_APP_URL = 'http://127.0.0.1:4178/?v3=1'
  $env:PROJECT_CONTINUATION_ALLOW_EXEC = '1'
  $env:PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = '1'
  $env:PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH = '1'
  @(
    'CODEX_APP_TOOLS_PIPE_PATH',
    'CODEX_INTERNAL_ORIGINATOR_OVERRIDE',
    'CODEX_MCP_NODE_PATH',
    'CODEX_PERMISSION_PROFILE',
    'CODEX_SESSION_ID',
    'CODEX_THREAD_ID'
  ) | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
}

function Assert-QAPreview {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $env:QA_APP_URL -TimeoutSec 8
    if ($response.StatusCode -ne 200) { throw "Unexpected HTTP status $($response.StatusCode)." }
  } catch {
    throw "QA preview is not reachable at $($env:QA_APP_URL): $($_.Exception.Message)"
  }
}

Assert-SafeRepository

if (-not $Supervisor) {
  $arguments = @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Supervisor')
  $child = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $repoRoot -PassThru
  Write-Output "Detached supervisor PID: $($child.Id)"
  exit 0
}

Start-Sleep -Seconds 15
Set-DetachedEnvironment
Assert-QAPreview
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.auth\costaclean-v3\qa-browser-profile'))) {
  throw 'Canonical QA browser profile is unavailable.'
}

$runDir = Join-Path $privateRoot ("detached-autopilot-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$logPath = Join-Path $runDir 'supervisor.log'
$runner = Join-Path $repoRoot 'scripts\ops\run-project-continuation-agent.mjs'

Push-Location $repoRoot
try {
  # The first non-executing bootstrap invocation is a fail-closed detached reviewer smoke.
  & node $runner --bootstrap --review-timeout-ms 600000 2>&1 | Tee-Object -FilePath $logPath -Append
  if ($LASTEXITCODE -ne 0) { throw "Detached reviewer smoke failed with exit code $LASTEXITCODE." }
  $reviewArtifact = Get-ChildItem -LiteralPath $privateRoot -Filter 'iteration-1-review.json' -Recurse |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $reviewArtifact -or $reviewArtifact.Length -le 0) { throw 'Detached reviewer smoke produced no structured artifact.' }

  & node $runner --continuous --bootstrap --max-iterations 10 2>&1 | Tee-Object -FilePath $logPath -Append
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
