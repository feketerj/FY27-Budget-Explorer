@echo off
echo Stopping FY27 Budget Explorer...
taskkill /fi "windowtitle eq FY27-Budget-Server" /f >nul 2>&1
taskkill /fi "imagename eq python.exe" /fi "windowtitle eq FY27-Budget-Server" /f >nul 2>&1
:: Fallback: kill by port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8427 ^| findstr LISTENING') do taskkill /pid %%p /f >nul 2>&1
echo Done.
