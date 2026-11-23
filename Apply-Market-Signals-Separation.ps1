$ErrorActionPreference = 'Stop'
$Here = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$ProjectRoot = $Here
while ($ProjectRoot -and
       (-not (Test-Path (Join-Path $ProjectRoot 'package.json')) -or
        -not (Test-Path (Join-Path $ProjectRoot 'src\components\Header.tsx')))) {
    $Parent = Split-Path -Parent $ProjectRoot
    if (-not $Parent -or $Parent -eq $ProjectRoot) { $ProjectRoot = $null; break }
    $ProjectRoot = $Parent
}
if (-not $ProjectRoot) { throw 'Project root not found. Extract this ZIP inside Ninurta-Current.' }

$Target = Join-Path $ProjectRoot 'src\components\RecommendationsView.tsx'
$Replacement = Join-Path $Here 'patch\RecommendationsView.tsx'
if (-not (Test-Path $Target)) { throw 'Target RecommendationsView.tsx not found.' }
if (-not (Test-Path $Replacement)) { throw 'Patch file patch\RecommendationsView.tsx is missing.' }

$Current = Get-Content -LiteralPath $Target -Raw
if ($Current.Contains('MARKET_SIGNAL_SEPARATION_V1')) {
    Write-Host 'Market signal separation is already present. No file changed.' -ForegroundColor Green
    exit 0
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $ProjectRoot 'backups'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Backup = Join-Path $BackupDir "RecommendationsView.tsx.before-market-signal-separation-$Stamp"
Copy-Item -LiteralPath $Target -Destination $Backup -Force
Copy-Item -LiteralPath $Replacement -Destination $Target -Force

$Applied = Get-Content -LiteralPath $Target -Raw
if (-not $Applied.Contains('MARKET_SIGNAL_SEPARATION_V1')) {
    Copy-Item -LiteralPath $Backup -Destination $Target -Force
    throw 'Post-apply verification failed. Original RecommendationsView.tsx was restored.'
}

Write-Host 'Market movement / data quality / technical recommendation separation applied.' -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Backup:  $Backup"
Write-Host 'Restart the app and open the market signals page.' -ForegroundColor Cyan
