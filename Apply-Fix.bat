@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply-Fix.ps1"
if errorlevel 1 (
  echo.
  echo FIX FAILED. Read the error above.
) else (
  echo.
  echo FIX APPLIED.
)
pause
