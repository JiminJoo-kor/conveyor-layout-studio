@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start-cad-bridge.ps1"
pause
