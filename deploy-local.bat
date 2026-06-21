@echo off
chcp 65001 >nul
echo ========================================
echo   US Swing Signals - Deploy บนเครื่องนี้
echo   (ใช้ได้จากมือถือ/เครื่องอื่นใน WiFi เดียวกัน)
echo ========================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ต้องติดตั้ง Docker Desktop ก่อน
  echo ดาวน์โหลด: https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

echo กำลัง build และ start...
docker compose up --build -d
if errorlevel 1 (
  echo [ERROR] docker compose ล้มเหลว
  pause
  exit /b 1
)

echo.
echo รอให้ backend พร้อม...
timeout /t 8 /nobreak >nul

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } | Select-Object -First 1).IPAddress"') do set LOCAL_IP=%%i

echo.
echo ========================================
echo   เปิดได้แล้ว!
echo ========================================
echo   บนเครื่องนี้:     http://localhost
echo   จากมือถือ/เครื่องอื่น: http://%LOCAL_IP%
echo.
echo   หยุด: docker compose down
echo ========================================
echo.

start http://localhost
pause
