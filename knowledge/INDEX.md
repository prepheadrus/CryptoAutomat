# 📚 CryptoAlgoBot Bilgi Bankası (Knowledge Base)

Bu klasör, CryptoAlgoBot projesinin tüm teknik dokümantasyonunu, stratejilerini, mimari kararlarını ve planlama belgelerini içerir.

---

## 📁 Klasör Yapısı

```
knowledge/
├── architecture/          # Sistem mimarisi ve veri akışı
│   ├── overview.md       # 5 katmanlı mimari genel bakış
│   └── data_pipeline.md  # Veri boru hattı ve özellik mühendisliği
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
│   ├── no_code_strategy_builder_implementation.md  # Implementasyon
│   └── ATR_TRAILING_STOP_SYSTEM.md  # ATR Trailing Stop Sistemi
│
└── documentation/        # Genel dokümantasyon
    ├── session_history.md  # Geliştirme oturum geçmişi
    ├── ai_skill.md         # AI asistan yetenek tanımlaması
    ├── technical_improvements.md  # Teknik iyileştirmeler
    └── RECENT_IMPROVEMENTS.md  # Son geliştirmeler (Mart 2026)
```

---

## 📖 Doküman Rehberi

### 🏗️ Architecture (Mimari)
- **Kimler İçin:** Yeni geliştiriciler, sistem mimarları
- **İçerik:** Katmanlı yapı, veri akışı, modül bağımlılıkları
- **Başlangıç:** `architecture/overview.md`

### 📈 Strategies (Stratejiler)
- **Kimler İçin:** Strateji geliştiriciler, quant analistler
- **İçerik:** Strateji tasarım prensipleri, indikatör konfluansı, yeni strateji ekleme
- **Başlangıç:** `strategies/concept_and_implementation.md`

### ⚙️ Trading Engine (İşlem Motoru)
- **Kimler İçin:** Backend geliştiriciler, risk yöneticileri
- **İçerik:** Paper trading, pozisyon yönetimi, risk hesaplama
- **Başlangıç:** `trading_engine/paper_trader.md`

### 🎨 Frontend (Arayüz)
- **Kimler İçin:** Frontend geliştiriciler, UX tasarımcıları
- **İçerik:** Dashboard tasarımı, grafik kütüphaneleri, veri görselleştirme
- **Başlangıç:** `frontend/dashboard_and_visualization.md`

### 📋 Planning (Planlama)
- **Kimler İçin:** Proje yöneticileri, katkıda bulunanlar
- **İçerik:** Yol haritası, teknoloji kararları, aktif görevler
- **Başlangıç:** `planning/roadmap.md`

### 🆕 Features (Özellikler)
- **Kimler İçin:** Geliştiriciler, kullanıcılar
- **İçerik:** WFO, Auto-Grid, Bayesian Optimization, No-Code Strateji Oluşturucu, Backtest Engine, UI iyileştirmeleri
- **Başlangıç:** `features/walk_forward_optimization.md`

**Yeni Özellikler (Mart 2026):**
- ✅ [Walk-Forward Optimization](features/walk_forward_optimization.md) - Otonom parametre optimizasyonu
- ✅ [Auto-Grid Generator](features/auto_grid_generator.md) - Otomatik parametre ızgarası
- ✅ [Bayesian Optimization](features/bayesian_optimization.md) - Optuna ile 100x hızlanma

### 📝 Documentation (Genel Dokümantasyon)
- **Kimler İçin:** Tüm ekip üyeleri, AI asistanlar
- **İçerik:** Geliştirme geçmişi, yetenek tanımları, yardım kılavuzları, son iyileştirmeler
- **Başlangıç:** `documentation/session_history.md`

---

## 🔍 Hızlı Erişim

| Konu | Dosya |
|------|-------|
| Sistem Mimarisi | `architecture/overview.md` |
| Veri Pipeline | `architecture/data_pipeline.md` |
| Strateji Ekleme | `strategies/concept_and_implementation.md` |
| Paper Trading | `trading_engine/paper_trader.md` |
| Dashboard UI | `frontend/dashboard_and_visualization.md` |
| Yol Haritası | `planning/roadmap.md` |
| Teknolojiler | `planning/tech_stack.md` |
| Görevler | `planning/tasks.md` |
| **WFO Sistemi** | `features/walk_forward_optimization.md` |
| **Auto-Grid** | `features/auto_grid_generator.md` |
| **Bayesian Opt.** | `features/bayesian_optimization.md` |
| **No-Code Strateji** | `features/no_code_strategy_builder.md` |
| **Strateji Oluşturucu** | `features/strategy_builder_guide.md` |
| **Backtest Engine** | `features/backtest_engine.md` |
| **Son Geliştirmeler** | `documentation/RECENT_IMPROVEMENTS.md` |
| Oturum Geçmişi | `documentation/session_history.md` |
| AI Skill | `documentation/ai_skill.md` |
| Teknik İyileştirmeler | `documentation/technical_improvements.md` |

---

## 🔄 Güncelleme Kuralları

1. **Yeni Doküman:** İlgili klasöre ekle, bu INDEX.md'yi güncelle
2. **İsimlendirme:** `kucuk-harf-ve-tire-ayraci.md` formatı kullan
3. **Versiyonlama:** Büyük değişikliklerde dosya sonuna `-v2` ekle
4. **Tarih:** Doküman başına son güncelleme tarihini yaz

---

*Son Güncelleme: 8 Mart 2026 - WFO, Auto-Grid, Bayesian Optimization (Zero-Touch)*
*CryptoAlgoBot Documentation Team*
