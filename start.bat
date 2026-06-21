@echo off

chcp 65001 >nul

echo ========================================
echo   US Technical Signals - Start All
echo ========================================
echo.

REM Kill stale processes on our ports (ignore errors)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8003.*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo [1/3] Starting Backend on http://127.0.0.1:8003 ...

start "Backend :8003" cmd /k "%~dp0start-backend.bat"

echo [2/3] Waiting for backend (health + Paper Trading API)...

set /a tries=0

:wait_backend

timeout /t 2 /nobreak >nul

powershell -NoProfile -Command "try { $h=(Invoke-WebRequest -Uri 'http://127.0.0.1:8003/api/v1/health' -UseBasicParsing -TimeoutSec 3).StatusCode; $p=(Invoke-WebRequest -Uri 'http://127.0.0.1:8003/api/v1/portfolio' -UseBasicParsing -TimeoutSec 3).StatusCode; if ($h -eq 200 -and $p -eq 200) { 1 } else { 0 } } catch { 0 }" | findstr "1" >nul

if %errorlevel%==0 goto backend_ok

set /a tries+=1

if %tries% lss 20 goto wait_backend

echo WARNING: Backend may not be ready yet — continue anyway

:backend_ok

echo [3/3] Starting Frontend on http://127.0.0.1:5173 ...

start "Frontend :5173" cmd /k "%~dp0start-frontend.bat"

timeout /t 4 /nobreak >nul

echo.
echo Backend:  http://127.0.0.1:8003
echo Frontend: http://127.0.0.1:5173
echo.
echo เปิดเบราว์เซอร์...

start http://127.0.0.1:5173
