@echo off
chcp 65001 >nul
echo ========================================
echo   เตรียม Push ขึ้น GitHub สำหรับ Render
echo ========================================
echo.

cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ติดตั้ง Git ก่อน: https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo สร้าง git repo ในโฟลเดอร์นี้...
  git init
  git add .
  git commit -m "US Swing Signals — production ready"
  git branch -M main
) else (
  echo git repo มีอยู่แล้ว
  git add .
  git status -sb
)

echo.
echo ========================================
echo   ขั้นต่อไป (ทำด้วยตัวเอง):
echo ========================================
echo   1. สร้าง repo ใหม่ที่ https://github.com/new
echo   2. รันคำสั่งนี้ (แก้ URL ให้ตรง repo ของคุณ):
echo.
echo      git remote add origin https://github.com/USER/us-swing-signals.git
echo      git push -u origin main
echo.
echo   3. ไป Render.com ^> New ^> Blueprint ^> เลือก repo
echo   4. ได้ URL ถาวร เช่น https://us-swing-signals.onrender.com
echo.
echo   ดูรายละเอียดใน DEPLOY.md
echo ========================================
pause
