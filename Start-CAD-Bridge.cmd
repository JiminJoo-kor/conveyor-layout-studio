@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start-cad-bridge.ps1"
if errorlevel 1 (
  echo Setup or connection failed. See the message above.
  echo Check your network or contact your administrator if company policy blocks scripts.
  echo No security settings have been changed.
)
pause
