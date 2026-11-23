@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-local-update.ps1"
echo.
echo Manual market update finished. Review logs folder if needed.
pause
