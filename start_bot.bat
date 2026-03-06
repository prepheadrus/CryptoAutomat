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

:: Ana python dosyasını arka planda başlat
echo [2/3] Fast_API Sunucusu ve Core Engine calistiriliyor...
start /B python main.py
echo [OK] Sunucu arka planda başlatıldı.
echo.

:: Sunucunun başlaması için bekle
echo [3/3] Sunucu hazirlaniyor (5 saniye)...
timeout /t 5 /nobreak >nul

:: Tarayıcıyı otomatik aç
echo [OK] Dashboard aciliyor...
start http://localhost:8000
echo.

echo ========================================================
echo        BOT CALISIYOR - Tarayici acildi!
echo        Kapatmak icin bu pencereyi kapatabilirsiniz
echo ========================================================
echo.

:: Pencereyi açık tut (kullanıcı kapatabilir)
pause
