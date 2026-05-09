@echo off
title FY27 Budget Explorer
echo Starting FY27 Budget Explorer...
echo.

cd /d "%~dp0"

:: Start the server in the background
start "FY27-Budget-Server" /min python frontend\serve.py

:: Wait for server to be ready
timeout /t 2 /nobreak >nul

:: Open the browser
start http://127.0.0.1:8427

echo Server running at http://127.0.0.1:8427
echo Run stop.bat to shut down.
