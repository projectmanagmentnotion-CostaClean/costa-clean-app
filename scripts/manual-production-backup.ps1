[CmdletBinding()]
param(
    [Parameter()]
    [string]$BaseDirectory = 'C:\Users\Anderson S\.costaclean-backups'
)

$ErrorActionPreference = 'Stop'
$AgeRecipient = 'age1c2xnmtazzp4tjewxx4rjqfafdkskqkudaraqmap7q4k9h4z4pphqytj0dz'
$ProjectRef = 'wfxnwfcdjainpojhbdri'
$RequiredFiles = @('roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql', 'history_data.sql')
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$runDirectory = Join-Path ([IO.Path]::GetFullPath($BaseDirectory)) "CostaClean-PROD-$timestamp"
$archive = Join-Path ([IO.Path]::GetFullPath($BaseDirectory)) "CostaClean-PROD-$timestamp.tar.gz.age"
$sidecar = "$archive.sha256"
$tarFile = Join-Path ([IO.Path]::GetTempPath()) "CostaClean-PROD-$timestamp-$([guid]::NewGuid().ToString('N')).tar.gz"
$stderrFile = Join-Path ([IO.Path]::GetTempPath()) "CostaClean-PROD-$([guid]::NewGuid().ToString('N')).stderr"
$dbUrl = [Environment]::GetEnvironmentVariable('COSTACLEAN_DB_URL')
$success = $false

function Invoke-Silent {
    param([string]$FilePath, [string[]]$ArgumentList)
    Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
    & $FilePath @ArgumentList 1>$null 2>$stderrFile
    if ($LASTEXITCODE -ne 0) { throw 'external command failed' }
}

function Get-SafeSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Apply-Retention {
    param([string]$Directory)
    if (-not (Test-Path -LiteralPath $Directory)) { return }
    $regular = @(Get-ChildItem -LiteralPath $Directory -File -Filter 'CostaClean-PROD-*.tar.gz.age' |
        Where-Object { $_.Name -notmatch 'MILESTONE|PRE_MIGRATION' } |
        Sort-Object LastWriteTimeUtc -Descending)
    if ($regular.Count -le 4) { return }
    foreach ($old in $regular | Select-Object -Skip 4) {
        Remove-Item -LiteralPath $old.FullName -Force
        $oldSidecar = "$($old.FullName).sha256"
        if (Test-Path -LiteralPath $oldSidecar) { Remove-Item -LiteralPath $oldSidecar -Force }
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw 'database URL unavailable' }
    $supabase = (Get-Command supabase -ErrorAction Stop).Source
    $age = (Get-Command age -ErrorAction Stop).Source
    $null = Get-Command tar -ErrorAction Stop
    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path ([IO.Path]::GetFullPath($BaseDirectory)) -Force | Out-Null

    $dumpArguments = @(
        @('db', 'dump', '--db-url', $dbUrl, '-f', (Join-Path $runDirectory 'roles.sql'), '--role-only'),
        @('db', 'dump', '--db-url', $dbUrl, '-f', (Join-Path $runDirectory 'schema.sql')),
        @('db', 'dump', '--db-url', $dbUrl, '-f', (Join-Path $runDirectory 'data.sql'), '--data-only', '--use-copy', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes'),
        @('db', 'dump', '--db-url', $dbUrl, '-f', (Join-Path $runDirectory 'history_schema.sql'), '--schema', 'supabase_migrations'),
        @('db', 'dump', '--db-url', $dbUrl, '-f', (Join-Path $runDirectory 'history_data.sql'), '--schema', 'supabase_migrations', '--data-only', '--use-copy')
    )
    foreach ($arguments in $dumpArguments) {
        Invoke-Silent -FilePath $supabase -ArgumentList $arguments
    }
    foreach ($name in $RequiredFiles) {
        $path = Join-Path $runDirectory $name
        if (-not (Test-Path -LiteralPath $path) -or (Get-Item -LiteralPath $path).Length -le 0) { throw 'required dump missing' }
    }

    $checksums = foreach ($name in $RequiredFiles) {
        $path = Join-Path $runDirectory $name
        "$(Get-SafeSha256 $path)  $name"
    }
    Set-Content -LiteralPath (Join-Path $runDirectory 'checksums.sha256') -Value $checksums -Encoding ASCII
    $gitHead = (& git rev-parse HEAD 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { $gitHead = $null }
    $cliVersion = (& $supabase --version 2>$stderrFile | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { $cliVersion = 'unknown' }
    $artifacts = foreach ($name in $RequiredFiles) {
        $path = Join-Path $runDirectory $name
        $item = Get-Item -LiteralPath $path
        [ordered]@{ name = $name; size_bytes = [int64]$item.Length; sha256 = Get-SafeSha256 $path }
    }
    $manifest = [ordered]@{
        backup_timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
        project_ref = $ProjectRef
        git_head = $gitHead
        supabase_cli_version = [string]$cliVersion
        artifacts = @($artifacts)
        backup_status = 'PASS'
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runDirectory 'manifest.json') -Encoding UTF8

    & tar -czf $tarFile -C $runDirectory roles.sql schema.sql data.sql history_schema.sql history_data.sql checksums.sha256 manifest.json 1>$null 2>$stderrFile
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $tarFile)) { throw 'archive creation failed' }
    Invoke-Silent -FilePath $age -ArgumentList @('-r', $AgeRecipient, '-o', $archive, $tarFile)
    if (-not (Test-Path -LiteralPath $archive) -or (Get-Item -LiteralPath $archive).Length -le 0) { throw 'encrypted archive missing' }
    $archiveHash = Get-SafeSha256 $archive
    Set-Content -LiteralPath $sidecar -Value "$archiveHash  $(Split-Path -Leaf $archive)" -Encoding ASCII
    Remove-Item -LiteralPath $tarFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $runDirectory -Recurse -Force
    Apply-Retention -Directory ([IO.Path]::GetFullPath($BaseDirectory))
    $success = $true
    Write-Output 'BACKUP_STATUS=PASS'
    Write-Output "BACKUP_TIMESTAMP=$timestamp"
    Write-Output "BACKUP_FILE=$archive"
    Write-Output "BACKUP_SIZE=$((Get-Item -LiteralPath $archive).Length)"
    Write-Output "BACKUP_SHA256=$archiveHash"
}
catch {
    Remove-Item -LiteralPath $tarFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $runDirectory -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output 'BACKUP_STATUS=FAIL'
    exit 1
}
finally {
    Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
    if (-not $success) { Remove-Item -LiteralPath $tarFile -Force -ErrorAction SilentlyContinue }
}
