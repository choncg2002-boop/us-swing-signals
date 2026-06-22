@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Deploy Frontend ไป Netlify
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ติดตั้ง Node.js ก่อน: https://nodejs.org/
  pause
  exit /b 1
)

echo [1/3] Push โค้ดขึ้น GitHub (ถ้ายังไม่ push)...
git push origin main 2>nul

echo.
echo [2/3] Build frontend...
cd frontend
call npm ci
if errorlevel 1 (
  echo [ERROR] npm ci ล้มเหลว
  pause
  exit /b 1
)

if not "%VITE_API_BASE_URL%"=="" (
  echo ใช้ API: %VITE_API_BASE_URL%
) else (
  echo.
  echo [NOTE] ยังไม่ตั้ง VITE_API_BASE_URL — ตั้งก่อน build ถ้ามี Render backend แล้ว:
  echo   set VITE_API_BASE_URL=https://us-swing-api-xxxx.onrender.com
  echo   set VITE_WS_BASE_URL=wss://us-swing-api-xxxx.onrender.com
  echo.
)

call npm run build
if errorlevel 1 (
  echo [ERROR] build ล้มเหลว
  pause
  exit /b 1
)
cd ..

echo.
echo [3/3] เปิด Netlify — เชื่อม GitHub repo...
echo   หรือ deploy ด้วย CLI: npx netlify deploy --prod --dir=frontend/dist
echo.
start https://app.netlify.com/start

echo ========================================
echo   บน Netlify กดตามนี้:
echo ========================================
echo   1. Import from GitHub ^> us-swing-signals
echo   2. Deploy settings ใช้จาก netlify.toml อัตโนมัติ
echo   3. Environment variables:
echo        VITE_API_BASE_URL = URL จาก Render
echo        VITE_WS_BASE_URL  = wss://... จาก Render
echo   4. Deploy site
echo ========================================
pause
