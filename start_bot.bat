@echo off
title CryptoAlgoBot Baslatici
color 0A

echo ========================================================
echo        CRYPTO ALGO BOT BASLATILIYOR...
echo        Lutfen bu pencereyi acik birakin! (Botun Motoru)
echo ========================================================
echo.

:: Botun bulunduğu klasöre (bat dosyasının olduğu yere) git
cd /d "%~dp0"

:: Sanal ortamı (venv) aktive et
echo [1/3] Sanal ortam (venv) aktif ediliyor...
call venv\Scripts\activate.bat
echo [OK] Ortam aktif.
echo.

:: Kısa bir bekleme (opsiyonel)
timeout /t 2 /nobreak >nul

:: Ana python dosyasını çalıştır
echo [2/3] Fast_API Sunucusu ve Core Engine calistiriliyor...
echo.
python main.py

:: Sunucu başladıktan sonra tarayıcıyı aç (3 saniye bekle)
timeout /t 3 /nobreak >nul
echo [3/3] Arayuz (Dashboard) tarayicida aciliyor...
start http://localhost:8000
echo.

:: Hata durumunda pencerenin hemen kapanmasını önlemek için duraklat
pause
