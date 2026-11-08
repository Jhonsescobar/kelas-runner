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
if exist cloudflared.exe (
  for %%A in (cloudflared.exe) do if %%~zA LSS 1000000 del cloudflared.exe
)
if not exist cloudflared.exe (
  where cloudflared >nul 2>nul
  if errorlevel 1 (
    echo Mengunduh cloudflared, sekali saja ^(sekitar 40 MB^)...
    curl.exe -fL -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    for %%A in (cloudflared.exe) do if %%~zA LSS 1000000 del cloudflared.exe
    if not exist cloudflared.exe (
      echo.
      echo Unduhan gagal atau diblokir jaringan. Pilih salah satu:
      echo  1. Buka CMD lalu ketik:  winget install Cloudflare.cloudflared   ^(lalu jalankan online.bat lagi^)
      echo  2. Unduh manual cloudflared-windows-amd64.exe dari github.com/cloudflare/cloudflared/releases,
      echo     ganti namanya jadi cloudflared.exe, taruh di folder ini.
      echo  3. Coba ganti jaringan ^(hotspot HP^) lalu jalankan lagi.
      pause
      exit /b 1
    )
  )
)
set KR_ONLINE=1
node server\index.js
pause
