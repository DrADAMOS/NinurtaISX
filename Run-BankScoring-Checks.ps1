$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
$Target = Join-Path $Project 'tests\bankScoring.test.ts'

if (-not (Test-Path (Join-Path $Project 'package.json'))) {
    throw "package.json not found. Run this script from the Ninurta project folder."
}
if (-not (Test-Path $Target)) {
    throw "tests\bankScoring.test.ts not found. Extract the patch ZIP into the project folder first."
}

$NodeDir = 'D:\Program Files\nodejs'
if (Test-Path "$NodeDir\node.exe") { $env:Path = "$NodeDir;$env:Path" }

Write-Host "`n[1/4] Running focused bank scoring tests..."
npm.cmd exec -- tsx --test tests/bankScoring.test.ts
if ($LASTEXITCODE -ne 0) { throw "Bank scoring tests failed. See errors above." }

Write-Host "`n[2/4] Running full test suite..."
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Full test suite failed. See errors above." }

Write-Host "`n[3/4] Running TypeScript check..."
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed. See errors above." }

Write-Host "`n[4/4] Running production build..."
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed. See errors above." }

Write-Host "`nAll checks passed." -ForegroundColor Green
