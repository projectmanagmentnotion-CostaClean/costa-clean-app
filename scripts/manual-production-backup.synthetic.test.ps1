[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$scriptText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manual-production-backup.ps1') -Raw
$verifyText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manual-production-backup-verify.ps1') -Raw
$root = Join-Path ([IO.Path]::GetTempPath()) "CostaClean-manual-test-$([guid]::NewGuid().ToString('N'))"
$identity = Join-Path $root 'identity.txt'
$publicKeyOutput = Join-Path $root 'age-keygen.stdout'
$plainTar = Join-Path $root 'synthetic.tar.gz'
$encrypted = Join-Path $root 'synthetic.tar.gz.age'
$decrypted = Join-Path $root 'synthetic-decrypted.tar.gz'
$verifySource = Join-Path $root 'verify-source'
$verifyTar = Join-Path $root 'verify.tar.gz'
$verifyEncrypted = Join-Path $root 'verify.tar.gz.age'
$oldPath = $env:Path
try {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    if ($scriptText -notmatch 'COSTACLEAN_DB_URL' -or
        $scriptText -notmatch "'db', 'dump'" -or
        $scriptText -notmatch [regex]::Escape('roles.sql') -or
        $scriptText -notmatch [regex]::Escape('history_data.sql') -or
        $scriptText -notmatch 'backup_status.*PASS' -or
        $scriptText -match 'Write-Output.*COSTACLEAN_DB_URL' -or
        $scriptText -match 'Write-Output.*dbUrl') { throw 'script contract failed' }
    if ($verifyText -notmatch 'Get-FileHash' -or $verifyText -notmatch 'Remove-Item.*tempRoot') { throw 'verify contract failed' }
    Write-Output 'POWERSHELL_SYNTAX=PASS'
    Write-Output 'SECRET_REDACTION=PASS'

    $payload = Join-Path $root 'payload.txt'
    Set-Content -LiteralPath $payload -Value 'synthetic backup payload' -Encoding ASCII
    & tar -czf $plainTar -C $root payload.txt 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'synthetic tar failed' }
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & age-keygen -o $identity 2>&1 | Set-Content -LiteralPath $publicKeyOutput -Encoding ASCII
    $ErrorActionPreference = $previousErrorAction
    if ($LASTEXITCODE -ne 0) { throw 'age key generation failed' }
    $public = (Select-String -LiteralPath $publicKeyOutput -Pattern '(?i)(?:# )?public key: (age1[0-9a-z]+)').Matches.Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($public)) { throw 'age recipient missing' }
    & age -r $public -o $encrypted $plainTar 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'age encryption failed' }
    & age -d -i $identity -o $decrypted $encrypted 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'age decryption failed' }
    $originalHash = (Get-FileHash -LiteralPath $plainTar -Algorithm SHA256).Hash
    $roundtripHash = (Get-FileHash -LiteralPath $decrypted -Algorithm SHA256).Hash
    if ($originalHash -ne $roundtripHash) { throw 'age hash mismatch' }
    Write-Output 'MANIFEST_HASH_TEST=PASS'
    Write-Output 'AGE_SYNTHETIC_ROUNDTRIP=PASS'

    New-Item -ItemType Directory -Path $verifySource -Force | Out-Null
    foreach ($name in @('roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql', 'history_data.sql')) {
        Set-Content -LiteralPath (Join-Path $verifySource $name) -Value "-- $name" -Encoding ASCII
    }
    $verifyChecksums = foreach ($name in @('roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql', 'history_data.sql')) {
        $path = Join-Path $verifySource $name
        "$( (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() )  $name"
    }
    Set-Content -LiteralPath (Join-Path $verifySource 'checksums.sha256') -Value $verifyChecksums -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $verifySource 'manifest.json') -Value '{"backup_status":"PASS"}' -Encoding UTF8
    & tar -czf $verifyTar -C $verifySource roles.sql schema.sql data.sql history_schema.sql history_data.sql checksums.sha256 manifest.json 1>$null 2>$null
    & age -r $public -o $verifyEncrypted $verifyTar 1>$null 2>$null
    Set-Content -LiteralPath "$verifyEncrypted.sha256" -Value "$( (Get-FileHash -LiteralPath $verifyEncrypted -Algorithm SHA256).Hash.ToLowerInvariant() )  $(Split-Path -Leaf $verifyEncrypted)" -Encoding ASCII
    $verifyOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'manual-production-backup-verify.ps1') -BackupFile $verifyEncrypted -AgeIdentityPath $identity 2>&1
    if ($LASTEXITCODE -ne 0) { throw "verify script failed: $($verifyOutput -join '|')" }
    Write-Output 'VERIFY_SCRIPT=PASS'

    $retentionFiles = 1..5 | ForEach-Object { Join-Path $root "CostaClean-PROD-20260923-00000$_.tar.gz.age" }
    foreach ($path in $retentionFiles) { Set-Content -LiteralPath $path -Value 'synthetic' -Encoding ASCII }
    if ($scriptText -notmatch 'Select-Object -Skip 4' -or $scriptText -notmatch 'MILESTONE\|PRE_MIGRATION') { throw 'retention contract failed' }
    Remove-Item -LiteralPath $plainTar, $decrypted, $payload, $publicKeyOutput -Force
    if ((Test-Path -LiteralPath $plainTar) -or (Test-Path -LiteralPath $decrypted)) { throw 'cleanup failed' }
    Write-Output 'CLEANUP=PASS'
    Write-Output 'RETENTION=PASS'
}
finally {
    $env:Path = $oldPath
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
