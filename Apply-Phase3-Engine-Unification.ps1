$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
if (-not (Test-Path (Join-Path $Project 'package.json'))) {
    throw "package.json not found. Run this script from Ninurta-Current."
}
$Files = @(
    @{ Source = 'src\utils\bankScoring.ts'; Target = 'src\utils\bankScoring.ts' },
    @{ Source = 'src\banks\fundamentalEngine.ts'; Target = 'src\banks\fundamentalEngine.ts' },
    @{ Source = 'tests\fundamentalEngine.test.ts'; Target = 'tests\fundamentalEngine.test.ts' }
)
foreach ($File in $Files) {
    $Source = Join-Path $PSScriptRoot ("patchfiles\" + $File.Source)
    $Target = Join-Path $Project $File.Target
    if (-not (Test-Path $Source)) { throw "Missing patch file: $Source" }
    New-Item -ItemType Directory -Path (Split-Path $Target) -Force | Out-Null
    if (Test-Path $Target) {
        $Backup = "$Target.bak-phase3-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item -LiteralPath $Target -Destination $Backup
        Write-Host "Backup: $Backup"
    }
    Copy-Item -LiteralPath $Source -Destination $Target -Force
}
Write-Host "Phase 3 files installed." -ForegroundColor Green

$NodeDir = 'D:\Program Files\nodejs'
if (Test-Path "$NodeDir\node.exe") { $env:Path = "$NodeDir;$env:Path" }

Write-Host "`n[1/3] Full tests..."
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Tests failed." }

Write-Host "`n[2/3] TypeScript..."
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }

Write-Host "`n[3/3] Production build..."
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

Write-Host "`nPHASE 3 CHECKS PASSED." -ForegroundColor Green
