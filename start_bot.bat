@echo off
title CryptoAlgoBot
color 0A

echo.
echo ==========================================
echo   CryptoAutomat - Windows Startup
echo ==========================================
echo.

REM Script dizinine git
cd /d %~dp0

REM Virtual Environment kontrolu
if not exist "venv\Scripts\python.exe" (
    echo [HATA] Virtual environment not found!
    echo [HATA] Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

echo [OK] Virtual environment detected.
echo.

REM .env kontrolu
if not exist ".env" (
    echo [UYARI] .env not found! Creating from template...
    copy .env.example .env >nul
    echo [OK] .env created. Please configure your API credentials!
    echo.
)

REM config.yaml kontrolu
if not exist "config.yaml" (
    echo [HATA] config.yaml not found!
    echo [HATA] Please copy config.example.yaml to config.yaml.
    pause
    exit /b 1
)

echo [OK] Configuration verified.
echo.
echo ==========================================
echo   Starting trading engine...
echo ==========================================
echo.
echo [INFO] Dashboard: http://localhost:3000
echo [INFO] Launching browser...
echo [INFO] To stop: Close this window or press CTRL+C
echo.

REM Botu arka planda baslat
start /B call venv\Scripts\activate.bat ^&^& python main.py

REM 5 saniye bekle (bot baslasin)
timeout /t 5 /nobreak >nul

REM Tarayiciyi ac
echo [OK] Opening Dashboard...
start http://localhost:3000

echo.
echo ==========================================
echo   Engine running...
echo ==========================================
echo.
echo NOTE: Keep this console window open!
echo     To stop, close this console or press CTRL+C.
echo.
pause
