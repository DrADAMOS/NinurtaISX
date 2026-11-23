$ErrorActionPreference = 'Stop'
$projectRoot = (Get-Location).Path
$patchRoot = Join-Path $PSScriptRoot 'patchfiles'
$targets = @(
  'src/utils/portfolioReconciliation.ts',
  'src/components/PortfolioReconciliation.tsx',
  'src/components/PortfolioView.tsx',
  'tests/portfolioReconciliation.test.ts'
)

Write-Host '=============================================='
Write-Host ' NINURTA ISX PRO - PHASE 10 PORTFOLIO RECONCILIATION'
Write-Host '=============================================='

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json') -PathType Leaf)) {
  throw 'package.json not found. Run this script from the Ninurta-Current project root.'
}
foreach ($target in $targets) {
  $source = Join-Path $patchRoot $target
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Patch file missing: $target. Extract the complete Phase 10 ZIP into the project root."
  }
}

$nodeDir = 'D:\Program Files\nodejs'
$nodeExe = Join-Path $nodeDir 'node.exe'
if (Test-Path -LiteralPath $nodeExe -PathType Leaf) { $env:Path = "$nodeDir;$env:Path" }
$npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  $candidate = Join-Path $nodeDir 'npm.cmd'
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { $npmCommand = Get-Item -LiteralPath $candidate }
}
if (-not $npmCommand) { throw 'npm.cmd not found. Verify Node.js at D:\Program Files\nodejs.' }
$npmPath = $npmCommand.Source
if (-not (Test-Path -LiteralPath $nodeExe -PathType Leaf)) {
  $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { throw 'node.exe not found. Verify the Node.js installation.' }
  $nodeExe = $nodeCommand.Source
}
Write-Host "Node.js: $(& $nodeExe --version)"
Write-Host "npm: $(& $npmPath --version)"

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $projectRoot "backups\phase10-portfolio-$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$installed = @()
try {
  foreach ($target in $targets) {
    $destination = Join-Path $projectRoot $target
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    if (Test-Path -LiteralPath $destination -PathType Leaf) {
      $backup = Join-Path $backupRoot $target
      New-Item -ItemType Directory -Path (Split-Path $backup -Parent) -Force | Out-Null
      Copy-Item -LiteralPath $destination -Destination $backup -Force
    }
    Copy-Item -LiteralPath (Join-Path $patchRoot $target) -Destination $destination -Force
    $installed += $target
  }

  # Critical: remove TypeScript patch staging before running project-wide tsc.
  # The staged files contain relative imports intended for their final src/ locations.
  Remove-Item -LiteralPath $patchRoot -Recurse -Force
  if (Test-Path -LiteralPath $patchRoot) { throw 'Temporary patch staging could not be removed.' }
  Write-Host 'Temporary patch staging removed before validation.'
  Write-Host "Backup: $backupRoot"

  Write-Host '[1/3] JavaScript and Python tests...'
  & $npmPath test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed with exit code $LASTEXITCODE" }

  Write-Host '[2/3] TypeScript validation...'
  & $npmPath run lint
  if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE" }

  Write-Host '[3/3] Production build...'
  & $npmPath run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }

  Write-Host 'PHASE 10 PORTFOLIO RECONCILIATION PASSED.' -ForegroundColor Green
  Write-Host "Backup: $backupRoot"
}
catch {
  Write-Host 'FAILED: Restoring original files...' -ForegroundColor Red
  foreach ($target in $installed) {
    $destination = Join-Path $projectRoot $target
    $backup = Join-Path $backupRoot $target
    if (Test-Path -LiteralPath $backup -PathType Leaf) {
      Copy-Item -LiteralPath $backup -Destination $destination -Force
    } elseif (Test-Path -LiteralPath $destination -PathType Leaf) {
      Remove-Item -LiteralPath $destination -Force
    }
  }
  throw
}
