@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Push ขึ้น GitHub
echo ========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ติดตั้ง Git ก่อน: https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] ยังไม่มี git repo — รัน setup-github.bat ก่อน
  pause
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo ตั้ง remote origin...
  git remote add origin https://github.com/choncg2002-boop/us-swing-signals.git
)

echo กำลัง push ไป GitHub...
git push -u origin main

if errorlevel 1 (
  echo.
  echo ========================================
  echo   Push ไม่สำเร็จ — ทำขั้นตอนนี้ก่อน:
  echo ========================================
  echo   1. สร้าง repo ที่ https://github.com/new
  echo      ชื่อ: us-swing-signals
  echo      อย่าติ๊ก Add README
  echo   2. รันไฟล์นี้อีกครั้ง
  echo.
  echo   หรือใช้ GitHub Desktop กด Publish repository
  echo ========================================
  pause
  exit /b 1
)

echo.
echo สำเร็จ! เปิดดูที่:
echo https://github.com/choncg2002-boop/us-swing-signals
echo.
pause
