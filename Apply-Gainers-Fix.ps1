$ErrorActionPreference = 'Stop'
$Here = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$ProjectRoot = $Here

while ($ProjectRoot -and
       (-not (Test-Path (Join-Path $ProjectRoot 'package.json')) -or
        -not (Test-Path (Join-Path $ProjectRoot 'src\components\RecommendationsView.tsx')))) {
    $Parent = Split-Path -Parent $ProjectRoot
    if (-not $Parent -or $Parent -eq $ProjectRoot) { $ProjectRoot = $null; break }
    $ProjectRoot = $Parent
}
if (-not $ProjectRoot) { throw 'Project root not found. Extract this ZIP inside Ninurta-Current.' }

$Target = Join-Path $ProjectRoot 'src\components\Header.tsx'
$Replacement = Join-Path $Here 'patch\Header.tsx'
if (-not (Test-Path $Target)) { throw 'Target src\components\Header.tsx not found.' }
if (-not (Test-Path $Replacement)) { throw 'Patch file patch\Header.tsx is missing.' }

$Current = Get-Content -LiteralPath $Target -Raw
if ($Current.Contains("getMarketPulse(stock)") -and $Current.Contains("import { getMarketPulse } from '../utils/marketPulse';")) {
    Write-Host 'Gainers count fix is already present. No file changed.' -ForegroundColor Green
    exit 0
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $ProjectRoot 'backups'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Backup = Join-Path $BackupDir "Header.tsx.before-gainers-count-fix-$Stamp"
Copy-Item -LiteralPath $Target -Destination $Backup -Force
Copy-Item -LiteralPath $Replacement -Destination $Target -Force

$Applied = Get-Content -LiteralPath $Target -Raw
if (-not ($Applied.Contains("getMarketPulse(stock)") -and $Applied.Contains("import { getMarketPulse } from '../utils/marketPulse';"))) {
    Copy-Item -LiteralPath $Backup -Destination $Target -Force
    throw 'Post-apply verification failed. Original Header.tsx was restored.'
}

Write-Host 'Gainers/losers count fix applied and verified.' -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Backup:  $Backup"
Write-Host 'Restart the app to see matching counts.' -ForegroundColor Cyan
