@echo off
REM ==============================================================================
REM CryptoAlgoBot - Windows Başlatma Scripti
REM ==============================================================================
REM Bu script botu başlatır ve dashboard'u tarayıcıda açar.
REM Kullanım: start_bot.bat dosyasına çift tıklayın
REM ==============================================================================

echo.
echo ==========================================
echo   CryptoAlgoBot Başlatılıyor...
echo ==========================================
echo.

REM 1. Script dizinine git
cd /d %~dp0

REM 2. Python ve Virtual Environment kontrolü
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment bulunamadi!
    echo [ERROR] Lutfen once setup.bat dosyasini calistirin.
    echo.
    pause
    exit /b 1
)

echo [OK] Virtual environment bulundu.
echo.

REM 3. Virtual Environment'i aktif et (sessiz)
call venv\Scripts\activate.bat

REM 4. .env dosyasi kontrolu
if not exist ".env" (
    echo [WARNING] .env dosyasi bulunamadi!
    echo [WARNING] API anahtarlari olmadan bot calismayabilir.
    echo [INFO] .env.example dosyasindan .env olusturuluyor...
    copy .env.example .env >nul
    echo [INFO] .env dosyasi olusturuldu. Lutfen API anahtarlarini duzenleyin!
    echo.
)

REM 5. config.yaml kontrolu
if not exist "config.yaml" (
    echo [ERROR] config.yaml dosyasi bulunamadi!
    echo [ERROR] Lutfen config.example.yaml dosyasini config.yaml olarak kopyalayin.
    pause
    exit /b 1
)

echo [OK] Yapilandirma dosyalari bulundu.
echo.

REM 6. Botu baslat
echo ==========================================
echo   Bot baslatiliyor...
echo ==========================================
echo.
echo [INFO] Dashboard: http://localhost:3000
echo [INFO] Durdurmak icin: CTRL+C veya pencereyi kapat
echo.
echo ==========================================
echo.

REM Python main.py'i calistir
python main.py

REM Bot kapandiginda
echo.
echo ==========================================
echo   Bot durduruldu.
echo ==========================================
echo.
pause
