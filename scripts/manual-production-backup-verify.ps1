[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [Parameter(Mandatory = $true)]
    [string]$AgeIdentityPath
)

$ErrorActionPreference = 'Stop'
$required = @('roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql', 'history_data.sql', 'checksums.sha256', 'manifest.json')
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) "CostaClean-verify-$([guid]::NewGuid().ToString('N'))"
$decrypted = Join-Path $tempRoot 'backup.tar.gz'
$extract = Join-Path $tempRoot 'contents'
$stderrFile = Join-Path $tempRoot 'verify.stderr'
$success = $false

try {
    if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw 'backup missing' }
    if (-not (Test-Path -LiteralPath $AgeIdentityPath -PathType Leaf)) { throw 'identity missing' }
    $age = (Get-Command age -ErrorAction Stop).Source
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    $sidecar = "$BackupFile.sha256"
    if (Test-Path -LiteralPath $sidecar -PathType Leaf) {
        $expected = ((Get-Content -LiteralPath $sidecar -ErrorAction Stop | Select-Object -First 1) -split '\s+')[0].ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($expected -notmatch '^[0-9a-f]{64}$' -or $expected -ne $actual) { throw 'archive hash mismatch' }
    }
    & $age -d -i $AgeIdentityPath -o $decrypted $BackupFile 1>$null 2>$stderrFile
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $decrypted -PathType Leaf)) { throw 'decryption failed' }
    & tar -tzf $decrypted 1>$null 2>$stderrFile
    if ($LASTEXITCODE -ne 0) { throw 'archive listing failed' }
    & tar -xzf $decrypted -C $extract 1>$null 2>$stderrFile
    if ($LASTEXITCODE -ne 0) { throw 'archive extraction failed' }
    foreach ($name in $required) {
        $path = Join-Path $extract $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -le 0) { throw 'required artifact missing' }
    }
    foreach ($line in Get-Content -LiteralPath (Join-Path $extract 'checksums.sha256')) {
        if ($line -notmatch '^([0-9a-fA-F]{64})\s+\*?(.+)$') { throw 'invalid checksum manifest' }
        $expected = $Matches[1].ToLowerInvariant()
        $name = $Matches[2]
        $path = Join-Path $extract $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'checksum artifact missing' }
        if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'artifact hash mismatch' }
    }
    $success = $true
    Write-Output 'VERIFY_STATUS=PASS'
}
catch {
    Write-Output 'VERIFY_STATUS=FAIL'
    exit 1
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
