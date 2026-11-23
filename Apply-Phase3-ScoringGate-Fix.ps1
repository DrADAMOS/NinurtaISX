$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
if (-not (Test-Path (Join-Path $Project 'package.json'))) { throw "Run from Ninurta-Current project root." }
$Files = @(
  @{ Source='patchfiles\src\utils\bankScoring.ts'; Target='src\utils\bankScoring.ts' },
  @{ Source='patchfiles\tests\bankScoring.test.ts'; Target='tests\bankScoring.test.ts' }
)
foreach($f in $Files){
  $src=Join-Path $PSScriptRoot $f.Source
  $dst=Join-Path $Project $f.Target
  if(-not(Test-Path $src)){throw "Missing $src"}
  New-Item -ItemType Directory -Path (Split-Path $dst) -Force | Out-Null
  if(Test-Path $dst){
    $backup="$dst.bak-phase3fix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $dst -Destination $backup
    Write-Host "Backup: $backup"
  }
  Copy-Item -LiteralPath $src -Destination $dst -Force
}
$NodeDir='D:\Program Files\nodejs'
if(Test-Path "$NodeDir\node.exe"){$env:Path="$NodeDir;$env:Path"}
Write-Host "`n[1/3] Tests..."
npm.cmd test
if($LASTEXITCODE -ne 0){throw "Tests failed."}
Write-Host "`n[2/3] TypeScript..."
npm.cmd run lint
if($LASTEXITCODE -ne 0){throw "TypeScript failed."}
Write-Host "`n[3/3] Build..."
npm.cmd run build
if($LASTEXITCODE -ne 0){throw "Build failed."}
Write-Host "`nPHASE 3 SCORING GATE PASSED." -ForegroundColor Green
