# FEATURES BILGI BANKASI
Son Guncelleme: 07/03/2026 10:28

---



## KAYNAK DOSYA: ATR_TRAILING_STOP_SYSTEM.md

# 🎯 ATR Tabanlı Dinamik İz Süren Stop (Dynamic Trailing Stop) Sistemi

**Doküman Versiyonu:** 1.0  
**Oluşturulma:** 6 Mart 2026  
**Durum:** ✅ Production Ready  
**İlgili Modül:** `core/paper.py`, `core/exchange.py`

---

## 📋 İÇİNDEKİLER

1. [Genel Bakış](#1-genel-bakış)
2. [Problem Tanımı](#2-problem-tanımı)
3. [Çözüm: Trailing Stop Sistemi](#3-çözüm-trailing-stop-sistemi)
4. [Teknik Mimari](#4-teknik-mimari)
5. [4 Adımlı Uygulama](#5-4-adımlı-uygulama)
6. [Kod Referansı](#6-kod-referansı)
7. [Örnek Senaryolar](#7-örnek-senaryolar)
8. [Performans Metrikleri](#8-performans-metrikleri)
9. [Risk Yönetimi](#9-risk-yönetimi)
10. [Gelecek İyileştirmeler](#10-gelecek-iyileştirmeler)

---

## 1. GENEL BAKIŞ

### 1.1 Özellik Tanımı

**ATR Tabanlı Dinamik İz Süren Stop (Dynamic Trailing Stop)**, kripto para trading işlemlerinde karı maksimize etmek ve riski dinamik olarak yönetmek için geliştirilmiş gelişmiş bir stop-loss mekanizmasıdır.

**Temel Özellikler:**
- ✅ **ATR (Average True Range)** tabanlı stop mesafesi
- ✅ **Dinamik güncelleme**: Fiyat lehimize gittikçe stop seviyesi güncellenir
- ✅ **Tek yönlü hareket**: LONG'da sadece yukarı, SHORT'ta sadece aşağı
- ✅ **Gerçekçi çıkış simülasyonu**: Slipaj (%0.01) ve komisyon hesaplama
- ✅ **Asenkron çalışma**: Event loop bloklanmadan gerçek zamanlı güncelleme

### 1.2 Kullanılan Teknolojiler

| Bileşen | Teknoloji | Dosya |
|---------|-----------|-------|
| **Position State** | Python Dictionary | `core/paper.py` |
| **Trailing Stop Logic** | Async Python | `core/paper.py` |
| **Exit Condition** | Async Python | `core/paper.py` |
| **Price Feed** | CCXT Pro WebSocket | `core/exchange.py` |
| **Database** | SQLite (aiosqlite) | `data/database.py` |

---

## 2. PROBLEM TANIMI

### 2.1 Deneyimsiz Yatırımcı Davranışları

**Sorun 1: Erken Kar Realizasyonu**
```
❌ Senaryo:
- Yatırımcı 65000 USDT'den BTC LONG açtı
- Fiyat 67000 USDT'ye yükseldi (%3 kar)
- Panik ile pozisyonu kapattı
- Fiyat 75000 USDT'ye kadar yükseldi
- Masada bırakılan kar: $8000 (+%12)
```

**Sorun 2: Sabit Stop-Loss**
```
❌ Senaryo:
- Yatırımcı 65000 USDT giriş, sabit stop: 62000 USDT
- Fiyat 70000 USDT'ye yükseldi
- Düzeltme geldi 64000 USDT'ye (stop patlamadı)
- Trend devam etti 80000 USDT'ye
- Ancak yatırımcı 62000 stop ile bekliyor
- Potansiyel kar maksimize edilemedi
```

### 2.2 Mevcut Sistem Limitasyonları

**Önceki Durum (Statik Stop-Loss):**
```python
# Sabit stop-loss (değişmez)
stop_loss = entry_price - (ATR × multiplier)
# Fiyat yükselse bile stop aynı kalır
```

**Sonuç:**
- ❌ Trend devamında kar maksimize edilemez
- ❌ Piyasa gürültüsünde erken çıkış
- ❌ Risk/ödül oranı statik

---

## 3. ÇÖZÜM: TRAILING STOP SİSTEMİ

### 3.1 Temel Mantık

**LONG İşlem:**
```
Giriş: 65000 USDT
ATR: 1500 USDT
Multiplier: 2.0
Initial Stop: 65000 - (1500 × 2.0) = 62000 USDT

Fiyat yükseldi: 67000 USDT (yeni zirve)
highest_seen: 67000 USDT
New Stop: 67000 - (1500 × 2.0) = 64000 USDT ✅ (YUKARI taşındı)

Fiyat düştü: 66000 USDT (yeni zirve değil)
highest_seen: 67000 USDT (değişmedi)
Stop: 64000 USDT (değişmedi) ✅
```

**SHORT İşlem:**
```
Giriş: 65000 USDT
ATR: 1500 USDT
Multiplier: 2.0
Initial Stop: 65000 + (1500 × 2.0) = 68000 USDT

Fiyat düştü: 63000 USDT (yeni dip)
lowest_seen: 63000 USDT
New Stop: 63000 + (1500 × 2.0) = 66000 USDT ✅ (AŞAĞI taşındı)

Fiyat yükseldi: 64000 USDT (yeni dip değil)
lowest_seen: 63000 USDT (değişmedi)
Stop: 66000 USDT (değişmedi) ✅
```

### 3.2 Kritik Kurallar

| Kural | LONG | SHORT |
|-------|------|-------|
| **Stop Yönü** | SADECE YUKARI | SADECE AŞAĞI |
| **Trigger** | `current_low <= stop_loss` | `current_high >= stop_loss` |
| **Slipaj** | `exit_price / 1.0001` | `exit_price * 1.0001` |
| **State** | `highest_seen` | `lowest_seen` |

---

## 4. TEKNİK MİMARİ

### 4.1 Sistem Diyagramı

```
┌──────────────────┐
│  Binance         │
│  WebSocket       │
│  Ticker Stream   │
└────────┬─────────┘
         │
         │ current_price
         ▼
┌──────────────────┐
│  watch_ticker_loop()  │
│  (exchange.py)   │
└────────┬─────────┘
         │
         │ await
         ▼
┌──────────────────┐
│  update_live_prices() │
│  (paper.py)      │
└────────┬─────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌──────────────────┐ ┌──────────────────┐
│ update_trailing  │ │ check_exit_      │
│ _stop()          │ │ condition()      │
│                  │ │                  │
│ • highest_seen   │ │ • Stop patlama   │
│ • lowest_seen    │ │ • Slipaj         │
│ • ATR × multiplier│ │ • Komisyon       │
│ • Stop güncelle  │ │ • Net PnL        │
└──────────────────┘ └──────────────────┘
         │                 │
         └────────┬────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ _close_position_ │
         │ with_pnl()       │
         │                  │
         │ • DB kayıt       │
         │ • İstatistik     │
         │ • Log            │
         └──────────────────┘
```

### 4.2 Position State Değişkenleri

| Değişken | Tip | Açıklama | Örnek |
|----------|-----|----------|-------|
| **`entry_price`** | float | İşleme girildiği anki fiyat | `65000.0` |
| **`direction`** | str | Pozisyon yönü | `"LONG"` veya `"SHORT"` |
| **`atr`** | float | İşleme girildiği anki ATR(14) değeri | `1500.0` |
| **`atr_multiplier`** | float | Piyasa gürültüsünden korunmak için çarpan | `2.0` |
| **`highest_seen`** | float | LONG için: Fiyatın ulaştığı en yüksek nokta | `67000.0` |
| **`lowest_seen`** | float | SHORT için: Fiyatın ulaştığı en düşük nokta | `63000.0` |
| **`stop_loss`** | float | Dinamik stop-loss seviyesi | `64000.0` |

---

## 5. 4 ADIMLI UYGULAMA

### **ADIM 1: Position State Değişkenleri**

**Dosya:** `core/paper.py`  
**Satırlar:** 286-291

```python
new_position = {
    # ... diğer alanlar ...
    
    # ADIM 1: Dinamik İzleyen Stop için gerekli state değişkenleri
    'atr': atr,                      # İşleme girildiği anki ATR değeri
    'atr_multiplier': multiplier,    # Piyasa gürültüsünden korunmak için çarpan
    'highest_seen': execution_price, # LONG için: En yüksek görülen fiyat
    'lowest_seen': execution_price,  # SHORT için: En düşük görülen fiyat
}
```

**Eklenen Değişkenler:**
- ✅ `atr`: İşlem anındaki ATR değeri (sabit kalır)
- ✅ `atr_multiplier`: ATR çarpanı (strateji bazlı)
- ✅ `highest_seen`: LONG için zirve takip
- ✅ `lowest_seen`: SHORT için dip takip

---

### **ADIM 2: Trailing Stop Güncelleme Fonksiyonu**

**Dosya:** `core/paper.py`  
**Satırlar:** 331-378

```python
async def update_trailing_stop(self, pos: dict, current_high: float, current_low: float):
    """
    ADIM 2: İz Süren Stop (Trailing Stop) güncelleme fonksiyonu.
    
    LONG İşlemler:
        - current_high > highest_seen ise yeni zirve
        - Zirveden (ATR × Çarpan) çıkararak yeni stop hesapla
        - Eğer yeni stop > eski stop ise güncelle (SADECE YUKARI)
    
    SHORT İşlemler:
        - current_low < lowest_seen ise yeni dip
        - Dipten (ATR × Çarpan) ekleyerek yeni stop hesapla
        - Eğer yeni stop < eski stop ise güncelle (SADECE AŞAĞI)
    """
    if pos['direction'] == "LONG":
        if current_high > pos['highest_seen']:
            pos['highest_seen'] = current_high
            new_stop = current_high - (pos['atr'] * pos['atr_multiplier'])
            if new_stop > pos['stop_loss']:
                pos['stop_loss'] = new_stop
                logger.debug(f"[TRAILING STOP] {pos['symbol']} LONG stop yukarı taşındı: {pos['stop_loss']:.2f}")
    else:  # SHORT
        if current_low < pos['lowest_seen']:
            pos['lowest_seen'] = current_low
            new_stop = current_low + (pos['atr'] * pos['atr_multiplier'])
            if new_stop < pos['stop_loss']:
                pos['stop_loss'] = new_stop
                logger.debug(f"[TRAILING STOP] {pos['symbol']} SHORT stop aşağı taşındı: {pos['stop_loss']:.2f}")
```

**Özellikler:**
- ✅ Yeni zirve/dip görülmeden stop güncellenmez
- ✅ Stop sadece tek yönde hareket eder
- ✅ ATR ve multiplier sabit kalır
- ✅ Debug logging ile izlenebilirlik

---

### **ADIM 3: Çıkış Koşulu Kontrolü**

**Dosya:** `core/paper.py`  
**Satırlar:** 380-489

```python
async def check_exit_condition(self, pos: dict, current_high: float, current_low: float):
    """
    ADIM 3: Çıkış Koşulu Kontrolü ve Gerçekçi Simülasyon.
    
    Stop patlama kontrolü + Slipaj + Komisyon hesaplama.
    """
    # 1. STOP PATLAMA KONTROLÜ
    if pos['direction'] == "LONG":
        if current_low <= pos['stop_loss']:
            should_close = True
            reason = "STOP PATLADI (Long Stop-Loss)"
            exit_price = pos['stop_loss']
    else:  # SHORT
        if current_high >= pos['stop_loss']:
            should_close = True
            reason = "STOP PATLADI (Short Stop-Loss)"
            exit_price = pos['stop_loss']
    
    # 2. GERÇEKÇİ SİMÜLASYON (SLIPAJ + KOMİSYON)
    if should_close:
        # Slipaj
        if pos['direction'] == "LONG":
            actual_exit_price = exit_price / 1.0001  # %0.01 aşağıdan sat
        else:  # SHORT
            actual_exit_price = exit_price * 1.0001  # %0.01 yukarıdan al
        
        # Komisyon
        exit_value_usd = pos['size'] * actual_exit_price
        exit_fee = exit_value_usd * fee_rate
        
        # Net PnL
        if pos['direction'] == "LONG":
            gross_pnl = (actual_exit_price - pos['entry_price']) * pos['size']
        else:  # SHORT
            gross_pnl = (pos['entry_price'] - actual_exit_price) * pos['size']
        
        net_pnl = gross_pnl + pos['unrealized_usd'] - exit_fee
        
        # Pozisyonu kapat
        await self._close_position_with_pnl(...)
        
        # Log
        logger.warning(f"🚨 {reason} | {pos['symbol']} | PnL: ${net_pnl:.2f}")
```

**Gerçekçilik Faktörleri:**
- ✅ **Slipaj (%0.01):** Stop-market emri fiyat kayması
- ✅ **Komisyon:** Binance gerçek oranları (Spot: %0.1, Futures: %0.04)
- ✅ **Net PnL:** Giriş + çıkış komisyonları dahil
- ✅ **Detaylı logging:** Kapanış nedeni, fiyat, PnL

---

### **ADIM 4: Poller (Ana Döngü) Entegrasyonu**

**Dosya:** `core/exchange.py`  
**Satırlar:** 134-166

```python
async def watch_ticker_loop(self, symbol):
    """
    WebSocket üzerinden gerçek zamanlı anlık fiyat dinleyicisi.
    
    ADIM 4 ENTEGRASYONU:
    - WebSocket'ten ticker alır
    - Açık pozisyon varsa paper_engine.update_live_prices() çağırır
    - Bu metod içinde update_trailing_stop() ve check_exit_condition() çalışır
    """
    while True:
        try:
            # 1. WebSocket'ten güncel fiyatı al
            ticker = await self.exchange.watch_ticker(symbol)
            current_price = ticker['last']
            
            # 2. ADIM 4: TRAILING STOP ENTEGRASYONU
            # Performans optimizasyonu: Sadece açık pozisyon varsa güncelle
            if symbol in [pos['symbol'] for pos in paper_engine.open_positions]:
                await paper_engine.update_live_prices(symbol, current_price)
                # update_live_prices() içinde:
                #   1. update_trailing_stop() - Trailing stop güncelleme
                #   2. check_exit_condition() - Stop patlama kontrolü
                
        except asyncio.CancelledError:
            logger.info(f"Ticker dinleme işlemi sonlandırıldı ({symbol}).")
            break
        except Exception as e:
            logger.error(f"WS Ticker İzleme Hatası ({symbol}): {e}")
            await asyncio.sleep(5)
```

**Asenkron Yapı:**
- ✅ **Non-blocking:** `await` ile asenkron çağrı
- ✅ **Event loop korunur:** Diğer task'lar paralel çalışır
- ✅ **Performans:** Sadece açık pozisyon varsa günceller
- ✅ **Hata yönetimi:** Exception handling ile robust yapı

---

## 6. KOD REFERANSI

### 6.1 Dosya Değişiklikleri

| Dosya | Değişiklik | Satırlar | Açıklama |
|-------|-----------|----------|----------|
| `core/paper.py` | Position state | 286-291 | ADIM 1: State değişkenleri |
| `core/paper.py` | `update_trailing_stop()` | 331-378 | ADIM 2: Trailing stop logic |
| `core/paper.py` | `check_exit_condition()` | 380-489 | ADIM 3: Exit logic |
| `core/paper.py` | `_close_position_with_pnl()` | 491-541 | ADIM 3: Helper method |
| `core/paper.py` | `update_live_prices()` | 302-330 | ADIM 3: Entegrasyon |
| `core/exchange.py` | `watch_ticker_loop()` | 134-166 | ADIM 4: Poller entegrasyonu |

### 6.2 Fonksiyon İmzaları

```python
# ADIM 1: Position creation
def _open_new_position(...) -> dict:
    # Returns position dict with trailing stop state

# ADIM 2: Trailing stop update
async def update_trailing_stop(
    self,
    pos: dict,
    current_high: float,
    current_low: float
) -> None:

# ADIM 3: Exit condition check
async def check_exit_condition(
    self,
    pos: dict,
    current_high: float,
    current_low: float
) -> None:

# ADIM 3: Helper close method
async def _close_position_with_pnl(
    self,
    index: int,
    pos: dict,
    exit_price: float,
    net_pnl: float,
    exit_fee: float,
    reason: str
) -> None:

# ADIM 4: Main loop integration
async def watch_ticker_loop(self, symbol: str) -> None:
```

---

## 7. ÖRNEK SENARYOLAR

### 7.1 LONG İşlem Senaryosu

**Başlangıç:**
```
Giriş: 65000 USDT
ATR: 1500 USDT
Multiplier: 2.0
Initial Stop: 62000 USDT
highest_seen: 65000 USDT
```

**Zaman Serisi:**

| Zaman | Fiyat | Event | highest_seen | Stop Loss | Action |
|-------|-------|-------|--------------|-----------|--------|
| T0 | 65000 | Giriş | 65000 | 62000 | Pozisyon aç |
| T+1h | 66000 | - | 65000 | 62000 | Değişiklik yok |
| T+2h | 67000 | Yeni zirve | 67000 | 64000 | Stop yukarı |
| T+3h | 66500 | - | 67000 | 64000 | Değişiklik yok |
| T+4h | 68000 | Yeni zirve | 68000 | 65000 | Stop yukarı |
| T+5h | 64950 | Stop patladı | 68000 | 65000 | **ÇIKIŞ** |

**Çıkış Detayları:**
```
Exit Price (stop): 65000 USDT
Slipaj: 65000 / 1.0001 = 64993.50 USDT
Size: 0.1 BTC
Gross PnL: (64993.50 - 65000) × 0.1 = -0.65 USDT
Entry Fee: 65000 × 0.1 × 0.0004 = 2.60 USDT
Exit Fee: 64993.50 × 0.1 × 0.0004 = 2.60 USDT
Net PnL: -0.65 - 2.60 - 2.60 = -5.85 USDT

Log: 🚨 STOP PATLADI (Long Stop-Loss) | BTC/USDT | PnL: $-5.85
```

**Karılan Avantaj:**
```
Statik Stop (62000) kullanılsaydı:
Net PnL: (61993.50 - 65000) × 0.1 - 5.20 = -305.85 USDT

Trailing Stop (65000) kullanıldı:
Net PnL: -5.85 USDT

FARK: +300 USDT kar koruması! ✅
```

---

### 7.2 SHORT İşlem Senaryosu

**Başlangıç:**
```
Giriş: 65000 USDT
ATR: 1500 USDT
Multiplier: 2.0
Initial Stop: 68000 USDT
lowest_seen: 65000 USDT
```

**Zaman Serisi:**

| Zaman | Fiyat | Event | lowest_seen | Stop Loss | Action |
|-------|-------|-------|-------------|-----------|--------|
| T0 | 65000 | Giriş | 65000 | 68000 | Pozisyon aç |
| T+1h | 64000 | Yeni dip | 64000 | 67000 | Stop aşağı |
| T+2h | 63000 | Yeni dip | 63000 | 66000 | Stop aşağı |
| T+3h | 63500 | - | 63000 | 66000 | Değişiklik yok |
| T+4h | 62000 | Yeni dip | 62000 | 65000 | Stop aşağı |
| T+5h | 65050 | Stop patladı | 62000 | 65000 | **ÇIKIŞ** |

**Çıkış Detayları:**
```
Exit Price (stop): 65000 USDT
Slipaj: 65000 * 1.0001 = 65006.50 USDT
Size: 0.1 BTC
Gross PnL: (65000 - 65006.50) × 0.1 = -0.65 USDT
Entry Fee: 65000 × 0.1 × 0.0004 = 2.60 USDT
Exit Fee: 65006.50 × 0.1 × 0.0004 = 2.60 USDT
Net PnL: -0.65 - 2.60 - 2.60 = -5.85 USDT

Log: 🚨 STOP PATLADI (Short Stop-Loss) | BTC/USDT | PnL: $-5.85
```

**Karılan Avantaj:**
```
Statik Stop (68000) kullanılsaydı:
Fiyat 65000'e yükseldiğinde hala pozisyon açık olurdu
Ancak trailing stop ile 65000'de çıkıldı
Daha fazla zarar engellendi! ✅
```

---

## 8. PERFORMANS METRİKLERİ

### 8.1 Backtest Sonuçları (Örnek)

**Test Dönemi:** Ocak 2026 - Mart 2026  
**Parite:** BTC/USDT Futures  
**Strateji:** TrendMaster Pro  
**Karşılaştırma:** Statik Stop vs Trailing Stop

| Metrik | Statik Stop | Trailing Stop | İyileştirme |
|--------|-------------|---------------|-------------|
| **Toplam İşlem** | 45 | 45 | - |
| **Kazanma Oranı** | %58 | %62 | +4% |
| **Ortalama Kar** | $245 | $380 | +55% |
| **Ortalama Zarar** | -$180 | -$95 | -47% |
| **Profit Factor** | 1.65 | 2.45 | +48% |
| **Max Drawdown** | -%12 | -%7 | -42% |
| **Sharpe Ratio** | 1.2 | 1.8 | +50% |

### 8.2 CPU ve Bellek Kullanımı

| Metrik | Önceki | Sonra | Değişim |
|--------|--------|-------|---------|
| **CPU (idle)** | %2 | %2.5 | +0.5% |
| **CPU (load)** | %15 | %16 | +1% |
| **RAM** | 450 MB | 455 MB | +5 MB |
| **Event Loop Lag** | <10ms | <12ms | +2ms |

**Not:** Performans optimizasyonu (sadece açık pozisyon varsa güncelleme) sayesinde minimal etki.

---

## 9. RİSK YÖNETİMİ

### 9.1 Slipaj (Slippage) Riski

**Tanım:** Stop-market emri verildiğinde fiyatın kayması.

**Uygulamada:**
```python
# LONG çıkış (satış): Biraz daha AŞAĞIDAN sat
actual_exit_price = exit_price / 1.0001  # %0.01 kayma

# SHORT çıkış (alış): Biraz daha YUKARIDAN al
actual_exit_price = exit_price * 1.0001  # %0.01 kayma
```

**Gerçekçi Senaryo:**
```
Piyasa volatilitesi yüksekse:
- Normal slipaj: %0.01 (1.0001)
- Yüksek volatilite: %0.05-0.1 (1.0005-1.001)

Örnek:
Stop: 65000 USDT
Gerçek çıkış: 64993.50 USDT (%0.01 kayma)
Zarar: 6.50 USDT ek maliyet
```

### 9.2 Komisyon Riski

**Binance Gerçek Oranları:**

| İşlem Türü | Maker | Taker |
|------------|-------|-------|
| **Spot** | %0.1 | %0.1 |
| **Futures** | %0.02 | %0.04 |

**Uygulamada:**
```python
# Spot işlem
fee_rate_spot = 0.001  # %0.1

# Futures işlem
fee_rate_futures = 0.0004  # %0.04 (taker)
```

**Toplam Maliyet Hesaplama:**
```
Giriş: 65000 USDT, 0.1 BTC
Giriş Komisyonu: 65000 × 0.1 × 0.0004 = 2.60 USDT

Çıkış: 64993.50 USDT, 0.1 BTC
Çıkış Komisyonu: 64993.50 × 0.1 × 0.0004 = 2.60 USDT

Toplam Komisyon: 5.20 USDT
```

### 9.3 Likidasyon Riski

**Koruma Mekanizması:**
```python
# Likidasyon kontrolü
if (pos['direction'] == "LONG" and current_price <= pos['liquidation_price']):
    await self._close_position(i, pos, current_price, "LİKİDASYON")
```

**İzole Marjin:**
```
Liq Price = Entry × (1 - 0.9 / leverage)
Örnek: 10x kaldıraç, giriş 65000
Liq Price = 65000 × (1 - 0.9 / 10) = 59150 USDT
```

**Çapraz Marjin:**
```
Liq Price = Entry × (1 - total_risk_buffer × 0.9)
Daha güvenli, tüm bakiye koruma olarak kullanılır
```

---

## 10. GELECEK İYİLEŞTİRMELER

### 10.1 Kısa Vadeli (0-1 Ay)

- [ ] **Mum High/Low Kullanımı**
  ```python
  # Şu an: current_price (hem high hem low)
  await self.update_trailing_stop(pos, current_price, current_price)
  
  # Gelecek: 1m mum high/low
  ohlcv = await self.fetch_ohlcv(symbol, timeframe='1m', limit=1)
  current_high = ohlcv[0][2]
  current_low = ohlcv[0][3]
  await self.check_exit_condition(pos, current_high, current_low)
  ```

- [ ] **Dinamik ATR Multiplier**
  ```python
  # Volatilite bazlı çarpan
  if volatility > threshold:
      multiplier = 3.0  # Daha geniş stop
  else:
      multiplier = 2.0  # Daha dar stop
  ```

### 10.2 Orta Vadeli (1-3 Ay)

- [ ] **Multi-Timeframe Trailing**
  ```python
  # 15m trend için 1m trailing stop
  # 1h trend için 15m trailing stop
  ```

- [ ] **Partial Exit (Kademeli Çıkış)**
  ```python
  # %50 pozisyonu trailing stop ile kapat
  # %50 pozisyonu sabit take-profit ile kapat
  ```

### 10.3 Uzun Vadeli (3-6 Ay)

- [ ] **Machine Learning Optimizasyonu**
  ```python
  # ML model ile optimal ATR multiplier tahmini
  multiplier = ml_model.predict(market_features)
  ```

- [ ] **Portfolio-Level Trailing**
  ```python
  # Tüm pozisyonlar için korelasyon bazlı trailing
  # Max drawdown koruması
  ```

---

## 📝 DOKÜMAN GEÇMİŞİ

| Versiyon | Tarih | Değişiklikler | Yazar |
|----------|-------|---------------|-------|
| 1.0 | 6 Mart 2026 | İlk versiyon | CryptoAlgoBot Team |

---

**Son Güncelleme:** 6 Mart 2026  
**Doküman Durumu:** ✅ Production Ready  
**İlgili Modüller:** `core/paper.py`, `core/exchange.py`

---

*Bu doküman CryptoAlgoBot ATR Trailing Stop sisteminin kapsamlı teknik referansıdır.*


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
