# FEATURES BILGI BANKASI
Son Guncelleme: 06/03/2026 19:28

---



## KAYNAK DOSYA: no_code_strategy_builder.md

# 🎨 No-Code Strateji Oluşturucu (Strategy Builder)

**Öncelik:** 🔥 YÜKSEK  
**Durum:** Planlama  
**Tahmini Süre:** 4 hafta

---

## 📋 İÇİNDEKİLER

1. [Özellik Tanımı](#1-özellik-tanımı)
2. [Kullanıcı Hikayesi](#2-kullanıcı-hikayesi)
3. [Teknik Mimari](#3-teknik-mimari)
4. [UI/UX Tasarımı](#4-uiux-tasarımı)
5. [JSON Strateji Formatı](#5-json-strateji-formatı)
6. [Uygulama Adımları](#6-uygulama-adımları)

---

## 1. ÖZELLİK TANIMI

### 🎯 Amaç
Kullanıcıların **kod yazmadan**, görsel arayüz ile kendi trading stratejilerini oluşturabilmeleri.

### 🔑 Ana Özellikler

1. **Gösterge Kütüphanesi**
   - 22+ hazır indikatör
   - Kategorilere ayrılmış (Trend, Momentum, Volatilite, Hacim)
   - Arama ve filtreleme

2. **Koşul Oluşturucu**
   - Mantıksal operatörler (VE, VEYA, DEĞİL)
   - Karşılaştırma operatörleri (<, >, =, <=, >=)
   - İç içe koşullar

3. **Parametre Ayarlama**
   - Her indikatör için özelleştirilebilir parametreler
   - Slider ve input alanları
   - Varsayılan değerler

4. **Strateji Testi**
   - Hızlı backtest
   - Görsel sonuçlar
   - Performans metrikleri

5. **Kaydetme ve Paylaşma**
   - JSON formatında kaydetme
   - Strateji import/export
   - Community library (gelecek)

---

## 2. KULLANICI HİKAYESİ

### Senaryo: Basit RSI + MACD Stratejisi

**Adım 1: Yeni Strateji Oluştur**
```
Dashboard → Strateji Laboratuvarı → "Yeni Strateji"
Strateji Adı: "RSI MACD Combo"
```

**Adım 2: Göstergeleri Ekle**
```
[+] Gösterge Ekle → Momentum → RSI
  - Period: 14 (varsayılan)

[+] Gösterge Ekle → Trend → MACD
  - Fast: 12, Slow: 26, Signal: 9
```

**Adım 3: Koşulları Belirle**
```
LONG Koşulu:
  [RSI < 30] VE [MACD > Signal]

SHORT Koşulu:
  [RSI > 70] VE [MACD < Signal]
```

**Adım 4: Risk Ayarları**
```
Stop Loss: 2.0x ATR
Take Profit: 3.0x ATR
Max Position: %2 risk
```

**Adım 5: Test Et**
```
[Test Strateji] → BTC/USDT, 15m, Son 30 gün
Sonuç: Win Rate %62, Profit Factor 1.8
```

**Adım 6: Kaydet ve Kullan**
```
[Kaydet] → Strateji listesinde görünür
[Aktif Et] → Bot bu stratejiyi kullanır
```

---

## 3. TEKNİK MİMARİ

### 📁 Dosya Yapısı

```
strategy/
├── builder/                  # Yeni klasör
│   ├── __init__.py
│   ├── strategy_builder.py   # Ana builder sınıfı
│   ├── condition_parser.py   # Koşul parser
│   ├── json_validator.py     # JSON validasyonu
│   └── executor.py           # Strateji çalıştırıcı
│
├── indicators/               # Mevcut indikatörler
│   └── ... (mevcut)
│
└── manager.py                # Güncellenecek
```

### 🔄 Veri Akışı

```
User Input (Dashboard)
    ↓
JSON Strategy Definition
    ↓
Condition Parser → AST (Abstract Syntax Tree)
    ↓
Strategy Executor → Signal Generation (0/1/2)
    ↓
Paper Trader → Execution
```

---

## 4. UI/UX TASARIMI

### 🎨 Dashboard - Strateji Laboratuvarı

```
┌─────────────────────────────────────────────────────────┐
│  🎨 Strateji Oluşturucu                    [Kaydet] [X] │
├─────────────────────────────────────────────────────────┤
│  Strateji Adı: [___________________]                    │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐ │
│  │ 📚 Gösterge Kütüphanesi│  │ ⚙️ Koşul Oluşturucu    │ │
│  ├─────────────────────┤  ├──────────────────────────┤ │
│  │ 🔍 Ara...           │  │ LONG Koşulları:          │ │
│  │                     │  │ ┌────────────────────┐   │ │
│  │ 📈 TREND            │  │ │ [RSI] [<] [30]   │   │ │
│  │ ├─ EMA              │  │ │   [VE]             │   │ │
│  │ ├─ SMA              │  │ │ [MACD] [>] [Signal]│  │ │
│  │ ├─ Supertrend       │  │ └────────────────────┘   │ │
│  │                     │  │                          │ │
│  │ 🚀 MOMENTUM         │  │ SHORT Koşulları:         │ │
│  │ ├─ RSI         [+]  │  │ ┌────────────────────┐   │ │
│  │ ├─ MACD        [+]  │  │ │ [RSI] [>] [70]   │   │ │
│  │ ├─ Stochastic  [+]  │  │ │   [VE]             │   │ │
│  │                     │  │ │ [MACD] [<] [Signal]│  │ │
│  │ 📊 VOLATİLİTE       │  │ └────────────────────┘   │ │
│  │ ├─ ATR           [+] │  │                          │ │
│  │ ├─ Bollinger     [+] │  │ [➕ Koşul Ekle]         │ │
│  │                     │  │                          │ │
│  │ 💰 HACİM            │  │ 🎯 Risk Ayarları:        │ │
│  │ ├─ OBV           [+] │  │ Stop: [2.0]x ATR       │ │
│  │ ├─ VWAP          [+] │  │ Take Profit: [3.0]x    │ │
│  │ └─ MFI           [+] │  │ Risk: [%2]             │ │
│  │                     │  │                          │ │
│  │ [+ Kategori Ekle]   │  │ [🧪 Test Et] [💾 Kaydet] │ │
│  └─────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 🎯 İnteraktif Özellikler

1. **Drag & Drop**
   - Göstergeleri koşula sürükle
   - Koşulları yeniden sırala
   - Grupları iç içe yerleştir

2. **Real-time Preview**
   - Koşul yazılırken syntax kontrolü
   - Renkli syntax highlighting
   - Hata mesajları

3. **Tooltip Yardım**
   - Her indikatör açıklaması
   - Parametre aralıkları
   - Örnek kullanımlar

---

## 5. JSON STRATEJİ FORMATI

### 📄 Örnek Strateji JSON

```json
{
  "name": "RSI MACD Combo",
  "description": "RSI aşırı alım/satım + MACD momentum",
  "version": "1.0",
  "author": "Kullanıcı",
  "timeframe": "15m",
  "indicators": [
    {
      "id": "ind_1",
      "type": "RSI",
      "parameters": {
        "length": 14
      }
    },
    {
      "id": "ind_2",
      "type": "MACD",
      "parameters": {
        "fast": 12,
        "slow": 26,
        "signal": 9
      }
    }
  ],
  "conditions": {
    "long": {
      "logic": "AND",
      "rules": [
        {
          "indicator": "ind_1",
          "operator": "<",
          "value": 30
        },
        {
          "indicator": "ind_2",
          "operator": ">",
          "value": "signal"
        }
      ]
    },
    "short": {
      "logic": "AND",
      "rules": [
        {
          "indicator": "ind_1",
          "operator": ">",
          "value": 70
        },
        {
          "indicator": "ind_2",
          "operator": "<",
          "value": "signal"
        }
      ]
    }
  },
  "risk": {
    "stop_loss": {
      "type": "ATR",
      "multiplier": 2.0
    },
    "take_profit": {
      "type": "ATR",
      "multiplier": 3.0
    },
    "max_risk_percent": 2.0
  }
}
```

### 🔍 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "indicators", "conditions"],
  "properties": {
    "name": {"type": "string"},
    "description": {"type": "string"},
    "version": {"type": "string"},
    "indicators": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type"],
        "properties": {
          "id": {"type": "string"},
          "type": {"type": "string", "enum": ["RSI", "MACD", "EMA", "..."]},
          "parameters": {"type": "object"}
        }
      }
    },
    "conditions": {
      "type": "object",
      "required": ["long", "short"],
      "properties": {
        "long": {"$ref": "#/definitions/condition"},
        "short": {"$ref": "#/definitions/condition"}
      }
    }
  },
  "definitions": {
    "condition": {
      "type": "object",
      "required": ["logic", "rules"],
      "properties": {
        "logic": {"type": "string", "enum": ["AND", "OR"]},
        "rules": {
          "type": "array",
          "items": {"$ref": "#/definitions/rule"}
        }
      }
    },
    "rule": {
      "type": "object",
      "required": ["indicator", "operator"],
      "properties": {
        "indicator": {"type": "string"},
        "operator": {"type": "string", "enum": ["<", ">", "=", "<=", ">="]},
        "value": {"type": ["number", "string"]}
      }
    }
  }
}
```

---

## 6. UYGULAMA ADIMLARI

### Hafta 1: Backend Core

- [ ] **strategy_builder.py**
  - Indicator registry
  - Condition evaluator
  - Signal generator

- [ ] **condition_parser.py**
  - JSON parser
  - AST builder
  - Validation

- [ ] **executor.py**
  - Runtime execution
  - Performance optimization

### Hafta 2: Frontend UI

- [ ] **Dashboard Component**
  - Indicator library panel
  - Condition builder panel
  - Drag & drop implementation

- [ ] **Visual Elements**
  - Dropdown menus
  - Input fields
  - Logic operators

### Hafta 3: Testing & Validation

- [ ] **JSON Validator**
  - Schema validation
  - Error messages
  - Auto-fix suggestions

- [ ] **Backtest Integration**
  - Quick test function
  - Performance metrics
  - Visual results

### Hafta 4: Polish & Documentation

- [ ] **User Experience**
  - Tooltips
  - Help documentation
  - Example strategies

- [ ] **Save/Load System**
  - File save (JSON)
  - File load
  - Import/Export

---

## 📊 ÖRNEK STRATEJİLER

### 1. Basit RSI Stratejisi

```json
{
  "name": "RSI Oversold",
  "indicators": [{"id": "rsi_1", "type": "RSI", "parameters": {"length": 14}}],
  "conditions": {
    "long": {"logic": "AND", "rules": [{"indicator": "rsi_1", "operator": "<", "value": 30}]},
    "short": {"logic": "AND", "rules": [{"indicator": "rsi_1", "operator": ">", "value": 70}]}
  }
}
```

### 2. EMA Crossover

```json
{
  "name": "EMA Cross",
  "indicators": [
    {"id": "ema_fast", "type": "EMA", "parameters": {"length": 9}},
    {"id": "ema_slow", "type": "EMA", "parameters": {"length": 21}}
  ],
  "conditions": {
    "long": {"logic": "AND", "rules": [
      {"indicator": "ema_fast", "operator": ">", "value": "ema_slow"}
    ]},
    "short": {"logic": "AND", "rules": [
      {"indicator": "ema_fast", "operator": "<", "value": "ema_slow"}
    ]}
  }
}
```

### 3. Complex Multi-Indicator

```json
{
  "name": "Triple Confirmation",
  "indicators": [
    {"id": "rsi", "type": "RSI"},
    {"id": "macd", "type": "MACD"},
    {"id": "bb", "type": "Bollinger"}
  ],
  "conditions": {
    "long": {
      "logic": "AND",
      "rules": [
        {"indicator": "rsi", "operator": "<", "value": 30},
        {"indicator": "macd", "operator": ">", "value": "signal"},
        {"indicator": "close", "operator": "<", "value": "bb_lower"}
      ]
    }
  }
}
```

---

## 🎯 BAŞARI KRİTERLERİ

| Kriter | Hedef |
|--------|-------|
| Kullanılabilirlik | 5 dakikada ilk strateji |
| Performans | < 100ms signal generation |
| Hata Oranı | <%1 invalid strategy |
| Kullanıcı Memnuniyeti | > 4.5/5 |

---

*Oluşturulma: Mart 2026*  
*CryptoAlgoBot Development Team*


---


## KAYNAK DOSYA: no_code_strategy_builder_implementation.md

# 🎨 No-Code Strateji Oluşturucu - Uygulama Rehberi

**Oluşturulma:** Mart 2026  
**Versiyon:** 1.0  
**Durum:** ✅ Production Ready

---

## 📋 İÇİNDEKİLER

1. [Özellik Tanımı](#1-özellik-tanımı)
2. [Kurulum ve Hazırlık](#2-kurulum-ve-hazırlık)
3. [Kullanım Kılavuzu](#3-kullanım-kılavuzu)
4. [Teknik Mimari](#4-teknik-mimari)
5. [API Referansı](#5-api-referansı)
6. [Örnek Stratejiler](#6-örnek-stratejiler)
7. [Sorun Giderme](#7-sorun-giderme)

---

## 1. ÖZELLİK TANIMI

### No-Code Strateji Oluşturucu Nedir?

CryptoAlgoBot'un **No-Code Strateji Oluşturucu** özelliği, kullanıcıların **kod yazmadan** kendi trading stratejilerini oluşturmalarını sağlayan görsel bir araçtır.

### Ana Özellikler

| Özellik | Açıklama |
|---------|----------|
| 📚 İndikatör Kütüphanesi | 11+ hazır indikatör (RSI, MACD, EMA, vb.) |
| ⚙️ Görsel Koşul Oluşturucu | Sürükle-bırak ile koşul tanımlama |
| 🔀 Mantıksal Operatörler | AND, OR desteği |
| 📊 Real-time Preview | Anlık JSON önizleme |
| 🧪 Test Sistemi | Hızlı strateji testi |
| 💾 Kaydetme Sistemi | JSON formatında saklama |

### Desteklenen İndikatörler

#### Trend İndikatörleri
- **EMA** (Exponential Moving Average)
- **SMA** (Simple Moving Average)
- **Supertrend**

#### Momentum İndikatörleri
- **RSI** (Relative Strength Index)
- **MACD** (Moving Average Convergence Divergence)
- **Stochastic**

#### Volatilite İndikatörleri
- **ATR** (Average True Range)
- **Bollinger Bands**

#### Hacim İndikatörleri
- **OBV** (On-Balance Volume)
- **VWAP** (Volume Weighted Average Price)
- **MFI** (Money Flow Index)

---

## 2. KURULUM VE HAZIRLIK

### Gereksinimler

- ✅ Python 3.8+
- ✅ CryptoAlgoBot kurulu
- ✅ Modern tarayıcı (Chrome, Firefox, Edge)

### Kurulum Adımları

#### Adım 1: Botu Başlat

```bash
cd F:\Yazılan Programlar\Crypto bot\Crypto Bot
start_bot.bat
```

veya manuel:

```bash
cd F:\Yazılan Programlar\Crypto bot\Crypto Bot
venv\Scripts\activate
python main.py
```

#### Adım 2: Dashboard'u Aç

Tarayıcıda:
```
http://localhost:8000
```

#### Adım 3: Strateji Laboratuvarı'na Git

Sol menüden:
```
🎨 Strateji Laboratuvarı
```

---

## 3. KULLANIM KILAVUZU

### Hızlı Başlangıç: İlk Stratejini Oluştur

#### Adım 1: Strateji Adı Gir

Orta panel:
```
Strateji Adı: RSI Oversold
Zaman Dilimi: 15m
```

#### Adım 2: İndikatör Ekle

Sol panel:
```
1. MOMENTUM → RSI → "+" tıkla
2. Length: 14 (varsayılan)
3. "Ekle" tıkla
```

#### Adım 3: LONG Koşulu Oluştur

Orta panel:
```
1. LONG Koşulları → "➕ Koşul Ekle"
2. İndikatör: rsi_1
3. Operatör: <
4. Değer: 30
```

#### Adım 4: SHORT Koşulu Oluştur

Orta panel:
```
1. SHORT Koşulları → "➕ Koşul Ekle"
2. İndikatör: rsi_1
3. Operatör: >
4. Değer: 70
```

#### Adım 5: Risk Ayarları

```
Stop Loss: 2.0
Take Profit: 3.0
Max Risk: 2.0
```

#### Adım 6: Test Et

Sağ panel:
```
"🧪 Test Et" tıkla
```

#### Adım 7: Kaydet

Sağ panel:
```
"💾 Kaydet" tıkla
```

Dosya otomatik kaydedilir:
```
artifacts/strategies/rsi_oversold_20260306_XXXXXX.json
```

---

### Detaylı Kullanım

#### Komplex Strateji: RSI + MACD

**İndikatörler:**
1. RSI (14)
2. MACD (12, 26, 9)

**LONG Koşulu:**
```
RSI < 30
VE (AND)
MACD > Signal
```

**SHORT Koşulu:**
```
RSI > 70
VE (AND)
MACD < Signal
```

**Nasıl:**
1. RSI ve MACD ekle
2. LONG panelinde 2 koşul ekle
3. Logic: VE (AND) seç
4. SHORT için tekrar et

---

#### İndikatör vs İndikatör Karşılaştırma

**Örnek: EMA Crossover**

**İndikatörler:**
- EMA Fast (9)
- EMA Slow (21)

**LONG:**
```
EMA_9 > EMA_21
```

**SHORT:**
```
EMA_9 < EMA_21
```

**Nasıl:**
1. 2x EMA ekle (length: 9 ve 21)
2. Koşul ekle
3. Değer dropdown'dan diğer EMA'yı seç

---

## 4. TEKNİK MİMARİ

### Dosya Yapısı

```
Crypto_Automat/
├── frontend/
│   ├── index.html              # Ana dashboard
│   ├── strategy-lab.html       # Strateji laboratuvarı UI
│   ├── strategy-builder.js     # Frontend JavaScript
│   └── style.css               # CSS stilleri
│
├── strategy/
│   └── builder/
│       ├── __init__.py         # Modül init
│       ├── strategy_builder.py # Strateji oluşturma
│       ├── condition_parser.py # Koşul parser
│       ├── json_validator.py   # JSON validasyonu
│       └── executor.py         # Strateji çalıştırıcı
│
├── api/
│   └── strategy_builder_api.py # API endpoints
│
└── artifacts/
    └── strategies/             # Kaydedilen stratejiler
```

### Veri Akışı

```
User Input (Dashboard)
    ↓
StrategyBuilder (Python)
    ↓
JSON Strategy Definition
    ↓
ConditionParser → AST
    ↓
StrategyExecutor → Signal (0/1/2)
    ↓
Paper Trader → Execution
```

### JSON Strateji Formatı

```json
{
  "name": "RSI MACD Combo",
  "description": "RSI aşırı alım/satım + MACD momentum",
  "version": "1.0",
  "author": "User",
  "timeframe": "15m",
  "indicators": [
    {
      "id": "rsi_1",
      "type": "RSI",
      "parameters": {"length": 14}
    },
    {
      "id": "macd_1",
      "type": "MACD",
      "parameters": {"fast": 12, "slow": 26, "signal": 9}
    }
  ],
  "conditions": {
    "long": {
      "logic": "AND",
      "rules": [
        {"indicator": "rsi_1", "operator": "<", "value": 30},
        {"indicator": "macd_1", "operator": ">", "value": "signal"}
      ]
    },
    "short": {
      "logic": "AND",
      "rules": [
        {"indicator": "rsi_1", "operator": ">", "value": 70},
        {"indicator": "macd_1", "operator": "<", "value": "signal"}
      ]
    }
  },
  "risk": {
    "stop_loss": {"type": "ATR", "multiplier": 2.0},
    "take_profit": {"type": "ATR", "multiplier": 3.0},
    "max_risk_percent": 2.0
  }
}
```

---

## 5. API REFERANSI

### Strateji Test Et

**Endpoint:**
```
POST /api/v1/strategy/test
```

**Request:**
```json
{
  "name": "Test Strategy",
  "indicators": [...],
  "conditions": {...}
}
```

**Response:**
```json
{
  "status": "success",
  "metrics": {
    "win_rate": 62.5,
    "total_trades": 24,
    "profit_factor": 1.8,
    "max_drawdown": 8.2
  }
}
```

---

### Strateji Kaydet

**Endpoint:**
```
POST /api/v1/strategy/save
```

**Request:**
```json
{
  "name": "My Strategy",
  "indicators": [...],
  "conditions": {...}
}
```

**Response:**
```json
{
  "status": "success",
  "filename": "my_strategy_20260306_143022.json",
  "filepath": "artifacts/strategies/my_strategy_20260306_143022.json"
}
```

---

### Strateji Listesi

**Endpoint:**
```
GET /api/v1/strategy/list
```

**Response:**
```json
{
  "status": "success",
  "strategies": [
    {
      "filename": "simple_rsi.json",
      "name": "Basit RSI",
      "timeframe": "15m",
      "indicators_count": 1
    }
  ]
}
```

---

### Strateji Yükle

**Endpoint:**
```
GET /api/v1/strategy/load/{filename}
```

**Response:**
```json
{
  "status": "success",
  "strategy": {
    "name": "Simple RSI",
    "indicators": [...],
    "conditions": {...}
  }
}
```

---

### Strateji Sil

**Endpoint:**
```
DELETE /api/v1/strategy/delete/{filename}
```

**Response:**
```json
{
  "status": "success",
  "message": "Strategy deleted"
}
```

---

### İndikatör Listesi

**Endpoint:**
```
GET /api/v1/strategy/indicators
```

**Response:**
```json
{
  "status": "success",
  "indicators": [
    {
      "name": "RSI",
      "category": "momentum",
      "parameters": {
        "length": {"type": "int", "default": 14}
      }
    }
  ]
}
```

---

## 6. ÖRNEK STRATEJİLER

### 6.1 Basit RSI Stratejisi

**Dosya:** `artifacts/strategies/simple_rsi.json`

**İndikatörler:**
- RSI (14)

**LONG:**
```
RSI < 30
```

**SHORT:**
```
RSI > 70
```

**Risk:**
- Stop: 2.0x ATR
- Take: 3.0x ATR

---

### 6.2 EMA Crossover

**Dosya:** `artifacts/strategies/ema_crossover.json`

**İndikatörler:**
- EMA Fast (9)
- EMA Slow (21)

**LONG:**
```
EMA_9 > EMA_21
```

**SHORT:**
```
EMA_9 < EMA_21
```

**Risk:**
- Stop: 2.5x ATR
- Take: 3.5x ATR

---

### 6.3 RSI MACD Combo

**Dosya:** `artifacts/strategies/rsi_macd_combo.json`

**İndikatörler:**
- RSI (14)
- MACD (12, 26, 9)

**LONG:**
```
RSI < 30 VE MACD > Signal
```

**SHORT:**
```
RSI > 70 VE MACD < Signal
```

**Risk:**
- Stop: 2.0x ATR
- Take: 3.0x ATR

---

## 7. SORUN GİDERME

### Strateji Laboratuvarı Görünmüyor

**Sorun:** Sol menüde "🎨 Strateji Laboratuvarı" yok

**Çözüm:**
```bash
1. Botu durdur (CTRL+C)
2. start_bot.bat ile yeniden başlat
3. Tarayıcıda CTRL+F5 (Hard Refresh)
```

---

### İçerik Boş Görünüyor

**Sorun:** Menü var ama tıklayınca boş

**Çözüm:**
```bash
1. Tarayıcı cache temizle (CTRL+SHIFT+DELETE)
2. Hard refresh (CTRL+F5)
3. Botu yeniden başlat
```

---

### CSS Stilleri Yüklenmiyor

**Sorun:** Paneller alt alta, yan yana değil

**Çözüm:**
```bash
1. Tarayıcı Developer Tools aç (F12)
2. Console'da hata var mı kontrol et
3. Cache temizle
4. Botu yeniden başlat
```

---

### İndikatör Eklenmiyor

**Sorun:** "+" butonuna tıklayınca hiçbir şey olmuyor

**Çözüm:**
```bash
1. Browser Console aç (F12)
2. Hata mesajı var mı kontrol et
3. strategy-builder.js yüklenmiş mi kontrol et
4. Botu yeniden başlat
```

---

### Test Butonu Çalışmıyor

**Sorun:** "🧪 Test Et" tıklayınca response yok

**Çözüm:**
```bash
1. API endpoint kontrol et: http://localhost:8000/docs
2. POST /api/v1/strategy/test manuel dene
3. Bot loglarını kontrol et
```

---

### Strateji Kaydedilmiyor

**Sorun:** "💾 Kaydet" tıklayınca hata

**Çözüm:**
```bash
1. artifacts/strategies/ klasörü var mı kontrol et
2. Yoksa oluştur: mkdir artifacts\strategies
3. Yazma izni var mı kontrol et
4. Botu yeniden başlat
```

---

## 📞 DESTEK

**Sorun mu var?**

1. **Dokümantasyon:** `/knowledge` klasörü
2. **GitHub Issues:** https://github.com/prepheadrus/Crypto_Automat/issues
3. **Log Dosyaları:** Bot terminal çıktısı

---

*Son Güncelleme: Mart 2026*  
*CryptoAlgoBot Development Team*


---


## KAYNAK DOSYA: strategy_builder_guide.md

# 🎨 No-Code Strateji Oluşturucu - Kullanım Kılavuzu

**Son Güncelleme:** Mart 2026  
**Versiyon:** 1.0  
**Durum:** Production Ready

---

## 📋 İÇİNDEKİLER

1. [Giriş](#1-giriş)
2. [Hızlı Başlangıç](#2-hızlı-başlangıç)
3. [Adım Adım Strateji Oluşturma](#3-adım-adım-strateji-oluşturma)
4. [İndikatör Rehberi](#4-indikatör-rehberi)
5. [Koşul Oluşturma](#5-koşul-oluşturma)
6. [Test ve Backtest](#6-test-ve-backtest)
7. [Kaydetme ve Yükleme](#7-kaydetme-ve-yükleme)
8. [Örnek Stratejiler](#8-örnek-stratejiler)
9. [Sık Sorulan Sorular](#9-sık-sorulan-sorular)

---

## 1. GİRİŞ

### No-Code Strateji Oluşturucu Nedir?

CryptoAlgoBot'un **No-Code Strateji Oluşturucu** özelliği, kod yazmadan kendi trading stratejilerinizi oluşturmanızı sağlar.

### Kimler Kullanabilir?

- ✅ **Yeni Başlayanlar:** Kod bilgisi gerekmez
- ✅ **Traderlar:** Stratejileri hızlıca test edin
- ✅ **Geliştiriciler:** Prototip oluşturun
- ✅ **Analistler:** Fikirleri hızlıca doğrulayın

### Özellikler

| Özellik | Açıklama |
|---------|----------|
| 📚 İndikatör Kütüphanesi | 11+ hazır indikatör |
| ⚙️ Görsel Koşul Oluşturucu | Sürükle-bırak arayüzü |
| 🔀 Mantıksal Operatörler | AND, OR desteği |
| 📊 Real-time Preview | Anlık JSON önizleme |
| 🧪 Test Sistemi | Hızlı backtest |
| 💾 Kaydetme Sistemi | JSON formatında |

---

## 2. HIZLI BAŞLANGIÇ

### Adım 1: Strateji Laboratuvarı'nı Aç

Dashboard'da sol menüden **🎨 Strateji Laboratuvarı** sekmesine tıklayın.

### Adım 2: İndikatör Seç

Sol panelden bir indikatör seçin (örn: **RSI**) ve **"+"** butonuna tıklayın.

### Adım 3: Koşul Ekle

Orta panelde:
- **LONG Koşulu:** RSI < 30
- **SHORT Koşulu:** RSI > 70

### Adım 4: Test Et

**"🧪 Test Et"** butonuna tıklayın.

### Adım 5: Kaydet

**"💾 Kaydet"** butonuna tıklayın.

**Tebrikler!** İlk stratejinizi oluşturdunuz! 🎉

---

## 3. ADIM ADIM STRATEJİ OLUŞTURMA

### Örnek: RSI + MACD Stratejisi

#### Adım 1: Temel Bilgiler

```
Strateji Adı: RSI MACD Combo
Zaman Dilimi: 15m
```

#### Adım 2: İndikatörleri Ekle

**1. RSI Ekle:**
- Sol panel → MOMENTUM → RSI → "+"
- Parametre: Length = 14
- Tamam

**2. MACD Ekle:**
- Sol panel → MOMENTUM → MACD → "+"
- Fast = 12, Slow = 26, Signal = 9
- Tamam

#### Adım 3: LONG Koşulu Oluştur

```
RSI < 30
VE (AND)
MACD > Signal
```

**Nasıl:**
1. LONG panelinde "➕ Koşul Ekle"
2. İndikatör: RSI, Operatör: <, Değer: 30
3. "➕ Koşul Ekle" tekrar
4. İndikatör: MACD, Operatör: >, Değer: Signal
5. Logic: VE (AND) seç

#### Adım 4: SHORT Koşulu Oluştur

```
RSI > 70
VE (AND)
MACD < Signal
```

#### Adım 5: Risk Ayarları

```
Stop Loss: 2.0x ATR
Take Profit: 3.0x ATR
Max Risk: %2
```

#### Adım 6: Test

**"🧪 Test Et"** → Sonuçları incele:
- Win Rate: %62
- Total Trades: 24
- Profit Factor: 1.8

#### Adım 7: Kaydet

**"💾 Kaydet"** → Dosya adı: `rsi_macd_combo.json`

---

## 4. İNDİKATÖR REHBERİ

### 📈 TREND İNDİKATÖRLERİ

#### EMA (Exponential Moving Average)

**Parametreler:**
- `length`: Periyot (1-200, varsayılan: 20)

**Kullanım:**
```
EMA < Close  → Fiyat ortalamanın üstünde (BOĞA)
EMA > Close  → Fiyat ortalamanın altında (AYI)
```

#### SMA (Simple Moving Average)

**Parametreler:**
- `length`: Periyot (1-200, varsayılan: 20)

**Kullanım:**
```
SMA Cross: EMA_fast > EMA_slow → AL
```

#### Supertrend

**Parametreler:**
- `multiplier`: Çarpan (1.0-10.0, varsayılan: 3.0)
- `period`: Periyot (1-50, varsayılan: 10)

**Kullanım:**
```
Close > Supertrend → LONG
Close < Supertrend → SHORT
```

---

### 🚀 MOMENTUM İNDİKATÖRLERİ

#### RSI (Relative Strength Index)

**Parametreler:**
- `length`: Periyot (1-50, varsayılan: 14)

**Kullanım:**
```
RSI < 30  → Aşırı Satım (AL fırsatı)
RSI > 70  → Aşırı Alım (SAT fırsatı)
RSI < 50  → Ayı momentum
RSI > 50  → Boğa momentum
```

#### MACD (Moving Average Convergence Divergence)

**Parametreler:**
- `fast`: Hızlı EMA (1-50, varsayılan: 12)
- `slow`: Yavaş EMA (1-100, varsayılan: 26)
- `signal`: Signal line (1-50, varsayılan: 9)

**Kullanım:**
```
MACD > Signal → AL
MACD < Signal → SAT
MACD > 0 → Boğa
MACD < 0 → Ayı
```

#### Stochastic

**Parametreler:**
- `k`: %K periyot (1-50, varsayılan: 14)
- `d`: %D periyot (1-50, varsayılan: 3)

**Kullanım:**
```
%K < 20 → Aşırı Satım
%K > 80 → Aşırı Alım
%K > %D → AL
%K < %D → SAT
```

---

### 📊 VOLATİLİTE İNDİKATÖRLERİ

#### ATR (Average True Range)

**Parametreler:**
- `period`: Periyot (1-50, varsayılan: 14)

**Kullanım:**
```
Stop Loss = Entry - (2.0 x ATR)
Take Profit = Entry + (3.0 x ATR)
```

#### Bollinger Bands

**Parametreler:**
- `length`: Periyot (1-100, varsayılan: 20)
- `std`: Standart sapma (0.5-5.0, varsayılan: 2.0)

**Kullanım:**
```
Close < Lower Band → Aşırı Satım (AL)
Close > Upper Band → Aşırı Alım (SAT)
```

---

### 💰 HACİM İNDİKATÖRLERİ

#### OBV (On-Balance Volume)

**Parametreler:** Yok

**Kullanım:**
```
OBV yükseliyor + Fiyat yükseliyor → Trend güçlü
OBV düşüyor + Fiyat yükseliyor → Divergence (dönüş uyarısı)
```

#### VWAP (Volume Weighted Average Price)

**Parametreler:** Yok

**Kullanım:**
```
Close > VWAP → Boğa
Close < VWAP → Ayı
```

#### MFI (Money Flow Index)

**Parametreler:**
- `period`: Periyot (1-50, varsayılan: 14)

**Kullanım:**
```
MFI < 20 → Aşırı Satım
MFI > 80 → Aşırı Alım
```

---

## 5. KOŞUL OLUŞTURMA

### Mantıksal Operatörler

#### VE (AND)

**Tüm koşullar sağlanmalı:**

```
RSI < 30 VE MACD > Signal VE Close > EMA
→ Hepsi doğru olmalı
```

#### VEYA (OR)

**En az bir koşul sağlanmalı:**

```
RSI < 30 VEYA MACD > Signal
→ Biri doğru yeterli
```

### Karşılaştırma Operatörleri

| Operatör | Anlamı | Örnek |
|----------|--------|-------|
| `<` | Küçük | RSI < 30 |
| `>` | Büyük | MACD > Signal |
| `=` | Eşit | Close = Open |
| `<=` | Küçük veya eşit | RSI <= 30 |
| `>=` | Büyük veya eşit | Close >= EMA |

### İndikatör vs İndikatör

Bir indikatörü başka indikatör ile karşılaştır:

```
MACD > Signal
EMA_9 > EMA_21
Close > VWAP
```

### İndikatör vs Değer

İndikatörü sabit değer ile karşılaştır:

```
RSI < 30
ATR > 2.5
MFI > 80
```

---

## 6. TEST VE BACKTEST

### Hızlı Test

**"🧪 Test Et"** butonu:
- Son 30 gün verisi
- Seçili timeframe
- Hızlı sonuç (1-2 saniye)

**Sonuç Metrikleri:**
- **Win Rate:** Kazanma oranı (%)
- **Total Trades:** Toplam işlem sayısı
- **Profit Factor:** Brüt kar / Brüt zarar
- **Max Drawdown:** Maksimum düşüş (%)

### Detaylı Backtest (Gelecek Özellik)

- Özel tarih aralığı
- Komisyon hesaplama
- Slipaj simülasyonu
- Detaylı rapor

---

## 7. KAYDETME VE YÜKLEME

### Kaydetme

1. **"💾 Kaydet"** butonuna tıkla
2. Dosya adı otomatik oluşturulur: `rsi_macd_combo_20260306_143022.json`
3. Dosya `artifacts/strategies/` klasörüne kaydedilir

### Yükleme

**Yöntem 1: Dashboard'dan**
1. Strateji Kütüphanesi sekmesi
2. Strateji seç
3. "Yükle" tıkla

**Yöntem 2: JSON Dosyasından**
```json
{
  "name": "RSI MACD Combo",
  "timeframe": "15m",
  "indicators": [...],
  "conditions": {...}
}
```

### Dışa Aktarma (Export)

```bash
# API ile
GET /api/v1/strategy/list
GET /api/v1/strategy/load/{filename}
```

### İçe Aktarma (Import)

```bash
# API ile
POST /api/v1/strategy/save
Body: { strateji JSON }
```

---

## 8. ÖRNEK STRATEJİLER

### 8.1 Basit RSI Stratejisi

**İndikatörler:**
- RSI (14)

**LONG:**
```
RSI < 30
```

**SHORT:**
```
RSI > 70
```

**Risk:**
- Stop: 2.0x ATR
- Take: 3.0x ATR

---

### 8.2 EMA Crossover

**İndikatörler:**
- EMA Fast (9)
- EMA Slow (21)

**LONG:**
```
EMA_9 > EMA_21
```

**SHORT:**
```
EMA_9 < EMA_21
```

**Risk:**
- Stop: 2.5x ATR
- Take: 3.5x ATR

---

### 8.3 MACD + RSI

**İndikatörler:**
- RSI (14)
- MACD (12, 26, 9)

**LONG:**
```
RSI < 30 VE MACD > Signal
```

**SHORT:**
```
RSI > 70 VE MACD < Signal
```

**Risk:**
- Stop: 2.0x ATR
- Take: 3.0x ATR

---

### 8.4 Bollinger Breakout

**İndikatörler:**
- Bollinger Bands (20, 2.0)

**LONG:**
```
Close < Lower Band
```

**SHORT:**
```
Close > Upper Band
```

**Risk:**
- Stop: 1.5x ATR
- Take: 3.0x ATR

---

### 8.5 Triple Confirmation

**İndikatörler:**
- RSI (14)
- MACD (12, 26, 9)
- EMA (50)

**LONG:**
```
RSI < 30 VE MACD > Signal VE Close > EMA_50
```

**SHORT:**
```
RSI > 70 VE MACD < Signal VE Close < EMA_50
```

**Risk:**
- Stop: 2.0x ATR
- Take: 4.0x ATR

---

## 9. SIK SORULAN SORULAR

### S: Kaç indikatör ekleyebilirim?

**C:** Sınırsız! Ama performans için 3-5 indikatör önerilir.

### S: Aynı indikatörü birden fazla ekleyebilir miyim?

**C:** Evet! Örneğin:
- RSI (14) - kısa vadeli
- RSI (50) - uzun vadeli

### S: Özel indikatör ekleyebilir miyim?

**C:** Şu anda 11 hazır indikatör var. Özel indikatör için Python kodu gerekiyor (gelecek özellik).

### S: Stratejim neden sinyal vermiyor?

**C:** Koşullar çok katı olabilir. Kontrol edin:
- İndikatörler doğru eklendi mi?
- Koşullar çok mu zor?
- Timeframe uygun mu?

### S: Backtest sonuçları gerçekçi mi?

**C:** Hızlı test yaklaşık sonuçlar verir. Detaylı backtest için:
- Komisyon hesaplama
- Slipaj simülasyonu
- Daha uzun tarih aralığı

### S: Stratejimi nasıl paylaşabilirim?

**C:** JSON dosyasını kopyalayın:
```
artifacts/strategies/strateji_adı.json
```

### S: Canlı trading'de kullanabilir miyim?

**C:** Evet! Ama önce:
1. Paper trading'de test edin
2. Backtest yapın
3. Küçük pozisyonlarla başlayın

---

## 📞 DESTEK

**Sorun mu var?**

1. **Dokümantasyon:** `/knowledge` klasörü
2. **GitHub Issues:** https://github.com/prepheadrus/Crypto_Automat/issues
3. **Discord:** (Yakında)

---

*Son Güncelleme: Mart 2026*  
*CryptoAlgoBot Development Team*


---
