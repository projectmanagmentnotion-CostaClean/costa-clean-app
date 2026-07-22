$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
Set-Location $repoRoot

$directRunner = Join-Path $repoRoot 'scripts\ops\run-gate-4b-after-supabase-login.ps1'
if (-not (Test-Path $directRunner)) {
  throw "Missing direct Gate 4B runner: $directRunner"
}

function Test-SupabaseQaAccess {
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell can convert native stderr into a terminating NativeCommandError
    # when the script-level preference is Stop. Authentication failure is expected here,
    # so capture it and continue to the secure token prompt.
    $ErrorActionPreference = 'Continue'
    $projectsOutput = & npx supabase projects list 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  $projectsText = $projectsOutput | Out-String

  return [pscustomobject]@{
    Success = $exitCode -eq 0 -and $projectsText -match 'kpvvydthlxupjjqqdpxy'
    ExitCode = $exitCode
    Output = $projectsText
  }
}

Write-Host 'Checking Supabase CLI authentication for the authorized QA project...'

$existingProcessToken = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', 'Process')
if ($existingProcessToken -and $existingProcessToken -notmatch '^sbp_[A-Za-z0-9]+$') {
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Write-Host 'Ignored an invalid inherited SUPABASE_ACCESS_TOKEN without displaying or persisting it.' -ForegroundColor Yellow
}

$temporaryTokenInstalled = $false
$tokenBstr = [IntPtr]::Zero
$plainToken = $null

try {
  $access = Test-SupabaseQaAccess

  if (-not $access.Success) {
    Write-Host ''
    Write-Host 'One private human authentication step is required.' -ForegroundColor Yellow
    Write-Host 'Paste the Supabase Personal Access Token beginning with sbp_ into the secure prompt.' -ForegroundColor Yellow
    Write-Host 'The token will not be printed, written to files, stored by the CLI or committed to Git.' -ForegroundColor Yellow
    Write-Host ''

    $secureToken = Read-Host 'Supabase Personal Access Token' -AsSecureString
    $tokenBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenBstr)

    if ([string]::IsNullOrWhiteSpace($plainToken) -or $plainToken -notmatch '^sbp_[A-Za-z0-9]+$') {
      throw 'Invalid Supabase Personal Access Token format. Generate a classic access token beginning with sbp_.'
    }

    $env:SUPABASE_ACCESS_TOKEN = $plainToken
    $temporaryTokenInstalled = $true
    $plainToken = $null

    $access = Test-SupabaseQaAccess
    if (-not $access.Success) {
      throw 'The supplied token is invalid or its account cannot see QA project kpvvydthlxupjjqqdpxy.'
    }
  }

  Write-Host 'Supabase QA authentication verified. Handing the remaining Gate 4B work to Codex...'
  & powershell -ExecutionPolicy Bypass -File $directRunner
  if ($LASTEXITCODE -ne 0) {
    throw "Direct Gate 4B runner exited with code $LASTEXITCODE."
  }
}
finally {
  if ($temporaryTokenInstalled) {
    Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  }

  $plainToken = $null
  if ($tokenBstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr)
  }
}
