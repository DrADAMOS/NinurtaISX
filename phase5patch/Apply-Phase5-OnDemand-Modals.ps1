$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$PatchRoot = Join-Path $PSScriptRoot 'patchfiles'
$AppPath = Join-Path $ProjectRoot 'src\App.tsx'
$TestPath = Join-Path $ProjectRoot 'tests\appCodeSplitting.test.ts'
$PackagePath = Join-Path $ProjectRoot 'package.json'

if (-not (Test-Path $PackagePath)) { throw 'package.json was not found. Run this script from the extracted phase5patch folder inside the project.' }
if (-not (Test-Path $AppPath)) { throw 'src\App.tsx was not found.' }
if (-not (Test-Path $TestPath)) { throw 'tests\appCodeSplitting.test.ts was not found.' }
if (-not (Test-Path (Join-Path $PatchRoot 'src\App.tsx'))) { throw 'Patch source is missing.' }
if (-not (Test-Path (Join-Path $PatchRoot 'tests\appCodeSplitting.test.ts'))) { throw 'Patch test is missing.' }

$CurrentApp = Get-Content -LiteralPath $AppPath -Raw -Encoding UTF8
if ($CurrentApp -notmatch "const AccountStatementView = lazy") { throw 'Current App.tsx does not match the expected Phase 4 baseline. No files were changed.' }
if ($CurrentApp -match "const StockDetailModal = lazy") { throw 'Phase 5 modal lazy-loading already appears to be installed. No files were changed.' }
if ($CurrentApp -notmatch "import \{ StockDetailModal \} from './components/StockDetailModal';") { throw 'Unexpected StockDetailModal import. No files were changed.' }
if ($CurrentApp -notmatch "import \{ AlertsModal \} from './components/AlertsModal';") { throw 'Unexpected AlertsModal import. No files were changed.' }

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupApp = "$AppPath.bak-phase5-$Stamp"
$BackupTest = "$TestPath.bak-phase5-$Stamp"
Copy-Item -LiteralPath $AppPath -Destination $BackupApp
Copy-Item -LiteralPath $TestPath -Destination $BackupTest
Write-Host "Backup created: $BackupApp"
Write-Host "Backup created: $BackupTest"

try {
    Copy-Item -LiteralPath (Join-Path $PatchRoot 'src\App.tsx') -Destination $AppPath -Force
    Copy-Item -LiteralPath (Join-Path $PatchRoot 'tests\appCodeSplitting.test.ts') -Destination $TestPath -Force

    # Remove staged source files before TypeScript scans the project tree.
    # Otherwise tsc compiles a duplicate App.tsx from phase5patch/patchfiles.
    Remove-Item -LiteralPath $PatchRoot -Recurse -Force
    Write-Host 'Temporary patch staging removed.'

    $NodeDir = 'D:\Program Files\nodejs'
    if (Test-Path (Join-Path $NodeDir 'node.exe')) {
        $env:Path = "$NodeDir;$env:Path"
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'npm.cmd was not found. Install Node.js or add its folder to PATH.'
    }

    Write-Host ''
    Write-Host '[1/3] Tests...'
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed. The previous source files will be restored.' }

    Write-Host ''
    Write-Host '[2/3] TypeScript...'
    & npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed. The previous source files will be restored.' }

    Write-Host ''
    Write-Host '[3/3] Production build...'
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed. The previous source files will be restored.' }

    Write-Host ''
    Write-Host 'PHASE 5 ON-DEMAND MODALS PASSED.'
}
catch {
    Copy-Item -LiteralPath $BackupApp -Destination $AppPath -Force
    Copy-Item -LiteralPath $BackupTest -Destination $TestPath -Force
    Write-Host 'Patch rolled back. Original files restored.' -ForegroundColor Yellow
    throw
}
