$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
$LogDir = Join-Path $ProjectRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("update-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $LogFile -Force | Out-Null
try {
    $today = (Get-Date).ToString('yyyy-MM-dd')
    $statusPath = Join-Path $ProjectRoot 'src\data\data-status.json'
    $stocksPath = Join-Path $ProjectRoot 'src\data\stocks.json'

    if (Test-Path $statusPath) {
        $status = Get-Content $statusPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($status.status -eq 'updated_quote_snapshot_only' -and $status.marketSessionDate -eq $today) {
            Write-Host "Today's session $today is already updated. Skipping retry."
            return
        }
    }

    if (-not (Test-Path $stocksPath)) { throw "Stocks file not found: $stocksPath" }
    $beforeWrite = (Get-Item $stocksPath).LastWriteTimeUtc
    $env:PYTHONUTF8 = '1'
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        & py.exe -3.13 (Join-Path $PSScriptRoot 'update-market-data-public.py')
    } else {
        & python (Join-Path $PSScriptRoot 'update-market-data-public.py')
    }
    if ($LASTEXITCODE -ne 0) { throw "Market-data updater failed with exit code $LASTEXITCODE" }

    $afterWrite = (Get-Item $stocksPath).LastWriteTimeUtc
    if ($afterWrite -eq $beforeWrite) {
        Write-Host 'No new session was published. Existing market data remains unchanged; a later retry may run.'
        return
    }

    $nodePath = 'D:\Program Files\nodejs'
    if (Test-Path $nodePath) { $env:Path = "$nodePath;$env:Path" }
    $npm = Join-Path $nodePath 'npm.cmd'
    if (-not (Test-Path $npm)) { throw "npm.cmd not found: $npm" }
    & $npm run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE" }
    Write-Host 'Ninurta market data update and production build completed.' -ForegroundColor Green
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Stop-Transcript | Out-Null
}
