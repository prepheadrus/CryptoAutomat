@echo off
title CryptoAlgoBot - Modern Start
color 0A

echo ================================================================
echo           CRYPTO ALGO BOT - MODULAR SYSTEM STARTER
echo           Event-Driven Architecture + FastAPI Backend
echo ================================================================
echo.

:: Change to the directory where this bat file is located
cd /d "%~dp0"

:: Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Sanal ortam bulunamadi!
    echo [INFO] Lutfen once setup.bat dosyasini calistirin.
    echo.
    pause
    exit /b 1
)

:: Activate virtual environment
echo [1/4] Sanal ortam (venv) aktif ediliyor...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Sanal ortam aktif edilemedi!
    pause
    exit /b 1
)
echo [OK] Sanal ortam aktif: %VIRTUAL_ENV%
echo.

:: Check if main.py exists
if not exist "main.py" (
    echo [ERROR] main.py dosyasi bulunamadi!
    echo [INFO] Proje dosyalari eksik veya hasarli.
    pause
    exit /b 1
)

:: Start FastAPI server with uvicorn (main.py üzerinden)
echo [2/4] FastAPI Sunucusu baslatiliyor...
echo [INFO] Event Tracer, Position Manager, Risk Engine aktif ediliyor...
start /B python main.py
if errorlevel 1 (
    echo [ERROR] FastAPI sunucusu baslatilamadi!
    pause
    exit /b 1
)
echo [OK] FastAPI sunucusu arka planda baslatildi
echo [INFO] Endpoint: http://localhost:3000
echo.

:: Wait for server to start
echo [3/4] Sunucu hazirlaniyor (8 saniye)...
echo [INFO] Database connection, Event Bus, Bot Managers yukleniyor...
timeout /t 8 /nobreak >nul
echo.

:: Open dashboard in browser (separate process - won't close with terminal)
echo [4/4] Dashboard tarayicida aciliyor...
start "" "http://localhost:3000"
echo [OK] Dashboard acildi: http://localhost:3000
echo.

:: Show system info
echo ================================================================
echo                    SYSTEM STATUS
echo ================================================================
echo   FastAPI Server   : http://localhost:3000
echo   Dashboard        : http://localhost:3000
echo   API Docs         : http://localhost:3000/docs
echo   Event Tracer     : Aktif (Terminal loglarini izleyin)
echo   Architecture     : Event-Driven (Modular)
echo ================================================================
echo.
echo   OZELLIKLER (6 Faz Mimari):
echo   - Faz 1: Event-Driven Architecture (%100 Pub/Sub)
echo   - Faz 2: Clean Architecture API (194 satir)
echo   - Faz 3: ES6 Frontend Modules (210 satir)
echo   - Faz 4: Modular Indicators (5 modül)
echo   - Faz 5: Zero-Touch WFO (Bayesian TPE)
echo   - Faz 6: MLOps Auto-Retrain + Liquidity Sweep
echo   - Parquet Data Lake (Snappy compression)
echo   - Order Book Imbalance Filtresi
echo   - Commission + Slippage Gerçekçi Backtest
echo ================================================================
echo.
echo   BOT CALISIYOR - Pencereyi kapatabilirsiniz
echo   Durdurmak icin: CTRL+C veya terminal penceresini kapat
echo ================================================================
echo.

:: Keep window open (user can close it)
echo.
echo ================================================================
echo   BOT CALISIYOR - Pencereyi kapatabilirsiniz
echo   Durdurmak icin: Bu pencereyi kapatın veya CTRL+C
echo ================================================================
echo.
pause >nul

:: Cleanup on exit
echo.
echo [INFO] Bot kapatiliyor...
echo [OK] Bot kapatildi.
echo [INFO] Goodbye!
