$ErrorActionPreference = 'Stop'
$Root = (Get-Location).Path
$PatchRoot = Join-Path $PSScriptRoot 'patchfiles'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $Root "backups\phase8-rabee-$Stamp"
$Files = @(
  'src\utils\rabeeStatement.ts',
  'src\components\RabeeStatementPanel.tsx',
  'src\components\AccountStatementView.tsx',
  'tests\rabeeStatement.test.ts'
)

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' NINURTA ISX PRO - PHASE 8 RABEE BROKER IMPORT' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $Root 'package.json')) -or -not (Test-Path (Join-Path $Root 'src\components\AccountStatementView.tsx'))) {
  throw 'Run this script from the Ninurta project root.'
}
foreach ($relative in $Files) {
  if (-not (Test-Path (Join-Path $PatchRoot $relative))) { throw "Patch file missing: $relative" }
}
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Applied = New-Object System.Collections.Generic.List[string]
$Created = New-Object System.Collections.Generic.List[string]
try {
  foreach ($relative in $Files) {
    $destination = Join-Path $Root $relative
    if (Test-Path $destination) {
      $backup = Join-Path $BackupDir $relative
      New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null
      Copy-Item $destination $backup -Force
    } else { $Created.Add($relative) }
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    Copy-Item (Join-Path $PatchRoot $relative) $destination -Force
    $Applied.Add($relative)
  }
  Remove-Item $PatchRoot -Recurse -Force
  Write-Host 'Temporary patch staging removed.' -ForegroundColor Gray
  $nodeDir = 'D:\Program Files\nodejs'
  if (Test-Path (Join-Path $nodeDir 'npm.cmd')) { $env:Path = "$nodeDir;$env:Path" }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd not found. Install Node.js or add it to PATH.' }

  Write-Host "`n[1/3] JavaScript and Python tests..." -ForegroundColor Yellow
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed with exit code $LASTEXITCODE" }
  Write-Host "`n[2/3] TypeScript validation..." -ForegroundColor Yellow
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE" }
  Write-Host "`n[3/3] Production build..." -ForegroundColor Yellow
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }
  Write-Host "`nPHASE 8 RABEE BROKER IMPORTER PASSED." -ForegroundColor Green
  Write-Host "Backup: $BackupDir" -ForegroundColor Gray
}
catch {
  Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Restoring original files...' -ForegroundColor Yellow
  foreach ($relative in $Applied) {
    $backup = Join-Path $BackupDir $relative
    $destination = Join-Path $Root $relative
    if (Test-Path $backup) { Copy-Item $backup $destination -Force }
    elseif ($Created.Contains($relative)) { Remove-Item $destination -Force -ErrorAction SilentlyContinue }
  }
  throw
}
