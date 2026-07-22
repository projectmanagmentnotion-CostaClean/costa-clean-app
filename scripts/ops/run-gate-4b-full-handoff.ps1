$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
Set-Location $repoRoot

$qaRef = 'kpvvydthlxupjjqqdpxy'
$productionRef = 'wfxnwfcdjainpojhbdri'
$directRunner = Join-Path $repoRoot 'scripts\ops\run-gate-4b-after-supabase-login.ps1'
if (-not (Test-Path $directRunner)) {
  throw "Missing direct Gate 4B runner: $directRunner"
}

function Invoke-SupabaseCli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments,
    [switch] $SendBlankLine
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell can convert native stderr into a terminating NativeCommandError.
    # Capture native output and decide from the actual process exit code instead.
    $ErrorActionPreference = 'Continue'
    if ($SendBlankLine) {
      $output = '' | & npx supabase @Arguments 2>&1
    }
    else {
      $output = & npx supabase @Arguments 2>&1
    }
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    Success = $exitCode -eq 0
    ExitCode = $exitCode
    Output = ($output | Out-String)
  }
}

function Test-SupabaseQaAccess {
  $result = Invoke-SupabaseCli -Arguments @('projects', 'list')
  return [pscustomobject]@{
    Success = $result.Success -and $result.Output -match $qaRef
    ExitCode = $result.ExitCode
    Output = $result.Output
  }
}

Write-Host 'Checking Supabase CLI authentication for the authorized QA project...'

$existingProcessToken = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', 'Process')
if ($existingProcessToken -and $existingProcessToken -notmatch '^sbp_[A-Za-z0-9]+$') {
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Write-Host 'Ignored an invalid inherited SUPABASE_ACCESS_TOKEN without displaying or persisting it.' -ForegroundColor Yellow
}

$temporaryTokenInstalled = $false
$handoffFlagInstalled = $false
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
      throw "The supplied token is invalid or its account cannot see QA project $qaRef."
    }
  }

  Write-Host 'Supabase QA authentication verified.'

  $configPath = Join-Path $repoRoot 'supabase\config.toml'
  if (-not (Test-Path $configPath)) {
    Write-Host 'Initializing the local Supabase workspace...'
    $initResult = Invoke-SupabaseCli -Arguments @('init', '--yes')
    if (-not $initResult.Success) {
      Write-Host $initResult.Output
      throw 'Supabase local workspace initialization failed.'
    }
  }

  Write-Host "Linking the local Supabase workspace exclusively to QA $qaRef..."
  $linkResult = Invoke-SupabaseCli -Arguments @('link', '--project-ref', $qaRef) -SendBlankLine
  if (-not $linkResult.Success) {
    Write-Host $linkResult.Output
    throw "Supabase QA link failed for $qaRef."
  }

  $linkedRefPath = Join-Path $repoRoot 'supabase\.temp\project-ref'
  if (-not (Test-Path $linkedRefPath)) {
    throw 'Supabase link reported success but no local project-ref proof was created.'
  }

  $linkedRef = (Get-Content -Path $linkedRefPath -Raw).Trim()
  if ($linkedRef -eq $productionRef) {
    throw 'Safety stop: the local Supabase workspace became linked to production.'
  }
  if ($linkedRef -ne $qaRef) {
    throw "Safety stop: expected QA link $qaRef but found $linkedRef."
  }

  $env:GATE_4B_QA_AUTH_VERIFIED = '1'
  $handoffFlagInstalled = $true

  Write-Host 'Supabase QA authentication and local link verified. Handing the remaining Gate 4B work to Codex...'
  & powershell -ExecutionPolicy Bypass -File $directRunner
  if ($LASTEXITCODE -ne 0) {
    throw "Direct Gate 4B runner exited with code $LASTEXITCODE."
  }
}
finally {
  if ($handoffFlagInstalled) {
    Remove-Item Env:GATE_4B_QA_AUTH_VERIFIED -ErrorAction SilentlyContinue
  }
  if ($temporaryTokenInstalled) {
    Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  }

  $plainToken = $null
  if ($tokenBstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr)
  }
}
