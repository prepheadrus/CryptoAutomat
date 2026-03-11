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
echo [INFO] Endpoint: http://localhost:8000
echo.

:: Wait for server to start
echo [3/4] Sunucu hazirlaniyor (8 saniye)...
echo [INFO] Database connection, Event Bus, Bot Managers yukleniyor...
timeout /t 8 /nobreak >nul
echo.

:: Open dashboard in browser (separate process - won't close with terminal)
echo [4/4] Dashboard tarayicida aciliyor...
start "" "http://localhost:8000"
echo [OK] Dashboard acildi: http://localhost:8000
echo.

:: Show system info
echo ================================================================
echo                    SYSTEM STATUS
echo ================================================================
echo   FastAPI Server   : http://localhost:8000
echo   Dashboard        : http://localhost:8000
echo   API Docs         : http://localhost:8000/docs
echo   Event Tracer     : Aktif (Terminal loglarini izleyin)
echo   Architecture     : Event-Driven (Modular)
echo ================================================================
echo.
echo   OZELLIKLER:
echo   - Modern Dashboard UI (Glassmorphism Cards)
echo   - Sistem Ayarlari Sayfasi (Risk, WFO, ML, API)
echo   - Multi-Timeframe Analysis (HTF Altin Oran)
echo   - Event-Driven Architecture
echo   - Position Manager + Risk Engine
echo   - ML Model Integration (XGBoost + RF Ensemble)
echo   - Walk-Forward Optimization (WFO)
echo   - Auto-Grid Generator
echo   - Bayesian Optimization (Optuna)
echo   - 1-to-N Multi-Bot Architecture
echo   - Smart Hybrid Architecture
echo   - No-Code Strategy Builder
echo   - Fernet API Key Encryption
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
