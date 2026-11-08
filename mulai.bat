@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Unduh versi LTS di https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b 1
)
if not exist node_modules\ws (
  echo Memasang komponen yang dibutuhkan, sekali saja...
  call npm install --omit=dev
)
node server\index.js
pause
