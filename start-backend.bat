@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo Starting Backend on http://127.0.0.1:8003 ...
if exist "%~dp0backend\venv\Scripts\python.exe" (
  "%~dp0backend\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
) else (
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
)
pause
