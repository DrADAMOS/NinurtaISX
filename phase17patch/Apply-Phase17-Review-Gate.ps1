param([switch]$SkipHashCheck)
$ErrorActionPreference = 'Stop'
$projectRoot = (Get-Location).Path
$patchRoot = Join-Path $PSScriptRoot 'patchfiles'
$targets = @(
  'src/utils/reviewGate.ts',
  'src/types/stock.ts',
  'src/data/stocksData.ts',
  'src/components/StockDetailModal.tsx',
  'src/components/RecommendationsView.tsx',
  'src/components/MarketDirectory.tsx',
  'src/App.tsx',
  'tests/reviewGate.test.ts',
  'scripts/confirm-directory-match.py'
)
# SHA-256 of the files as shipped in the Phase 16 package. If your copy differs, it was edited after
# Phase 16 and a blind overwrite would lose those edits.
$expected = @{
  'src/types/stock.ts' = '5523990a13cecaa4d37983a56c1fc5a63310e7fb099114563555329f0b7e9842'
  'src/data/stocksData.ts' = 'c6bdf51237f45444d58c822c60dc598e31999ca6ef49b0a0b7b32ffe42c6f97e'
  'src/components/StockDetailModal.tsx' = '2e38563ebbd4438b23016f25b8cf64a5689c434952f4fc92f109fe99d99601fc'
  'src/components/RecommendationsView.tsx' = 'b6ea6f44483401ae6ea14e6b5a6d53970f0f79173e7b11f858b87a9b66fbc244'
  'src/components/MarketDirectory.tsx' = '38b625087f8bc0a0e8a49e7a8e0c49a36b5817d6578b916096713e558812018c'
  'src/App.tsx' = 'f60aaa637809204184bde2fe9ed30e4eb19661b207b8cda9ec84b966821a85c5'
}

Write-Host '=============================================='
Write-Host ' NINURTA ISX PRO - PHASE 17 REVIEW GATE'
Write-Host '=============================================='
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json') -PathType Leaf)) {
  throw 'package.json not found. Run this script from the project root.'
}
foreach ($target in $targets) {
  if (-not (Test-Path -LiteralPath (Join-Path $patchRoot $target) -PathType Leaf)) { throw "Patch file missing: $target" }
}
if (-not $SkipHashCheck) {
  foreach ($key in $expected.Keys) {
    $path = Join-Path $projectRoot $key
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Project file missing: $key" }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected[$key]) {
      throw "$key differs from the Phase 16 package (edited since). Re-run with -SkipHashCheck only if you accept overwriting those edits."
    }
  }
}

$nodeDir = 'D:\Program Files\nodejs'
if (Test-Path -LiteralPath (Join-Path $nodeDir 'node.exe') -PathType Leaf) { $env:Path = "$nodeDir;$env:Path" }
$npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
if (-not $npm) { throw 'npm.cmd not found. Verify the Node.js installation.' }
$npmPath = $npm.Source

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $projectRoot "backups\phase17-review-gate-$stamp"
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
  # Staging holds copies with relative imports for their final locations; remove before tsc.
  Remove-Item -LiteralPath $patchRoot -Recurse -Force
  Write-Host "Backup: $backupRoot"

  Write-Host '[1/3] Review-gate and data-quality tests...'
  & $npmPath exec -- tsx --test tests/reviewGate.test.ts tests/dataQuality.test.ts tests/stocksDataQuality.test.ts
  if ($LASTEXITCODE -ne 0) { throw "Tests failed with exit code $LASTEXITCODE" }

  Write-Host '[2/3] TypeScript validation...'
  & $npmPath run lint
  if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE" }

  Write-Host '[3/3] Production build...'
  & $npmPath run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }

  Write-Host 'PHASE 17 REVIEW GATE PASSED.' -ForegroundColor Green
}
catch {
  Write-Host 'FAILED: restoring original files...' -ForegroundColor Red
  foreach ($target in $installed) {
    $destination = Join-Path $projectRoot $target
    $backup = Join-Path $backupRoot $target
    if (Test-Path -LiteralPath $backup -PathType Leaf) { Copy-Item -LiteralPath $backup -Destination $destination -Force }
    elseif (Test-Path -LiteralPath $destination -PathType Leaf) { Remove-Item -LiteralPath $destination -Force }
  }
  throw
}
