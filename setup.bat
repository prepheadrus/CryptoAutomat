@echo off
REM ==============================================================================
REM CryptoAlgoBot - Automated Setup Script (Windows 10/11)
REM ==============================================================================
REM This script automatically installs CryptoAlgoBot on Windows.
REM Usage: Double click setup.bat or run via cmd.
REM ==============================================================================

echo.
echo ==========================================
echo   CryptoAlgoBot Setup Script
echo   Windows 10/11
echo ==========================================
echo.

REM 1. Python version check
echo [INFO] Checking Python version...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+.
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

python --version
echo.

REM 2. Virtual Environment Creation
echo [INFO] Creating Python virtual environment...
if exist "venv\" (
    echo [WARN] venv folder already exists, skipping...
) else (
    python -m venv venv
    echo [INFO] venv folder created.
)
echo.

REM 3. Activate Virtual Environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

REM 4. Upgrade Pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

REM 5. Install Dependencies
echo [INFO] Installing Python dependencies (requirements.txt)...
if exist "requirements.txt" (
    pip install -r requirements.txt
    echo [INFO] All Python dependencies installed successfully!
) else (
    echo [ERROR] requirements.txt file not found!
    pause
    exit /b 1
)
echo.

REM 6. .env File Check
echo [INFO] Checking .env file...
if not exist ".env" (
    echo [WARN] .env file not found!
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env
        echo [WARN] .env created. Please configure BINANCE_API_KEY and BINANCE_API_SECRET if needed!
    ) else (
        echo [WARN] .env.example not found either. Please create a .env file for API credentials.
    )
) else (
    echo [INFO] .env file verified.
)
echo.

REM 7. Config.yaml Check
echo [INFO] Checking config.yaml...
if not exist "config.yaml" (
    echo [ERROR] config.yaml not found!
    pause
    exit /b 1
)
echo.

REM 8. Create Necessary Directories
echo [INFO] Creating required directories...
if not exist "artifacts\trained_models" mkdir artifacts\trained_models
if not exist "data" mkdir data
echo [INFO] Directories ready.
echo.

REM 9. Setup Complete
echo ==========================================
echo   Setup Completed Successfully!
echo ==========================================
echo.
echo Next Steps:
echo.
echo 1. Edit .env file (API credentials optional for paper trading):
echo    notepad .env
echo.
echo 2. Edit config.yaml (optional):
echo    notepad config.yaml
echo.
echo 3. Start bot:
echo    venv\Scripts\activate
echo    python main.py
echo.
echo 4. Access dashboard from browser:
echo    http://localhost:3000
echo    Swagger Docs: http://localhost:3000/docs
echo    Health Check: http://localhost:3000/api/v1/health
echo.
echo ==========================================
echo.
pause
