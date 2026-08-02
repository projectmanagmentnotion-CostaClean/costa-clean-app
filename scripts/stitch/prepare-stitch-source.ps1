param(
  [string]$SourceFolder = "$HOME\Downloads",
  [string]$DestinationFolder = ".project-agent\private\stitch-source"
)

$ErrorActionPreference = 'Stop'
$expectedZipCount = 4
$expectedCodeCount = 58
$expectedScreenCount = 59
$expectedDesignCount = 7

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step "Resolviendo rutas"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$sourcePath = (Resolve-Path $SourceFolder).Path
$destinationPath = Join-Path $repoRoot $DestinationFolder

New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null

Write-Host "Origen:  $sourcePath"
Write-Host "Destino: $destinationPath"

Write-Step "Buscando los cuatro exports definitivos de Stitch"
$zipCandidates = @(
  Get-ChildItem -Path $sourcePath -File -Filter '*.zip' |
    Where-Object { $_.BaseName -match '^stitch_costa_clean_crm_system(?: \(\d+\))?$' } |
    Sort-Object Name
)

if ($zipCandidates.Count -ne $expectedZipCount) {
  Write-Host "Se esperaban exactamente $expectedZipCount archivos y se encontraron $($zipCandidates.Count)." -ForegroundColor Yellow
  if ($zipCandidates.Count -gt 0) {
    $zipCandidates | ForEach-Object { Write-Host " - $($_.Name)" }
  }
  throw "Coloca los cuatro ZIP definitivos exportados por Stitch en '$sourcePath' y vuelve a ejecutar el script."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$packages = @()
foreach ($zip in $zipCandidates) {
  Write-Host "Validando $($zip.Name)..."
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
  try {
    $entries = @($archive.Entries)
    $codeCount = @($entries | Where-Object { $_.FullName -match '(^|/)code\.html$' }).Count
    $screenCount = @($entries | Where-Object { $_.FullName -match '(^|/)screen\.png$' }).Count
    $designCount = @($entries | Where-Object { $_.FullName -match '(^|/)DESIGN\.md$' }).Count

    if ($codeCount -eq 0 -and $screenCount -eq 0 -and $designCount -eq 0) {
      throw "El archivo '$($zip.Name)' no parece un export válido de Stitch."
    }

    $destinationFile = Join-Path $destinationPath $zip.Name
    if ([System.IO.Path]::GetFullPath($zip.FullName) -ne [System.IO.Path]::GetFullPath($destinationFile)) {
      Copy-Item -LiteralPath $zip.FullName -Destination $destinationFile -Force
    }

    $packages += [pscustomobject]@{
      file = $zip.Name
      size_bytes = $zip.Length
      code_html = $codeCount
      screen_png = $screenCount
      design_md = $designCount
      sha256 = (Get-FileHash -LiteralPath $zip.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  finally {
    $archive.Dispose()
  }
}

$codeTotal = ($packages | Measure-Object -Property code_html -Sum).Sum
$screenTotal = ($packages | Measure-Object -Property screen_png -Sum).Sum
$designTotal = ($packages | Measure-Object -Property design_md -Sum).Sum
$contentInventoryComplete = (
  $codeTotal -eq $expectedCodeCount -and
  $screenTotal -eq $expectedScreenCount -and
  $designTotal -eq $expectedDesignCount
)

$report = [pscustomobject]@{
  generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
  package_set = 'definitive-four-package-export'
  expected_zip_count = $expectedZipCount
  actual_zip_count = $packages.Count
  expected_counts = [pscustomobject]@{
    code_html = $expectedCodeCount
    screen_png = $expectedScreenCount
    design_md = $expectedDesignCount
  }
  actual_counts = [pscustomobject]@{
    code_html = $codeTotal
    screen_png = $screenTotal
    design_md = $designTotal
  }
  content_inventory_complete = $contentInventoryComplete
  packages = $packages
}

Write-Step "Generando informe local"
$reportPath = Join-Path $destinationPath 'stitch-source-report.json'
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "`nPaquetes preparados:" -ForegroundColor Green
$packages | Format-Table file, code_html, screen_png, design_md -AutoSize
Write-Host "Totales: code.html=$codeTotal, screen.png=$screenTotal, DESIGN.md=$designTotal" -ForegroundColor Cyan
Write-Host "Informe: $reportPath" -ForegroundColor Gray
Write-Host "La carpeta está ignorada por Git y no debe subirse al repositorio." -ForegroundColor Yellow

if (-not $contentInventoryComplete) {
  throw "Los cuatro ZIP se validaron, pero su inventario no coincide con los totales canónicos: 58 code.html, 59 screen.png y 7 DESIGN.md. Revisa exports duplicados, incompletos o renombrados."
}

Write-Host "Inventario definitivo validado correctamente." -ForegroundColor Green
Write-Host "`nSiguiente paso para Codex:" -ForegroundColor Cyan
Write-Host "git switch prototype/stitch-full-visual-parity"
Write-Host "git pull --ff-only origin prototype/stitch-full-visual-parity"
Write-Host "Get-Content .project-agent\private\stitch-source\stitch-source-report.json"
