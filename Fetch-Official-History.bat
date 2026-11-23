@echo off
setlocal
cd /d "%~dp0"
title Ninurta - Download Official ISX History
if not exist "scripts\fetch-csd-bulletins.py" (
  echo ERROR: scripts\fetch-csd-bulletins.py was not found.
  pause
  exit /b 1
)
where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3.11 or newer, then try again.
    pause
    exit /b 1
  )
  python "scripts\fetch-csd-bulletins.py" --kind all --archive exchange-news --pages 20
) else (
  py -3 "scripts\fetch-csd-bulletins.py" --kind all --archive exchange-news --pages 20
)
echo.
echo Source files are saved under public\historical-sources\csd
 echo No stock prices were imported or modified.
pause
