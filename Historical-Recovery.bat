@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Ninurta - Historical Data Recovery
if not exist "scripts\fetch-csd-bulletins.py" (
 echo Historical recovery tools are missing.
 pause
 exit /b 1
)
echo ======================================================
echo NINURTA - OFFICIAL HISTORICAL DATA RECOVERY
echo ======================================================
echo 1. Download official CSD daily reports (current archive)
echo 2. Import a verified official OHLCV CSV
echo 3. Open the source archive folder
echo 0. Exit
echo.
set /p choice=Choose: 
if "%choice%"=="1" goto FETCH
if "%choice%"=="2" goto IMPORT
if "%choice%"=="3" goto OPEN
exit /b 0
:FETCH
py -3 scripts\fetch-csd-bulletins.py --archive auto --pages 20
if errorlevel 1 echo Download failed. Check internet connection.
echo.
echo IMPORTANT: downloaded PDFs are source records only. No stock prices were changed.
explorer "%~dp0public\historical-sources\csd"
pause
exit /b
:IMPORT
set /p csv=Full path to official CSV file: 
set /p url=Official source URL (ISX/CSD/ISC/Rabee): 
set /p name=Source name: 
py -3 scripts\import-official-history.py "%csv%" --source-url "%url%" --source-name "%name%" --confirm-official-source --dry-run
if errorlevel 1 goto DONE
 echo.
 echo Review the dry-run above. To commit, run the same command without --dry-run.
:DONE
pause
exit /b
:OPEN
if not exist "public\historical-sources\csd" mkdir "public\historical-sources\csd"
explorer "%~dp0public\historical-sources\csd"
exit /b
