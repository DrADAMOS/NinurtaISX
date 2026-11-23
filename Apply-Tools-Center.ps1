$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$required = @(
  'src\App.tsx',
  'src\components\Navigation.tsx',
  'src\components\ToolsCenterView.tsx',
  'src\components\InvestorIntelligenceView.tsx',
  'src\components\MarketIntelligenceView.tsx',
  'src\components\SahmiToolsView.tsx'
)
foreach ($path in $required) {
  if (-not (Test-Path (Join-Path $PSScriptRoot $path))) { throw "Patch file missing: $path" }
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backups\before-tools-center-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$files = @('src\App.tsx','src\components\Navigation.tsx')
foreach ($relative in $files) {
  $source = Join-Path $root $relative
  if (Test-Path $source) {
    $dest = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item $source $dest -Force
  }
}
foreach ($relative in $required) {
  $dest = Join-Path $root $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item (Join-Path $PSScriptRoot $relative) $dest -Force
}
Write-Host "Tools Center patch applied. Backup: $backup" -ForegroundColor Green
Write-Host 'Next: npm run lint; npm run build; npm test' -ForegroundColor Cyan
