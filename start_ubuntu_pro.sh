#!/bin/bash
set -e # Hata durumunda betiği durdur

# ============================================================================
# CRYPTO ALGO BOT - UBUNTU STARTUP SCRIPT (PRO ENHANCED)
# 7/24 Production-Ready Bot Launcher
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# İşletim sistemi RAM aşımı vb durumlarında uygulamanın çökmesini önlemek için bellek serbest bırakma mekanizması
export MALLOC_ARENA_MAX=2

# Script directory (Güvenli Dizin Çözümleme)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_header() { echo -e "\n${WHITE}========================================${NC}\n${WHITE}$1${NC}\n${WHITE}========================================${NC}\n"; }

# STEP 1: Directory check
log_header "STEP 1: Project Directory"
if [ ! -f "main.py" ]; then
    log_error "main.py not found! Betik doğru dizinde çalıştırılmıyor olabilir."
    exit 1
fi
log_success "Project directory verified"

# STEP 2: Git Update & Stash Protection
log_header "STEP 2: Git Update"
if [ -d ".git" ]; then
    log_info "Yerel değişiklikler korunarak (stash) güncelleme yapılıyor..."
    # Local değişiklikleri (config.yaml vb) koruma altına alıp güncel kodu çekiyoruz
    git stash -q || true
    git pull origin main --rebase
    git stash pop -q || true
    log_success "Repository updated seamlessly"
else
    log_warning "Not a git repository, skipping update"
fi

# STEP 3: Virtual Environment (Robust Method)
log_header "STEP 3: Virtual Environment"
if [ ! -d "venv" ]; then
    log_info "Creating virtual environment..."
    python3 -m venv venv
    log_success "Virtual environment created"
fi
# source kullanmak yerine doğrudan binary path'i kullanacağız
PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
PIP_BIN="$SCRIPT_DIR/venv/bin/pip"
log_success "Virtual environment paths verified"

# STEP 4: Dependencies
log_header "STEP 4: Dependencies"
$PIP_BIN install --upgrade pip wheel --quiet
if [ -f "requirements.txt" ]; then
    $PIP_BIN install -r requirements.txt --quiet
    log_success "Dependencies installed/verified"
else
    log_warning "requirements.txt not found!"
fi

# STEP 5: Cache Cleanup
log_header "STEP 5: Cache Cleanup"
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
log_success "Python cache cleaned"

# STEP 6: Config Files
log_header "STEP 6: Configuration"
if [ ! -f "config.yaml" ]; then
    cp config.yaml.example config.yaml 2>/dev/null || true
    log_warning "Created default config.yaml"
fi
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || true
    log_warning "Created default .env file"
fi
log_success "Configuration verified"

# STEP 7: Database Check
log_header "STEP 7: Database Health"
if [ -f "cryptobot.db" ]; then
    DB_STATUS=$($PYTHON_BIN -c "import sqlite3; c=sqlite3.connect('cryptobot.db'); print('DB OK' if c.execute('PRAGMA integrity_check').fetchone()[0]=='ok' else 'DB FAILED')" 2>/dev/null || echo "DB ERROR")
    if [[ "$DB_STATUS" == "DB OK" ]]; then
        log_success "Database integrity check passed"
    else
        log_warning "Database check returned issues: $DB_STATUS"
    fi
else
    log_info "New database will be created on startup"
fi

# STEP 8: System Check
log_header "STEP 8: System Requirements"
log_info "Python: $($PYTHON_BIN --version 2>&1)"
# Linux'a özel komutlar
if command -v free >/dev/null 2>&1; then
    log_info "RAM: $(free -m | awk '/^Mem:/{print $7}')MB available"
fi
if command -v df >/dev/null 2>&1; then
    log_info "Disk: $(df -h . | awk 'NR==2{print $4}') available"
fi

# STEP 9: Start Bot (With Exec)
log_header "STEP 9: Starting Bot"
log_info "Dashboard: http://localhost:8000"
log_info "Press CTRL+C to stop"
log_info "Pro Tip: Run inside 'tmux' or 'screen' to keep it alive after ssh disconnect"

# Display hatasını engelle (Headless Linux Server için)
export DISPLAY=""

# 'exec' komutu bash kabuğunu python prosesiyle değiştirir. RAM tasarrufu sağlar ve sinyalleri (CTRL+C) direkt olarak bota iletir.
exec $PYTHON_BIN main.py
