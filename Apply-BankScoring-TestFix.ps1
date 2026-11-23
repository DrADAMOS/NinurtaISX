$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
$Target = Join-Path $Project 'tests\bankScoring.test.ts'
$Source = Join-Path $PSScriptRoot 'tests\bankScoring.test.ts'

if (-not (Test-Path (Join-Path $Project 'package.json'))) {
    throw "package.json not found. Run this script from the Ninurta project folder."
}
if (-not (Test-Path $Source)) {
    throw "Patch test file not found beside this script."
}
$TestsDir = Split-Path $Target
New-Item -ItemType Directory -Path $TestsDir -Force | Out-Null

if (Test-Path $Target) {
    $Backup = "$Target.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $Target $Backup -Force
    Write-Host "Backup created: $Backup"
}
Copy-Item $Source $Target -Force
Write-Host "Updated tests/bankScoring.test.ts" -ForegroundColor Green

$NodeDir = 'D:\Program Files\nodejs'
if (Test-Path "$NodeDir\node.exe") { $env:Path = "$NodeDir;$env:Path" }

Write-Host "`nRunning focused bank scoring tests..."
npm.cmd exec -- tsx --test tests/bankScoring.test.ts
if ($LASTEXITCODE -ne 0) { throw "Bank scoring tests failed. No further checks were run." }

Write-Host "`nRunning full test suite..."
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Full test suite failed." }

Write-Host "`nRunning TypeScript check..."
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }

Write-Host "`nRunning production build..."
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

Write-Host "`nAll requested checks passed." -ForegroundColor Green
