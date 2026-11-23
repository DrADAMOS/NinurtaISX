$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$patchRoot = Join-Path $PSScriptRoot 'patchfiles'
$targets = @(
  'src/components/PortfolioView.tsx',
  'src/components/PortfolioDashboard.tsx',
  'src/utils/portfolioReport.ts',
  'tests/portfolioReport.test.ts'
)
$nodeDir = 'D:\Program Files\nodejs'
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $nodeDir 'node.exe'))) { $env:PATH = "$nodeDir;$env:PATH" }
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm -and (Test-Path (Join-Path $nodeDir 'npm.cmd'))) { $npm = Join-Path $nodeDir 'npm.cmd' }
if (-not $node -or -not $npm) { throw 'Node.js or npm.cmd was not found. Install Node.js or verify D:\Program Files\nodejs.' }
Write-Host "Node.js: $(& $node.Source --version)"
Write-Host "npm: $(& $npm --version)"
foreach ($target in $targets) {
  if (-not (Test-Path (Join-Path $patchRoot $target))) { throw "Patch file missing: $target" }
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backups\phase11-portfolio-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$installed = @()
try {
  Write-Host '=============================================='
  Write-Host ' NINURTA ISX PRO - PHASE 11 PORTFOLIO DASHBOARD'
  Write-Host '=============================================='
  foreach ($target in $targets) {
    $destination = Join-Path $root $target
    $source = Join-Path $patchRoot $target
    $destinationDir = Split-Path $destination -Parent
    New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
    if (Test-Path $destination) {
      $backupFile = Join-Path $backup $target
      New-Item -ItemType Directory -Force -Path (Split-Path $backupFile -Parent) | Out-Null
      Copy-Item -LiteralPath $destination -Destination $backupFile -Force
    }
    Copy-Item -LiteralPath $source -Destination $destination -Force
    $installed += $target
  }
  Remove-Item -LiteralPath $patchRoot -Recurse -Force
  Write-Host 'Temporary patch staging removed before validation.'
  Write-Host "Backup: $backup"
  Write-Host '[1/3] JavaScript and Python tests...'
  & $npm test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed with exit code $LASTEXITCODE" }
  Write-Host '[2/3] TypeScript validation...'
  & $npm run lint
  if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE" }
  Write-Host '[3/3] Production build...'
  & $npm run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }
  Write-Host 'PHASE 11 PORTFOLIO DASHBOARD PASSED.'
  Write-Host "Backup: $backup"
}
catch {
  Write-Host 'FAILED: Restoring original files...' -ForegroundColor Red
  foreach ($target in $installed) {
    $backupFile = Join-Path $backup $target
    $destination = Join-Path $root $target
    if (Test-Path $backupFile) { Copy-Item -LiteralPath $backupFile -Destination $destination -Force }
    elseif (Test-Path $destination) { Remove-Item -LiteralPath $destination -Force }
  }
  throw
}
