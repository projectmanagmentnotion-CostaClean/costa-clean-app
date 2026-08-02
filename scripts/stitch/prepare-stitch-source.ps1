param(
  [string]$SourceFolder = "$HOME\Downloads",
  [string]$DestinationFolder = ".project-agent\private\stitch-source"
)

$ErrorActionPreference = 'Stop'

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

Write-Step "Buscando exports ZIP de Stitch"
$zipCandidates = Get-ChildItem -Path $sourcePath -File -Filter '*.zip' |
  Where-Object { $_.BaseName -match '^stitch_costa_clean_crm_system(?: \(\d+\))?$' } |
  Sort-Object Name

if ($zipCandidates.Count -ne 6) {
  Write-Host "Se esperaban exactamente 6 archivos y se encontraron $($zipCandidates.Count)." -ForegroundColor Yellow
  if ($zipCandidates.Count -gt 0) {
    $zipCandidates | ForEach-Object { Write-Host " - $($_.Name)" }
  }
  throw "Coloca los seis ZIP exportados por Stitch en '$sourcePath' y vuelve a ejecutar el script."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$report = @()
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

    Copy-Item -LiteralPath $zip.FullName -Destination (Join-Path $destinationPath $zip.Name) -Force

    $report += [pscustomobject]@{
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

Write-Step "Generando informe local"
$reportPath = Join-Path $destinationPath 'stitch-source-report.json'
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "`nPaquetes preparados correctamente:" -ForegroundColor Green
$report | Format-Table file, code_html, screen_png, design_md -AutoSize

Write-Host "Informe: $reportPath" -ForegroundColor Gray
Write-Host "La carpeta está ignorada por Git y no debe subirse al repositorio." -ForegroundColor Yellow
Write-Host "`nSiguiente paso para Codex:" -ForegroundColor Cyan
Write-Host "git switch prototype/stitch-full-visual-parity"
Write-Host "git pull --ff-only origin prototype/stitch-full-visual-parity"
Write-Host "Get-ChildItem .project-agent\private\stitch-source"
