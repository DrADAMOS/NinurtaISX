$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot 'run-local-update.ps1'
$Updater = Join-Path $PSScriptRoot 'update-market-data-public.py'
$TaskName = 'Ninurta ISX Personal Market Update'

foreach ($path in @($Runner, $Updater, (Join-Path $ProjectRoot 'src\data\stocks.json'), (Join-Path $ProjectRoot 'src\data\data-status.json'))) {
    if (-not (Test-Path $path)) { throw "Required project file missing: $path" }
}

$user = [System.Security.SecurityElement]::Escape([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$runnerXml = [System.Security.SecurityElement]::Escape($Runner)
$rootXml = [System.Security.SecurityElement]::Escape($ProjectRoot)
$powerShell = [System.Security.SecurityElement]::Escape((Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'))
# StartBoundary is deliberately one week in the past so installing after 4 PM
# does not postpone the first eligible weekday until the following week.
$start = (Get-Date).Date.AddDays(-7).AddHours(16).ToString("yyyy-MM-dd'T'HH:mm:ss")

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Ninurta ISX updater: Sunday-Thursday, 4 PM to 9 PM, retry every 30 minutes.</Description></RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>$start</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition><Interval>PT30M</Interval><Duration>PT5H</Duration><StopAtDurationEnd>true</StopAtDurationEnd></Repetition>
      <ScheduleByWeek><DaysOfWeek><Sunday/><Monday/><Tuesday/><Wednesday/><Thursday/></DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek>
    </CalendarTrigger>
  </Triggers>
  <Principals><Principal id="Author"><UserId>$user</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <ExecutionTimeLimit>PT25M</ExecutionTimeLimit>
    <Enabled>true</Enabled><Hidden>false</Hidden><WakeToRun>false</WakeToRun><Priority>7</Priority>
  </Settings>
  <Actions Context="Author"><Exec><Command>$powerShell</Command><Arguments>-NoProfile -ExecutionPolicy Bypass -File "$runnerXml"</Arguments><WorkingDirectory>$rootXml</WorkingDirectory></Exec></Actions>
</Task>
"@

$tempXml = Join-Path $env:TEMP 'Ninurta-Isx-ScheduledTask.xml'
[System.IO.File]::WriteAllText($tempXml, $xml, [System.Text.Encoding]::Unicode)
try {
    & schtasks.exe /Create /TN $TaskName /XML $tempXml /F
    if ($LASTEXITCODE -ne 0) { throw "schtasks.exe failed with exit code $LASTEXITCODE" }
} finally {
    Remove-Item $tempXml -Force -ErrorAction SilentlyContinue
}
Write-Host "Updated scheduled task: $TaskName" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Sunday-Thursday, 4:00 PM; repeat every 30 minutes through 9:00 PM Baghdad time."
Write-Host "Requires the Windows account to be logged in and the PC to be powered on."
