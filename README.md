# 🚀 Kripto Algoritmik Ticaret Botu (Crypto Algo Bot)

Kripto para piyasalarında, 7/24 dinamik risk yönetimi, makine öğrenimi destekli fiyat tahminlemesi ve on-chain/makroekonomik veri sentezi ile yüksek başarı oranlı bir algoritmik ticaret sistemi projesi.

## 📚 Dokümantasyon

Detaylı teknik dokümantasyon için **[Knowledge Base](knowledge/INDEX.md)** klasörüne bakın.

- [🏗️ Sistem Mimarisi](knowledge/architecture/overview.md)
- [📈 Stratejiler](knowledge/strategies/concept_and_implementation.md)
- [⚙️ Trading Engine](knowledge/trading_engine/paper_trader.md)
- [🎨 Dashboard](knowledge/frontend/dashboard_and_visualization.md)
- [📋 Yol Haritası](knowledge/planning/roadmap.md)

## ⚡ Hızlı Başlangıç

### 1. Depoyu Klonla

```bash
git clone https://github.com/prepheadrus/Crypto_Automat.git
cd Crypto_Automat
```

### 2. Otomatik Kurulum

**Ubuntu/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows:**
```cmd
setup.bat
```

### 3. Yapılandırma (Opsiyonel)

**.env dosyası** (API anahtarları için):
```bash
nano .env  # Linux
notepad .env  # Windows
```

**config.yaml** (Trading ayarları için):
```bash
nano config.yaml  # Linux
notepad config.yaml  # Windows
```

### 4. Botu Başlat

**Ubuntu/Linux:**
```bash
source venv/bin/activate
python3 main.py
```

**Windows:**
```cmd
venv\Scripts\activate
python main.py
```

### 5. Dashboard'a Eriş

Tarayıcınızda şu adresi açın:
- **Local:** http://localhost:8000
- **Oracle Cloud:** http://<SUNUCU_IP>:8000

> ⚠️ **Oracle Cloud Kullanıcıları:** Security List'te **8000 portunu** açmayı unutmayın!

---

## Temel Özellikler
*   **Gösterge Konfluansı:** Trend, Momentum, Volatilite, Hacim ve Likidite göstergelerinin birleşimiyle onaylı alım/satım sinyalleri.
*   **Makine Öğrenimi Füzyonu (CFA):** LSTM, Transformers, XGBoost birleşimi ve Meta-Reinforcement Learning optimizasyonları.
*   **Gelişmiş Veri Etiketleme:** Triple Barrier Method (Üçlü Bariyer) ve Fractional Differentiation (Kesirli Fark Alma).
*   **Adaptif Risk Yönetimi:** Dinamik pozisyon büyüklüğü hesaplama (maks %1-%2 risk), Trailing Stop ve kademeli kar alımı.
*   **Asenkron Mimari:** CCXT, Websocket ve `asyncio` ile düşük gecikmeli, yüksek frekanslı çalışma.
*   **Etkinlik Odaklı Karar:** Makro verilerin takvimi (CPI, Fed), balina transferleri, ve pazar sentimentine göre dinamik kalkan mekanizmaları.
