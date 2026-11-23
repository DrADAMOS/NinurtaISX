@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Ninurta ISX - Personal Launcher
cd /d "%~dp0"
set "PROJECT_DIR=%~dp0"
set "NODE_EXE="
for /f "delims=" %%P in ('where.exe node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%P"
if not defined NODE_EXE for %%D in ("%ProgramFiles%\nodejs" "%LOCALAPPDATA%\Programs\nodejs" "D:\Program Files\nodejs" "D:\Program Files\Node.js") do if exist "%%~D\node.exe" if not defined NODE_EXE set "NODE_EXE=%%~D\node.exe"
if not defined NODE_EXE (
  echo Node.js LTS is not installed. Trying winget...
  where.exe winget.exe >nul 2>&1
  if not errorlevel 1 winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
  for /f "delims=" %%P in ('where.exe node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%P"
)
if not defined NODE_EXE goto NONODE
for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "PATH=%NODE_DIR%;%PATH%"
if not exist "%NODE_DIR%npm.cmd" goto NONPM
echo [1/4] Checking and installing dependencies...
if not exist "node_modules\vite\bin\vite.js" (
  call "%NODE_DIR%npm.cmd" install --no-audit --no-fund
  if errorlevel 1 goto NPMFAIL
)
echo [2/4] Updating public market quotes...
if exist "scripts\run-local-update.ps1" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\run-local-update.ps1"
echo [3/4] Starting local application...
echo [4/4] Browser will open at http://127.0.0.1:3000
echo Keep this window open while using Ninurta.
call "%NODE_DIR%npm.cmd" run dev -- --host 127.0.0.1 --port 3000 --open
if errorlevel 1 goto STARTFAIL
goto END
:NONODE
echo ERROR: Node.js could not be found. Install Node.js LTS from https://nodejs.org/ then run again.
pause
goto END
:NONPM
echo ERROR: npm.cmd is missing beside Node.js. Repair Node.js installation.
pause
goto END
:NPMFAIL
echo ERROR: Dependency installation failed. Check internet connection and npm logs.
pause
goto END
:STARTFAIL
echo ERROR: Application failed to start. Review the message above.
pause
:END
endlocal
