$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

# Resolve Node.js/npm even when the current PowerShell session has no PATH entry.
$nodeCandidates = @(
  'D:\Program Files\nodejs',
  (Join-Path $env:ProgramFiles 'nodejs'),
  'C:\Program Files\nodejs'
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'node.exe')) -and (Test-Path (Join-Path $_ 'npm.cmd')) }
$nodeDir = $nodeCandidates | Select-Object -First 1
if (-not $nodeDir) {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($nodeCommand -and $npmCommand) {
    $nodeDir = Split-Path $nodeCommand.Source -Parent
  }
}
if (-not $nodeDir) {
  throw 'Node.js/npm not found. Install Node.js or add its folder to PATH. Checked D:\Program Files\nodejs and standard Program Files locations.'
}
$env:PATH = "$nodeDir;$env:PATH"
$nodeExe = Join-Path $nodeDir 'node.exe'
$npmCmd = Join-Path $nodeDir 'npm.cmd'
if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
  throw "Node.js/npm executable missing from: $nodeDir"
}
Write-Host "Node.js: $(& $nodeExe --version)"
Write-Host "npm: $(& $npmCmd --version)"

$patchRoot = Join-Path $PSScriptRoot 'patchfiles'
$targets = @(
  'src/components/RabeeStatementPanel.tsx',
  'src/components/Navigation.tsx',
  'tests/arabicTerminology.test.ts'
)
Write-Host '=============================================='
Write-Host ' NINURTA ISX PRO - PHASE 9 ARABIC TERMINOLOGY'
Write-Host '=============================================='
foreach ($target in $targets) {
  if (-not (Test-Path (Join-Path $patchRoot $target))) { throw "Patch file missing: $target" }
  if (-not (Test-Path (Join-Path $root (Split-Path $target -Parent)))) { throw "Target directory missing: $target" }
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backups\phase9-arabic-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$installed = @()
try {
  foreach ($target in $targets) {
    $destination = Join-Path $root $target
    if (Test-Path $destination) {
      $backupFile = Join-Path $backup $target
      New-Item -ItemType Directory -Force -Path (Split-Path $backupFile -Parent) | Out-Null
      Copy-Item $destination $backupFile -Force
    }
    Copy-Item (Join-Path $patchRoot $target) $destination -Force
    $installed += $target
  }
  Write-Host "Backup: $backup"
  Write-Host '[1/3] JavaScript and Python tests...'
  Remove-Item (Join-Path $PSScriptRoot 'patchfiles') -Recurse -Force
  & $npmCmd test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed with exit code $LASTEXITCODE" }
  Write-Host '[2/3] TypeScript validation...'
  & $npmCmd run lint
  if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE" }
  Write-Host '[3/3] Production build...'
  & $npmCmd run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }
  Write-Host 'PHASE 9 ARABIC TERMINOLOGY PASSED.'
  Write-Host "Backup: $backup"
}
catch {
  Write-Host 'FAILED: Restoring original files...'
  foreach ($target in $installed) {
    $backupFile = Join-Path $backup $target
    $destination = Join-Path $root $target
    if (Test-Path $backupFile) { Copy-Item $backupFile $destination -Force }
    elseif (Test-Path $destination) { Remove-Item $destination -Force }
  }
  throw
}
