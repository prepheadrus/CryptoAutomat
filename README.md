# 🚀 CryptoAlgoBot - Production-Ready Cryptocurrency Trading Bot

**Version:** v4.1.0 (Production-Ready)  
**Status:** ✅ 14/14 E2E Tests Passed  
**Architecture:** Event-Driven + Clean Architecture + DDD

Kripto para piyasalarında, 7/24 dinamik risk yönetimi, makine öğrenimi destekli fiyat tahminlemesi ve çoklu zaman dilimi analizi ile yüksek başarı oranlı bir algoritmik ticaret sistemi.

## 📚 Dokümantasyon

Detaylı teknik dokümantasyon için **[Knowledge Base](knowledge/INDEX.md)** klasörüne bakın.

### **Quick Links:**
- [🏗️ Sistem Mimarisi](knowledge/architecture/overview.md)
- [🛡️ Circuit Breaker](knowledge/features/circuit_breaker.md)
- [🛑 Graceful Shutdown](knowledge/features/graceful_shutdown.md)
- [📝 Structured Logging](knowledge/features/structured_logging.md)
- [🧠 ML Overfitting Protection](knowledge/features/ml_overfitting_protection.md)
- [🏥 Health Check](knowledge/features/health_check_endpoint.md)
- [⚙️ Configuration Guide](knowledge/developer_reference/configuration_guide.md)
- [🚀 Deployment Guide](knowledge/workflows/deployment_guide.md)
- [📡 API Reference](knowledge/developer_reference/api_reference.md)

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

### 3. Yapılandırma

**.env dosyası** (API anahtarları için):
```bash
cp .env.example .env
nano .env  # Linux
notepad .env  # Windows
```

**config.yaml** (Trading ayarları için):
```bash
cp config.example.yaml config.yaml
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
- **Local:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/docs
- **Health Check:** http://localhost:3000/api/v1/health

---

## 🔥 v4.1.0 Yeni Özellikler

### **Reliability & Fault Tolerance**
- ✅ **Circuit Breaker Pattern:** API çağrıları için otomatik hata izolasyonu
- ✅ **Graceful Shutdown:** 7 adımlı güvenli kapatma
- ✅ **Database Retry:** Locked hatalarında otomatik tekrar deneme

### **Observability**
- ✅ **Structured Logging:** JSON + renkli konsol loglama
- ✅ **Health Check Endpoint:** Prometheus/Grafana entegrasyonu
- ✅ **Event Bus Monitoring:** Worker health tracking

### **ML Improvements**
- ✅ **Overfitting Protection:** Veri boyutuna göre 4 mod (Complex/Medium/Simple/Ultra-Simple)
- ✅ **Auto-Regularization:** L1 + L2 regularization otomatik ayarı

### **Bug Fixes**
- ✅ **Trade History Tab Switch:** Otomatik veri yükleme
- ✅ **Balance Fix Utility:** Negative balance sorunu için diagnostic tool
- ✅ **Kill Switch Config:** Hot-reload desteği

---

## 🔧 Teknik Özellikler

### **Core Architecture**
- ✅ **Event-Driven:** Pub/Sub pattern (40+ event type)
- ✅ **Clean Architecture:** Routers → Services → Schemas
- ✅ **DDD:** Value Objects, Entities, Aggregates

### **Machine Learning**
- ✅ **Ensemble Model:** XGBoost + Random Forest
- ✅ **Triple Barrier Method:** Marcos Lopez de Prado
- ✅ **Auto-Regularization:** 4-mode overfitting protection

### **Data Layer**
- ✅ **Parquet Data Lake:** MTF-Daily partition
- ✅ **Snappy Compression:** %70-80 boyut azaltma
- ✅ **Async I/O:** Non-blocking operations

### **Risk Management**
- ✅ **Dynamic Position Sizing:** Risk-based calculation
- ✅ **Dynamic Leverage:** ML confidence-based
- ✅ **Kill Switch:** Ardışık kayıp koruması
- ✅ **ATR Trailing Stop:** Dinamik stop loss

### **Indicators**
- ✅ **Trend:** EMA, SMA, Kalman Filter, Supertrend
- ✅ **Momentum:** RSI, MACD, Stochastic, UO
- ✅ **Volatility:** ATR, Bollinger Bands, BTC VIX
- ✅ **Volume:** OBV, VWAP, PVI, NVI, Koncorde

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| **Bot Launch** | <1 second |
| **Poller Launch** | <100ms |
| **ML Training** | 30-60s (10K candles) |
| **WFO Optimization** | 5-10 min (50 trials) |
| **API Response** | <50ms |
| **Event Processing** | <10ms |
| **E2E Tests** | 14/14 passed |

---

## 🚀 Deployment

### **Supported Platforms**
- ✅ Windows 10/11
- ✅ Ubuntu 20.04/22.04 LTS
- ✅ Oracle Cloud Free Tier
- ✅ AWS EC2
- ✅ DigitalOcean Droplet

### **Quick Deploy**

**Ubuntu:**
```bash
./setup.sh
sudo systemctl start cryptoalgobot
sudo systemctl status cryptoalgobot
```

**Windows:**
```cmd
setup.bat
python main.py
```

**Docker:**
```bash
docker-compose up -d
```

Detaylı kurulum için: **[Deployment Guide](knowledge/workflows/deployment_guide.md)**

---

## 📈 Features

### **Trading Strategies**
- ✅ TrendMaster Pro (Trend following)
- ✅ Scalper Ninja (Fast scalping)
- ✅ Golden Combo (Multi-indicator confluence)
- ✅ Adaptive Koncorde X (Custom indicators)
- ✅ Divergence Hunter (Divergence detection)
- ✅ KNN Quant ATR (KNN-based)
- ✅ Custom Strategies (No-code builder)

### **Multi-Bot Support**
- ✅ 1-to-N Bot Architecture
- ✅ Independent bot instances
- ✅ Symbol-specific strategies
- ✅ Parallel processing

### **Dashboard Features**
- ✅ Real-time portfolio tracking
- ✅ Active positions management
- ✅ Trade history with filters
- ✅ ML model training UI
- ✅ Strategy builder (no-code)
- ✅ Data laboratory
- ✅ System settings (hot-reload)

---

## 🔍 Monitoring

### **Health Check**
```bash
curl http://localhost:3000/api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "components": {
    "event_bus": "running",
    "database": "connected",
    "exchange": "connected"
  },
  "metrics": {
    "active_bots": 5,
    "uptime_hours": 24.5
  }
}
```

### **Logs**

**Development:**
```
15:30:45 | INFO     | Bot started
15:30:46 | DEBUG    | Loading config...
```

**Production (JSON):**
```json
{"timestamp": "2026-03-22T15:30:45", "level": "INFO", "message": "Bot started", "module": "main"}
```

---

## 🧪 Testing

```bash
# Run E2E tests
python -m pytest tests/ -v

# Run specific test
python -m pytest tests/test_double_close.py -v

# Run all tests with coverage
python -m pytest tests/ --cov=. --cov-report=html
```

**Test Results:** ✅ 14/14 passed

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 📞 Support

- **Documentation:** [Knowledge Base](knowledge/INDEX.md)
- **Issues:** [GitHub Issues](https://github.com/prepheadrus/Crypto_Automat/issues)
- **Discussions:** [GitHub Discussions](https://github.com/prepheadrus/Crypto_Automat/discussions)

---

## 🎯 Roadmap

### **Q2 2026**
- [ ] Multi-exchange support (Kucoin, OKX)
- [ ] Advanced order types (OCO, Bracket)
- [ ] Telegram/Discord notifications
- [ ] Mobile app (React Native)

### **Q3 2026**
- [ ] Backtesting engine improvements
- [ ] Strategy marketplace
- [ ] Social trading features
- [ ] Advanced analytics

---

**Last Updated:** March 2026  
**Version:** v4.1.0  
**Status:** Production Ready ✅
