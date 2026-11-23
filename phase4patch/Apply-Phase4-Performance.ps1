$ErrorActionPreference = 'Stop'
$ProjectRoot = (Get-Location).Path
$AppPath = Join-Path $ProjectRoot 'src\App.tsx'
$PatchTest = Join-Path $PSScriptRoot 'patchfiles\tests\appCodeSplitting.test.ts'
$TestDir = Join-Path $ProjectRoot 'tests'
$NodeDir = 'D:\Program Files\nodejs'

if (-not (Test-Path -LiteralPath $AppPath)) { throw "Missing src\App.tsx in project root: $ProjectRoot" }
if (-not (Test-Path -LiteralPath $PatchTest)) { throw 'Missing Phase 4 test file.' }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) { throw 'package.json not found. Run this script from the project root.' }

$source = [System.IO.File]::ReadAllText($AppPath, [System.Text.Encoding]::UTF8)
$views = @('RecommendationsView','MarketDirectory','PortfolioView','FeeCalculator','BankAnalyticsView','TopMoversView','InvestorHubView','AccountStatementView')
if ($source.Contains('const RecommendationsView = lazy(')) { throw 'Lazy loading appears to be already applied. No changes made.' }

$reactImport = "import React, { useState, useEffect, useMemo } from 'react';"
if (-not $source.Contains($reactImport)) { throw 'React import did not match expected source. No changes made.' }
$navigationImport = "import { Navigation } from './components/Navigation';"
if (-not $source.Contains($navigationImport)) { throw 'Navigation import not found. No changes made.' }
$mainOpen = '      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">'
if (-not $source.Contains($mainOpen)) { throw 'Main workspace opening tag not found. No changes made.' }
$mainClose = '      </main>'
if (-not $source.Contains($mainClose)) { throw 'Main workspace closing tag not found. No changes made.' }

foreach ($view in $views) {
  $importLine = "import { $view } from './components/$view';`n"
  $source = $source.Replace($importLine, '')
  $importLineCRLF = "import { $view } from './components/$view';`r`n"
  $source = $source.Replace($importLineCRLF, '')
}
$source = $source.Replace($reactImport, "import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';")
$lazyBlock = "`r`n`r`n// Load secondary workspaces only when selected.`r`n"
foreach ($view in $views) { $lazyBlock += "const $view = lazy(() => import('./components/$view').then((module) => ({ default: module.$view })));`r`n" }
$source = $source.Replace($navigationImport, $navigationImport + $lazyBlock)
$fallback = '<Suspense fallback={<div role="status" className="min-h-48 flex items-center justify-center text-sm text-slate-400">Loading section...</div>}>'
$source = $source.Replace($mainOpen, $mainOpen + "`r`n        " + $fallback)
$source = $source.Replace($mainClose, "        </Suspense>`r`n" + $mainClose)

# Validate the transformed source before touching the project file.
foreach ($view in $views) {
  if (-not $source.Contains("const $view = lazy(() => import('./components/$view')")) { throw "Failed to create lazy import for $view." }
  if ($source.Contains("import { $view } from './components/$view';")) { throw "Static import remains for $view." }
}
if (-not $source.Contains('<Suspense fallback=')) { throw 'Suspense wrapper was not added.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$AppPath.bak-phase4-$stamp"
Copy-Item -LiteralPath $AppPath -Destination $backup
Write-Host "Backup created: $backup" -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $TestDir)) { New-Item -ItemType Directory -Path $TestDir | Out-Null }
$testPath = Join-Path $TestDir 'appCodeSplitting.test.ts'
if (Test-Path -LiteralPath $testPath) { Copy-Item -LiteralPath $testPath -Destination "$testPath.bak-phase4-$stamp" }

try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($AppPath, $source, $utf8NoBom)
  Copy-Item -LiteralPath $PatchTest -Destination $testPath -Force
  if (Test-Path -LiteralPath (Join-Path $NodeDir 'node.exe')) { $env:Path = "$NodeDir;$env:Path" }
  Write-Host "`n[1/3] Tests..." -ForegroundColor Cyan
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
  Write-Host "`n[2/3] TypeScript..." -ForegroundColor Cyan
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
  Write-Host "`n[3/3] Production build..." -ForegroundColor Cyan
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
  Write-Host "`nPHASE 4 CODE-SPLITTING PATCH PASSED." -ForegroundColor Green
} catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Backup retained at: $backup" -ForegroundColor Yellow
  Write-Host 'The script did not automatically roll back. Restore the backup if validation failed.' -ForegroundColor Yellow
  exit 1
}
