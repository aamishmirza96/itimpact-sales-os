@echo off
echo Starting Sales OS Dashboard...
echo.
echo Once you see "VITE ready" - open your browser and go to:
echo.
echo    http://localhost:3001
echo.
echo Do NOT close this window while using the dashboard.
echo.
cd /d "%~dp0"
npm run dev
pause
