@echo off
cd /d "%~dp0"
echo.
echo ==============================================
echo SCRIPT UPDATE OTOMATIS SYNCIN YEKA
echo (ANDROID ^& IOS BERSAMAAN)
echo ==============================================
echo.

REM GANTI TEKS DI BAWAH INI DENGAN TOKEN ASLI ANDA
set EXPO_TOKEN_ANDROID=IggkbxvZzfKk0i1wh7BRTXvJ0aOPWXYIantsC_Zc
set EXPO_TOKEN_IOS=vb_vPYzPpvTllVzzFmQ2ZjGkKgevkI58XTDazbJu

REM Ambil pesan update dari input, atau gunakan default
set "pesan=%~1"
if "%pesan%"=="" set "pesan=Update Akurasi GPS & Anti-Duplikat"

node update-semua.js "%pesan%"

echo.
pause
