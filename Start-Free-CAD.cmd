@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the local simulator.
  pause
  exit /b 1
)
set "DWG_CONVERSION=1"
set "HOST=127.0.0.1"
set "PORT=4173"
echo Open http://127.0.0.1:4173/ and choose CAD import.
node scripts/serve.mjs
pause
