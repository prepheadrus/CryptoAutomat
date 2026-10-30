@echo off
title CryptoAutomat
color 0A

echo.
echo ==========================================
echo   CryptoAutomat - Windows Startup
echo ==========================================
echo.

REM Navigate to script directory
cd /d %~dp0

REM Virtual Environment check
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found!
    echo [ERROR] Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

echo [OK] Virtual environment detected.
echo.

REM .env check
if not exist ".env" (
    echo [WARN] .env not found! Creating from template...
    copy .env.example .env >nul
    echo [OK] .env created. Please configure your API credentials!
    echo.
)

REM config.yaml check
if not exist "config.yaml" (
    echo [ERROR] config.yaml not found!
    echo [ERROR] Please copy config.example.yaml to config.yaml.
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
echo [INFO] To stop: Close this window or press CTRL+C
echo.

REM Launch bot in background
start /B call venv\Scripts\activate.bat ^&^& python main.py

REM Wait until server is listening on port 3000 (prevents ERR_CONNECTION_REFUSED)
echo [INFO] Waiting for server to become ready...
venv\Scripts\python.exe -c "import socket, time; [time.sleep(0.5) for _ in range(60) if socket.socket().connect_ex(('127.0.0.1', 3000)) != 0]"
timeout /t 1 /nobreak >nul

REM Launch browser
echo [OK] Server ready! Opening Dashboard...
start http://localhost:3000

echo.
echo ==========================================
echo   Engine running...
echo ==========================================
echo.
echo NOTE: Keep this console window open!
echo       To stop, close this console or press CTRL+C.
echo.
pause