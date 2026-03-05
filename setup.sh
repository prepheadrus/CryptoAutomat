#!/bin/bash

# ==============================================================================
# CryptoAlgoBot - Otomatik Kurulum Betiği (Ubuntu 20.04/22.04)
# ==============================================================================
# Bu betik, Oracle Cloud Ubuntu üzerinde CryptoAlgoBot'u otomatik kurar.
# Kullanım: chmod +x setup.sh && ./setup.sh
# ==============================================================================

set -e  # Hata durumunda dur

echo ""
echo "=========================================="
echo "  CryptoAlgoBot Kurulum Betiği"
echo "  Ubuntu 20.04/22.04"
echo "=========================================="
echo ""

# Renkli çıktı fonksiyonları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Root kontrolü
if [ "$EUID" -eq 0 ]; then 
    log_error "Lütfen bu betiği root olarak çalıştırmayın!"
    log_info "Normal kullanıcı olarak çalıştırın (sudo gerekirse betik içinde kullanılacak)"
    exit 1
fi

# 1. Sistem Paketlerini Güncelle
log_info "Adım 1/8: Sistem paketleri güncelleniyor..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Python ve Gerekli Sistem Bağımlılıklarını Kur
log_info "Adım 2/8: Python 3 ve sistem bağımlılıkları kuruluyor..."
sudo apt-get install -y python3 python3-pip python3-venv python3-dev build-essential git curl wget

# Python versiyon kontrolü
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
log_info "Python versiyonu: $PYTHON_VERSION"

if (( $(echo "$PYTHON_VERSION < 3.8" | bc -l) )); then
    log_error "Python 3.8+ gerekli! Mevcut versiyon: $PYTHON_VERSION"
    exit 1
fi

# 3. Sanal Ortam (Virtual Environment) Oluşturma
log_info "Adım 3/8: Python sanal ortamı oluşturuluyor..."
if [ -d "venv" ]; then
    log_warn "venv klasörü zaten mevcut, atlanıyor..."
else
    python3 -m venv venv
    log_info "venv klasörü oluşturuldu."
fi

# 4. Kütüphaneleri (Bağımlılıkları) Yükle
log_info "Adım 4/8: Python kütüphaneleri yükleniyor (requirements.txt)..."
source venv/bin/activate

# Pip'i güncelle
pip install --upgrade pip

# Requirements yükle
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    log_info "Tüm Python kütüphaneleri başarıyla yüklendi!"
else
    log_error "requirements.txt dosyası bulunamadı!"
    exit 1
fi

# 5. .env Dosyası Kontrolü
log_info "Adım 5/8: .env dosyası kontrol ediliyor..."
if [ ! -f ".env" ]; then
    log_warn ".env dosyası bulunamadı!"
    if [ -f ".env.example" ]; then
        log_info ".env.example dosyasından .env oluşturuluyor..."
        cp .env.example .env
        log_warn ".env dosyası oluşturuldu. Lütfen BINANCE_API_KEY ve BINANCE_API_SECRET değerlerini düzenleyin!"
    else
        log_warn ".env.example de bulunamadı. API anahtarları için .env dosyası oluşturmanız gerekiyor."
    fi
else
    log_info ".env dosyası mevcut."
fi

# 6. Config.yaml Kontrolü
log_info "Adım 6/8: config.yaml kontrol ediliyor..."
if [ ! -f "config.yaml" ]; then
    log_error "config.yaml dosyası bulunamadı!"
    exit 1
fi

# 7. Gerekli Klasörleri Oluştur
log_info "Adım 7/8: Gerekli klasörler oluşturuluyor..."
mkdir -p artifacts/trained_models
mkdir -p data
log_info "Klasörler hazır."

# 8. Kurulum Tamamlandı
log_info "Adım 8/8: Kurulum tamamlandı!"
echo ""
echo "=========================================="
echo "  ✅ Kurulum Başarıyla Tamamlandı!"
echo "=========================================="
echo ""
echo "📌 Sonraki Adımlar:"
echo ""
echo "1. .env dosyasını düzenleyin (API anahtarları opsiyonel):"
echo "   nano .env"
echo ""
echo "2. config.yaml dosyasını düzenleyin (isteğe bağlı):"
echo "   nano config.yaml"
echo ""
echo "3. Botu başlatın:"
echo "   source venv/bin/activate"
echo "   python3 main.py"
echo ""
echo "4. Tarayıcıdan dashboard'a erişin:"
echo "   http://<SUNUCU_IP>:8000"
echo ""
echo "=========================================="
echo ""
log_info "Oracle Cloud kullanıyorsanız, Security List'te 8000 portunu açmayı unutmayın!"
echo ""

# Virtual environment aktivasyon hatırlatması
cat << 'EOF'
┌─────────────────────────────────────────────────────────────┐
│  HIZLI BAŞLANGIÇ KOMUTLARI:                                 │
├─────────────────────────────────────────────────────────────┤
│  Sanal ortamı aktif et:  source venv/bin/activate           │
│  Botu başlat:          python3 main.py                      │
│  Botu durdur:          CTRL+C                               │
│  Sanal ortamı kapat:   deactivate                           │
└─────────────────────────────────────────────────────────────┘

EOF
