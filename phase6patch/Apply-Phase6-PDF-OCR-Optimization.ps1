$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PatchRoot = Join-Path $PSScriptRoot 'patchfiles'
$NodePath = 'D:\Program Files\nodejs'

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' NINURTA ISX PRO - PHASE 6 PDF / OCR OPTIMIZATION' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan

if (!(Test-Path (Join-Path $ProjectRoot 'package.json'))) {
    throw 'Project root was not found. Extract phase6patch directly inside Ninurta-Current.'
}
if (!(Test-Path (Join-Path $PatchRoot 'src\components\AccountStatementView.tsx'))) {
    throw 'Patch files are missing. Extract the complete ZIP again.'
}
if (!(Test-Path (Join-Path $NodePath 'npm.cmd'))) {
    throw "Node.js npm.cmd was not found at $NodePath."
}
$env:Path = "$NodePath;$env:Path"
Set-Location $ProjectRoot
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectRoot "backups\phase6-$Stamp"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$Targets = @(
    'src\App.tsx',
    'src\components\AccountStatementView.tsx',
    'src\utils\pdfText.ts',
    'tests\appCodeSplitting.test.ts',
    'tests\pdfText.test.ts'
)

try {
    foreach ($Relative in $Targets) {
        $Destination = Join-Path $ProjectRoot $Relative
        if (Test-Path $Destination) {
            $Backup = Join-Path $BackupRoot $Relative
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Backup) | Out-Null
            Copy-Item $Destination $Backup -Force
        }
    }

    foreach ($Relative in $Targets) {
        $Source = Join-Path $PatchRoot $Relative
        if (!(Test-Path $Source)) { throw "Missing patch file: $Relative" }
        $Destination = Join-Path $ProjectRoot $Relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
        Copy-Item $Source $Destination -Force
    }

    # Remove staging sources before TypeScript scans the project.
    Remove-Item $PatchRoot -Recurse -Force

    Write-Host "`n[1/3] Running JavaScript and Python tests..." -ForegroundColor Yellow
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Tests failed with exit code $LASTEXITCODE" }

    Write-Host "`n[2/3] Running TypeScript validation..." -ForegroundColor Yellow
    & npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE" }

    Write-Host "`n[3/3] Building production bundle..." -ForegroundColor Yellow
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }

    Write-Host "`nPHASE 6 PDF / OCR OPTIMIZATION PASSED." -ForegroundColor Green
    Write-Host "Backup: $BackupRoot" -ForegroundColor Gray
}
catch {
    Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Restoring the original files...' -ForegroundColor Yellow
    foreach ($Relative in $Targets) {
        $Backup = Join-Path $BackupRoot $Relative
        $Destination = Join-Path $ProjectRoot $Relative
        if (Test-Path $Backup) {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
            Copy-Item $Backup $Destination -Force
        } elseif ($Relative -in @('src\utils\pdfText.ts','tests\pdfText.test.ts')) {
            if (Test-Path $Destination) { Remove-Item $Destination -Force }
        }
    }
    throw
}
