# ⚠️ Risk Engine

**Son Güncelleme:** Mart 2026  
**Durum:** ✅ Production Ready  
**Kategori:** Risk Management

---

## 🎯 Genel Bakış

**Risk Engine**, risk yönetimi ve hesaplama motorudur:
- Pozisyon boyutu hesaplama
- Dinamik kaldıraç hesaplama
- Stop loss / take profit hesaplama
- Risk limiti kontrolü
- Kill switch yönetimi

**Dosya:** `core/risk/risk_engine.py`

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────┐
│                 RiskEngine                              │
├─────────────────────────────────────────────────────────┤
│ - config: RiskConfig                                    │
│ - consecutive_losses: int                               │
│ - daily_pnl: float                                      │
│ - kill_switch_active: bool                              │
├─────────────────────────────────────────────────────────┤
│ + calculate_position_size(...)                          │
│ + calculate_dynamic_leverage(...)                       │
│ + calculate_dynamic_stops(...)                          │
│ + check_kill_switch()                                   │
│ + can_open_position()                                   │
│ + record_trade_result(...)                              │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Kullanım

### **1. RiskEngine Oluştur**

```python
from core.risk.risk_engine import RiskEngine, RiskConfig

config = RiskConfig(
    max_risk_per_trade=0.01,  # %1
    max_leverage=10,
    max_consecutive_losses=5,
    max_daily_loss=0.05  # %5
)

engine = RiskEngine(config=config)
```

---

### **2. Pozisyon Boyutu Hesapla**

```python
size = engine.calculate_position_size(
    account_balance=10000,
    entry_price=50000,
    stop_loss_price=49000,
    risk_percentage=1.0  # %1
)

# Formül: (Bakiye × Risk%) / |Giriş - Stop|
# (10000 × 0.01) / |50000 - 49000| = 100 / 1000 = 0.1
```

---

### **3. Dinamik Kaldıraç**

```python
# ML confidence bazlı
leverage = engine.calculate_dynamic_leverage(
    confidence_score=0.75  # %75 güven
)

# Confidence bazlı hesaplama:
# < 50%: 1x (base)
# 50-65%: 2-3x
# 65-80%: 3-5x
# > 80%: 5-10x (max)
```

**ML Recommendation bazlı:**

```python
leverage = engine.calculate_leverage_from_ml_recommendation(
    ml_recommendation="STRONG_LONG"  # %80+ güven
)
# Returns: 10x (max)
```

---

### **4. Stop Loss / Take Profit**

```python
sl, tp = engine.calculate_dynamic_stops(
    price=50000,
    direction="LONG",
    atr=500,
    multiplier=3.0,
    risk_reward_ratio=2.0
)

# LONG için:
# stop_loss = 50000 - (500 * 3.0) = 48500
# take_profit = 50000 + (500 * 3.0 * 2.0) = 53000
```

---

### **5. Kill Switch**

```python
# Kill switch kontrolü
if engine.check_kill_switch():
    logger.critical("🚨 KILL SWITCH AKTİF!")
    return  # Trading durduruldu

# Ardışık kayıp >= 5 ise
# Veya günlük kayıp >= %5 ise
```

---

### **6. Trade Result Kaydet**

```python
# Trade sonucunu kaydet
engine.record_trade_result(pnl=-100.0)  # $100 kayıp

# Ardışık kayıp sayacı artar
# Günlük PnL güncellenir
# Kill switch kontrolü yapılır
```

---

## 📊 Özellikler

### **1. Risk Bazlı Pozisyon Boyutu**

```python
# Formül
position_size = (account_balance * risk_percentage) / |entry_price - stop_loss|

# Örnek
balance = 10000
risk = 1.0  # %1
entry = 50000
stop = 49000

size = (10000 * 0.01) / |50000 - 49000| = 100 / 1000 = 0.1 BTC
```

---

### **2. Dinamik Kaldıraç Tablosu**

| ML Confidence | Recommendation | Kaldıraç |
|---------------|----------------|----------|
| < 50% | HOLD/WEAK | 1x (base) |
| 50-65% | WEAK_LONG/WEAK_SHORT | 2-3x |
| 65-80% | LONG/SHORT | 3-5x |
| > 80% | STRONG_LONG/STRONG_SHORT | 5-10x (max) |

---

### **3. ATR Bazlı Stops**

```python
# LONG için
stop_loss = price - (ATR × multiplier)
take_profit = price + (ATR × multiplier × risk_reward_ratio)

# SHORT için
stop_loss = price + (ATR × multiplier)
take_profit = price - (ATR × multiplier × risk_reward_ratio)
```

---

## 🧪 Test Örnekleri

### **Pozisyon Boyutu Testi:**

```python
def test_position_size():
    engine = RiskEngine()
    
    size = engine.calculate_position_size(
        account_balance=10000,
        entry_price=50000,
        stop_loss_price=49000,
        risk_percentage=1.0
    )
    
    assert size == 0.1  # 100 / 1000
```

---

### **Kill Switch Testi:**

```python
def test_kill_switch():
    engine = RiskEngine()
    
    # 5 ardışık kayıp
    for i in range(5):
        engine.record_trade_result(pnl=-100.0)
    
    # Kill switch aktif olmalı
    assert engine.kill_switch_active == True
    assert engine.check_kill_switch() == True
```

---

## 🚨 Sorun Giderme

### **Sorun 1: Geçersiz Risk Limiti**

**Hata:**
```
ValueError: Geçersiz risk limiti: 10.0%. Kabul edilebilir aralık: 0-5%
```

**Çözüm:**
```python
# Risk %0-5 arası olmalı
risk_percentage = 1.0  # %1 (doğru)
risk_percentage = 10.0  # %10 (yanlış!)
```

---

### **Sorun 2: Kill Switch Aktif**

**Sebep:** Ardışık kayıp limiti aşıldı

**Çözüm:**
```python
# Manuel sıfırlama (kullanıcı onayı ile)
engine.reset_kill_switch()

# Veya günlük sıfırlama
engine.reset_daily()
```

---

## 📚 İlgili Dokümanlar

- **Position Manager:** `features/position_manager.md`
- **Bot Manager:** `features/bot_manager.md`
- **Event-Driven Architecture:** `architecture/event_driven_architecture.md`

---

*Bu doküman Risk Engine'in Mart 2026 versiyonunu açıklar.*  
*Güncellemeler için `core/risk/risk_engine.py` dosyasını kontrol edin.*
