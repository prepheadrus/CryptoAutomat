# 🚀 CryptoAutomat

![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)
![Architecture](https://img.shields.io/badge/Architecture-Event--Driven%20%7C%20Clean%20%7C%20DDD-purple.svg)
![Status](https://img.shields.io/badge/Status-Production--Ready-success.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**CryptoAutomat**, kripto para piyasalarında 7/24 kesintisiz çalışmak üzere tasarlanmış; çoklu zaman dilimi (MTF) analizi, makine öğrenimi tabanlı sinyal teyidi, gelişmiş dinamik risk yönetimi ve web tabanlı modern bir kontrol paneline (Dashboard) sahip, kurumsal düzeyde bir algoritmik ticaret motorudur.

---

## 🌟 Öne Çıkan Özellikler

- **⚡ Event-Driven & Modüler Mimari:** Domain-Driven Design (DDD) ve Clean Architecture prensipleriyle ayrıştırılmış çekirdek motor, bağımsız servisler ve asenkron Event Bus.
- **🛡️ Gelişmiş Risk & Sermaye Yönetimi:**
  - ATR tabanlı dinamik Stop-Loss ve Take-Profit (Trailing ATR Stop).
  - Devre kesici (**Circuit Breaker**) ve acil durum koruması (**Kill Switch**).
  - Volatiliteye ve ML güven skoruna göre dinamik pozisyon boyutlandırma (Dynamic Position Sizing).
- **🧠 Makine Öğrenimi Entegrasyonu (ML Engine):**
  - XGBoost ve k-NN destekli trend/momentum sinyal doğrulama.
  - Model Drift tespiti ve Walk-Forward Optimization (WFO) ile aşırı uyum (overfitting) engelleme.
- **📊 Çoklu Zaman Dilimi (MTF) Analizi:**
  - Üst zaman dilimlerindeki (HTF) ana trend doğrulanmadan alt zaman dilimlerinde ters işlem açılmasını engelleyen veto mekanizması.
- **🎛️ No-Code Strategy Builder & Strategy Lab:**
  - Web arayüzü üzerinden kod yazmadan indikatör ve mantıksal kurallarla strateji tasarlama, kaydetme ve anında backtest yapabilme.
- **🖥️ Canlı Web Dashboard:**
  - Gerçek zamanlı TradingView Lightweight Charts entegrasyonu.
  - Açık pozisyonlar, emir defteri, bakiye dağılımı ve performans metrikleri takibi.
- **💾 Yüksek Performanslı Veri Mimarisi:**
  - Parquet Data Lake & Superalgos tabanlı yerel veri saklama ve SQLite ACID işlem geçmişi.

---

## 🏗️ Sistem Mimarisi

```
CryptoAutomat/
├── api/                  # FastAPI Web API (Routers, Schemas, Services)
│   ├── routers/          # Endpoint yönlendiricileri (bot, data, ml, strategy, trades)
│   ├── schemas/          # Pydantic veri modelleri
│   └── services/         # İş mantığı servisleri
├── core/                 # Çekirdek Trading Motoru
│   ├── bot/              # Bot yaşam döngüsü yöneticisi
│   ├── diagnostics/      # Olay izleme ve sistem teşhisleri
│   ├── risk/             # Dinamik risk motoru ve kural seti
│   ├── trading/          # Pozisyon ve emir yöneticisi
│   ├── exchange.py       # Borsa (Binance CCXT) asenkron adaptörü
│   ├── paper.py          # Paper Trading (Simülasyon) motoru
│   └── wfo_engine.py     # Walk-Forward Optimization motoru
├── data/                 # Veri Katmanı
│   ├── indicators/       # Teknik indikatör kütüphanesi (Trend, Momentum, Volatilite)
│   ├── storage/          # Parquet Data Lake depolama motoru
│   └── database.py       # Veritabanı yöneticisi
├── frontend/             # Web Arayüzü (HTML5, Vanilla JS, CSS3, Charts)
├── ml/                   # Makine Öğrenimi Pipeline (Eğitim, Çıkarım, Drift)
├── models/               # Model tanımları (XGBoost, k-NN)
├── strategy/             # Ticaret Stratejileri ve No-Code Builder
├── tests/                # Otomatize Birim ve E2E Test Paketi
├── config.example.yaml   # Örnek yapılandırma dosyası
└── main.py               # Uygulama ana giriş noktası
```

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- **Python 3.10+**
- **Git**
- *(İsteğe bağlı)* Canlı işlem için Binance API anahtarları

### 1. Kurulum

```bash
# Repoyu klonlayın
git clone https://github.com/prepheadrus/CryptoAutomat.git
cd CryptoAutomat

# Sanal ortam oluşturun ve aktif edin
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt
```

### 2. Yapılandırma

Örnek yapılandırma dosyasını kopyalayın:
```bash
cp config.example.yaml config.yaml
cp .env.example .env
```
`.env` ve `config.yaml` dosyalarını kendi tercihlerinize göre düzenleyin. *(Varsayılan olarak güvenli simülasyon/paper trading modundadır).*

### 3. Çalıştırma

```bash
# Bot motorunu ve web arayüzünü başlatın
python main.py
```

Tarayıcınızdan **`http://localhost:8000`** adresine giderek Dashboard'a erişebilirsiniz.

---

## 🧪 Testleri Çalıştırma

Test paketini çalıştırmak için:

```bash
# Test gereksinimlerini yükleyin
pip install -r requirements-test.txt

# Testleri çalıştırın
pytest tests/ -v
# veya
python run_tests.py
```

---

## 🔒 Güvenlik

- API anahtarları `.env` dosyasında yerel olarak **Fernet (AES-128-CBC)** şifrelemesi ile korunur.
- `.secret.key`, `.env` ve veritabanı dosyaları git takibinden otomatik olarak dışlanmıştır.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında lisanslanmıştır.
