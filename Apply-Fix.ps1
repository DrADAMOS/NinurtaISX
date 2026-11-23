$ErrorActionPreference = 'Stop'

# Find the project root even when this repair folder is nested inside it.
$ProjectRoot = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
while ($ProjectRoot -and
       (-not (Test-Path (Join-Path $ProjectRoot 'package.json')) -or
        -not (Test-Path (Join-Path $ProjectRoot 'src\data\stocks.json')))) {
    $Parent = Split-Path -Parent $ProjectRoot
    if (-not $Parent -or $Parent -eq $ProjectRoot) {
        $ProjectRoot = $null
        break
    }
    $ProjectRoot = $Parent
}

if (-not $ProjectRoot) {
    throw 'Project root not found. Extract this repair folder inside Ninurta-Current.'
}

$Target = Join-Path $ProjectRoot 'vite.config.ts'
$Fixed = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'vite.config.fixed.ts'

if (-not (Test-Path $Target)) {
    throw 'vite.config.ts was not found in the project root.'
}
if (-not (Test-Path $Fixed)) {
    throw 'vite.config.fixed.ts is missing. Extract the complete ZIP first.'
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $ProjectRoot 'backups'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Backup = Join-Path $BackupDir "vite.config.ts.before-local-origin-fix-$Stamp"
Copy-Item -LiteralPath $Target -Destination $Backup -Force

Copy-Item -LiteralPath $Fixed -Destination $Target -Force

Write-Host ''
Write-Host 'Local update fix applied.' -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Backup:  $Backup"
Write-Host 'Restart the development server, then try Update Prices.' -ForegroundColor Cyan
