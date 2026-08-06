@echo off
echo.
echo ==============================================
echo SCRIPT UPDATE OTOMATIS SYNCIN YEKA
echo (ANDROID & IOS BERSAMAAN)
echo ==============================================
echo.

REM GANTI TEKS DI BAWAH INI DENGAN TOKEN ASLI ANDA
set EXPO_TOKEN_ANDROID=PASTE_TOKEN_ROSYID99_DI_SINI
set EXPO_TOKEN_IOS=PASTE_TOKEN_ADMIN_YEKA_DI_SINI

REM Ambil pesan update dari input, atau gunakan default
set pesan=%~1
if "%pesan%"=="" set pesan="Update Fitur Terbaru"

node update-semua.js "%pesan%"

echo.
pause
