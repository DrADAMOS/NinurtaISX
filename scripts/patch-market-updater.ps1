$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Updater = Join-Path $ProjectRoot 'scripts\update-market-data-public.py'
if (-not (Test-Path $Updater)) { throw "Updater not found: $Updater" }

$source = [System.IO.File]::ReadAllText($Updater, [System.Text.Encoding]::UTF8)
$pattern = '(?m)^(    if newest and session_date < newest:\r?\n        raise RuntimeError\(f".*?"\)\r?\n)'
$found = [regex]::Matches($source, $pattern)
if ($found.Count -ne 1) {
    throw "Expected exactly one stored-session rollback guard; found $($found.Count). No file changed."
}
$insert = $found[0].Value + @'
    if newest and session_date == newest:
        print(f"No new market session: source session {session_date} is already stored. Existing files were not changed.")
        return

'@
$patched = $source.Remove($found[0].Index, $found[0].Length).Insert($found[0].Index, $insert)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $ProjectRoot "backups\before-session-guard-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $Updater $backup
[System.IO.File]::WriteAllText($Updater, $patched, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updater patched. Backup: $backup" -ForegroundColor Green
