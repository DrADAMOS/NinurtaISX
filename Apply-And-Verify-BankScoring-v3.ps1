$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
$Target = Join-Path $Project 'tests\bankScoring.test.ts'
$Source = Join-Path $PSScriptRoot 'patchfiles\tests\bankScoring.test.ts'

if (-not (Test-Path (Join-Path $Project 'package.json'))) {
    throw "package.json not found. Run this script from the Ninurta project folder."
}
if (-not (Test-Path $Source)) {
    throw "Patch source file missing. Extract the complete ZIP, preserving folders."
}
New-Item -ItemType Directory -Path (Split-Path $Target) -Force | Out-Null

if (Test-Path $Target) {
    $Backup = "$Target.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $Target -Destination $Backup
    Write-Host "Backup created: $Backup"
}
Copy-Item -LiteralPath $Source -Destination $Target -Force
Write-Host "Updated tests\bankScoring.test.ts" -ForegroundColor Green

$NodeDir = 'D:\Program Files\nodejs'
if (Test-Path "$NodeDir\node.exe") { $env:Path = "$NodeDir;$env:Path" }

Write-Host "`n[1/4] Focused bank scoring tests..."
npm.cmd exec -- tsx --test tests/bankScoring.test.ts
if ($LASTEXITCODE -ne 0) { throw "Focused bank scoring tests failed." }

Write-Host "`n[2/4] Full test suite..."
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Full test suite failed." }

Write-Host "`n[3/4] TypeScript check..."
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }

Write-Host "`n[4/4] Production build..."
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

Write-Host "`nAll checks passed." -ForegroundColor Green
