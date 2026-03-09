# 📚 CryptoAlgoBot Bilgi Bankası (Knowledge Base)

Bu klasör, CryptoAlgoBot projesinin tüm teknik dokümantasyonunu, stratejilerini, mimari kararlarını ve planlama belgelerini içerir.

**Son Güncelleme:** Mart 2026  
**Durum:** ✅ Aktif Geliştirme

---

## 📁 Klasör Yapısı

```
knowledge/
├── architecture/          # Sistem mimarisi ve veri akışı
│   ├── overview.md       # 5 katmanlı mimari genel bakış
│   ├── data_pipeline.md  # Veri boru hattı ve özellik mühendisliği
│   └── 1-to-N-multi-bot-architecture.md  # Çoklu bot mimarisi (YENİ!)
│
├── strategies/           # Trading stratejileri ve algoritmalar
│   └── concept_and_implementation.md  # Strateji konseptleri ve tasarım
│
├── trading_engine/       # İşlem motoru ve risk yönetimi
│   └── paper_trader.md   # Sanal işlem modülü detayları
│
├── frontend/             # Kullanıcı arayüzü ve görselleştirme
│   └── dashboard_and_visualization.md  # Dashboard tasarım ilkeleri
│
├── planning/             # Proje planlama ve yol haritası
│   ├── roadmap.md        # Aşamalı geliştirme planı
│   ├── tech_stack.md     # Teknoloji yığını ve araçlar
│   └── tasks.md          # Görev takibi ve öncelikler
│
├── features/             # Özellik dokümantasyonu
│   ├── no_code_strategy_builder.md  # No-Code Strateji Oluşturucu
│   ├── strategy_builder_guide.md    # Strateji Oluşturucu Kılavuzu
│   ├── ATR_TRAILING_STOP_SYSTEM.md  # ATR Trailing Stop Sistemi
│   ├── walk_forward_optimization.md  # WFO (Walk-Forward Optimization)
│   ├── auto_grid_generator.md        # Auto-Grid Generator
│   └── bayesian_optimization.md      # Bayesian Optimization (Optuna)
│
└── documentation/        # Genel dokümantasyon
    ├── session_history.md  # Geliştirme oturum geçmişi
    ├── ai_skill.md         # AI asistan yetenek tanımlaması
    ├── technical_improvements.md  # Teknik iyileştirmeler
    └── RECENT_IMPROVEMENTS.md  # Son iyileştirmeler (Mart 2026)
```

---

## 🆕 Yeni Eklenenler (Mart 2026)

### **HTF Altın Oran (Multi-Timeframe Analysis)**
- **Dosya:** `features/htf_golden_ratio.md`
- **Açıklama:** Dinamik çoklu zaman dilimi analizi + EMA Stack
- **Özellikler:**
  - Altın Oran (1:4 / 1:6) dinamik haritalama
  - 2 seviyeli HTF analizi (Minor + Major)
  - EMA Stack trend tespiti (EMA 20 vs EMA 50)
  - Major HTF veto yetkisi
  - Çoklu HTF onay mekanizması
  - Config tabanlı dinamik mapping

### **Smart Hybrid Architecture**
- **Dosya:** `architecture/smart-hybrid-architecture.md`
- **Açıklama:** Local DB + REST Pagination + WSS Push
- **Özellikler:**
  - Local DB First (0 REST çağrısı)
  - Sınırsız Pagination (gap fill)
  - RAM koruması (tail 1500)
  - Yeni Mum Kilidi (%98 CPU tasarrufu)
  - WebSocket Push (0 polling)

### **1-to-N Multi-Bot Architecture**
- **Dosya:** `architecture/1-to-N-multi-bot-architecture.md`
- **Açıklama:** Merkezi dinleyici, dağıtık işleyici mimarisi
- **Özellikler:**
  - Aynı sembolde sınırsız bot çalıştırma
  - Rate limit koruması (1 API çağrısı/sembol)
  - Paralel bot işleme (asyncio.gather)
  - Hata izolasyonu (bir bot çökerse diğerleri çalışır)
  - Bot bazında pozisyon/PnL izolasyonu

### **WFO (Walk-Forward Optimization)**
- **Dosya:** `features/walk_forward_optimization.md`
- **Açıklama:** Otonom parametre optimizasyonu
- **Özellikler:**
  - In-Sample / Out-of-Sample pencereler
  - Rolling window optimizasyon
  - Haftalık otomatik re-optimizasyon

### **Auto-Grid Generator**
- **Dosya:** `features/auto_grid_generator.md`
- **Açıklama:** Otomatik parametre ızgarası oluşturma
- **Özellikler:**
  - Python stratejileri için introspection
  - %30 esnetme ile 3'lü arama uzayları
  - No-Code stratejiler için auto-mapping
  - 40+ indikatör desteği

### **Bayesian Optimization**
- **Dosya:** `features/bayesian_optimization.md`
- **Açıklama:** Optuna ile 100x hızlı optimizasyon
- **Özellikler:**
  - TPE (Tree-structured Parzen Estimator)
  - 2000+ kombinasyonu 50 denemede bul
  - %97-99 doğruluk (Grid Search'e göre)

### **HTF Altın Oran (Multi-Timeframe Analysis)**
- **Dosya:** `features/htf_golden_ratio.md` (YENİ!)
- **Açıklama:** Dinamik çoklu zaman dilimi analizi + EMA Stack
- **Özellikler:**
  - Altın Oran (1:4 / 1:6) dinamik haritalama
  - 2 seviyeli HTF analizi (Minor + Major)
  - EMA Stack trend tespiti (EMA 20 vs EMA 50)
  - Major HTF veto yetkisi
  - Çoklu HTF onay mekanizması (bull/bear count)
  - Config tabanlı dinamik mapping

---

## 🔍 Hızlı Erişim

| Konu | Dosya |
|------|-------|
| **Smart Hybrid** | `architecture/smart-hybrid-architecture.md` |
| **1-to-N Bot Mimarisi** | `architecture/1-to-N-multi-bot-architecture.md` |
| Sistem Mimarisi | `architecture/overview.md` |
| Veri Pipeline | `architecture/data_pipeline.md` |
| Strateji Ekleme | `strategies/concept_and_implementation.md` |
| Paper Trading | `trading_engine/paper_trader.md` |
| Dashboard UI | `frontend/dashboard_and_visualization.md` |
| Yol Haritası | `planning/roadmap.md` |
| Teknolojiler | `planning/tech_stack.md` |
| Görevler | `planning/tasks.md` |
| **WFO** | `features/walk_forward_optimization.md` |
| **Auto-Grid** | `features/auto_grid_generator.md` |
| **Bayesian Opt.** | `features/bayesian_optimization.md` |
| **HTF Altın Oran** | `features/htf_golden_ratio.md` |
| No-Code Strateji | `features/no_code_strategy_builder.md` |
| Strateji Oluşturucu | `features/strategy_builder_guide.md` |
| ATR Trailing Stop | `features/ATR_TRAILING_STOP_SYSTEM.md` |
| Son Geliştirmeler | `documentation/RECENT_IMPROVEMENTS.md` |
| Oturum Geçmişi | `documentation/session_history.md` |
| AI Skill | `documentation/ai_skill.md` |
| Teknik İyileştirmeler | `documentation/technical_improvements.md` |

---

## 📊 Mimari Katmanlar

```
┌─────────────────────────────────────────────────────────┐
│ 1. Frontend (Dashboard)                                 │
│    - Bot Yönetimi UI                                    │
│    - ML Model Eğitimi                                   │
│    - Strateji Oluşturucu                                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 2. API Layer (FastAPI)                                  │
│    - /api/v1/bot/* (Bot yönetimi)                       │
│    - /api/v1/ml/* (ML eğitim)                           │
│    - /api/v1/strategy/* (Strateji yönetimi)             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Core Engine                                          │
│    - ExchangeManager (Merkezi poller)                   │
│    - PaperTrader (Bot yönetimi)                         │
│    - 1-to-N Broadcast Mimarisi                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Strategy & ML                                        │
│    - StrategyManager (Strateji fabrikası)               │
│    - ML Model Training (XGBoost + RF Ensemble)          │
│    - WFO (Walk-Forward Optimization)                    │
│    - Auto-Grid Generator                                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Data Layer                                           │
│    - Database Manager (SQLite/PostgreSQL)               │
│    - Data Indicators (Teknik indikatörler)              │
│    - Feature Engineering                                │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Başlangıç Kılavuzu

### 1. Kurulum

```bash
# Bağımlılıkları yükle
pip install -r requirements.txt

# Veritabanını başlat
python migrate_db.py

# Botu başlat
python main.py
```

### 2. Bot Başlatma

1. Dashboard'u aç: `http://localhost:8000`
2. **Ayarlar** sekmesine git
3. **Çoklu Bot Yönetimi** formunu doldur:
   - Sembol: BTC/USDT:USDT
   - Strateji: TrendMaster Pro
   - Timeframe: 1h
   - Market: Futures
4. **▶ Bot Başlat** tıkla

### 3. ML Model Eğitimi

1. **ML Karar Motoru** sekmesine git
2. **ML Model Eğitimi** formunu doldur:
   - Sembol: BTC/USDT:USDT
   - Timeframe: 1h
   - Mum Sayısı: 10000
3. **🚀 Modeli Eğit** tıkla
4. Eğitim bitince model otomatik yüklenir

### 4. WFO (Otonom Optimizasyon)

1. `config.yaml` içinde WFO aktif et:
   ```yaml
   wfo:
     enabled: true
     train_days: 30
     test_days: 7
     reoptimize_interval: 168  # 1 hafta
   ```
2. Bot başlatıldığında WFO otomatik başlar
3. Haftada 1 kez otomatik re-optimizasyon yapar

---

## 📈 Performans Metrikleri

| Metrik | Değer | Açıklama |
|--------|-------|----------|
| **Bot Başlatma** | <1 saniye | API'den bot başlatma |
| **Poller Başlatma** | <100ms | Merkezi poller başlatma |
| **Bot İşleme** | max(bot_süreleri) | Paralel işleme sayesinde |
| **ML Eğitim** | 30-60 saniye | 10,000 mum için |
| **WFO Optimizasyon** | 5-10 dakika | 50 trial Bayesian Opt. |
| **API Çağrıları** | 1/sembol | Rate limit koruması |

---

## 🔧 Sorun Giderme

### Bot Çalışmıyor

**Sorun:** Bot başlatıldı ama işlem açmıyor

**Çözüm:**
1. Terminal loglarını kontrol et
2. `active_bots` dict'e eklendi mi kontrol et
3. Poller başlatıldı mı kontrol et:
   ```
   🚀 [POLLER] BTC/USDT:USDT için run_strategy_poller başlatılıyor...
   ✅ [POLLER] BTC/USDT:USDT poller başlatıldı
   ```

### Strateji Bulunamadı

**Sorun:** `⚠️ {bot_id} için strateji bulunamadı`

**Çözüm:**
1. API'de strateji instance'ı oluşturuldu mu kontrol et
2. `paper_engine.strategies[symbol]` kaydedildi mi kontrol et
3. Logları kontrol et:
   ```
   📚 [STRATEGY] BTC/USDT:USDT için trend_master instance'ı kaydedildi
   ```

### ML Model Yüklenemedi

**Sorun:** `❌ ML modeli yüklenemedi: Model dosyası bulunamadı`

**Çözüm:**
1. ML modelini eğit (ML Karar Motoru sekmesi)
2. Model dosyası kontrol et:
   ```bash
   ls artifacts/models/xgb_model_btcusdtusdt_1h.json
   ```
3. Timeframe uyumlu mu kontrol et

---

## 📚 İlgili Kaynaklar

- [CryptoAlgoBot Technical Report](documentation/technical_report.md)
- [Deployment Guide](documentation/deployment.md)
- [API Documentation](documentation/api.md)

---

*Son Güncelleme: Mart 2026*  
*CryptoAlgoBot Documentation Team*
