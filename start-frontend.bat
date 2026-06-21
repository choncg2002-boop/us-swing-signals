@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
echo Starting Frontend on http://127.0.0.1:5173 ...
call npm run dev
pause
