# 🏗️ Event-Driven Architecture (EDA)

**Son Güncelleme:** Mart 2026  
**Durum:** ✅ Production Ready  
**Kategori:** Mimari (Architecture)

---

## 🎯 Genel Bakış

**Event-Driven Architecture (EDA - Olay Güdümlü Mimari)**, modüller arası sıkı bağımlılığı (tight coupling) çözmek için uygulanan mimari pattern'dir.

### **Temel Felsefe:**
> "Modüller birbirini doğrudan çağırmaz. Bunun yerine, olayları (events) yayınlar (publish) ve dinler (subscribe)."

### **Önceki Durum (Tight Coupling):**
```
┌──────────────┐     direct call     ┌──────────────┐
│  Exchange    │────────────────────▶│  PaperTrader │
│  Manager     │   paper_engine.     │              │
│              │   process_bot_      │              │
│              │   signal()          │              │
└──────────────┘                     └──────────────┘
       ▲                                    │
       │                                    │
       └────────────────────────────────────┘
          CIRCULAR DEPENDENCY! ❌
```

### **Şimdiki Durum (Loose Coupling):**
```
┌──────────────┐
│  Exchange    │
│  Manager     │
└──────┬───────┘
       │ SignalGeneratedEvent
       │ (Publish)
       ▼
┌─────────────────────────────────────────┐
│         EVENT BUS (Pub/Sub)             │
│  - signal.generated                     │
│  - position.opened                      │
│  - position.closed                      │
│  - bot.started                          │
│  - bot.stopped                          │
└───────────────┬─────────────────────────┘
                │
                │ (Subscribe)
                ▼
        ┌───────────────┐
        │ PaperTrader   │
        │ (Handler)     │
        └───────────────┘
```

---

## 🏛️ Mimari Bileşenler

### **1. Event Bus (Pub/Sub)**

**Dosya:** `shared/events/event_bus.py`

```python
from shared.events import event_bus

# Subscribe (Abone Ol)
event_bus.subscribe("signal.generated", on_signal_generated)

# Publish (Yayınla)
await event_bus.publish(event)
```

**Özellikler:**
- ✅ Singleton pattern (tek instance)
- ✅ Asenkron event işleme
- ✅ 3 parallel worker
- ✅ Queue-based (max 10,000 event)
- ✅ Wildcard subscription (`position.*`, `*`)
- ✅ Priority-based handlers
- ✅ Error isolation

---

### **2. Event Definitions**

**Dosya:** `shared/events/events.py`

**Event Kategorileri:**

| Kategori | Event Tipleri |
|----------|--------------|
| **BOT_EVENTS** | `bot.started`, `bot.stopped`, `bot.error` |
| **SIGNAL_EVENTS** | `signal.generated`, `signal.confirmed` |
| **POSITION_EVENTS** | `position.opened`, `position.closed` |
| **TRADE_EVENTS** | `trade.recorded` |
| **ML_EVENTS** | `ml.training_started`, `ml.prediction` |
| **RISK_EVENTS** | `risk.killswitch_activated` |
| **DATA_EVENTS** | `data.download_started`, `candle.closed` |
| **SYSTEM_EVENTS** | `system.started`, `system.health_check` |

**Örnek Event:**
```python
from shared.events.events import SignalGeneratedEvent

event = SignalGeneratedEvent(
    bot_id="bot_123",
    symbol="BTC/USDT",
    signal=2,  # LONG
    price=50000.0,
    timeframe="1m",
    indicators={
        'RSI_14': 65.0,
        'EMA_20': 49500.0,
        'ATR_14': 500.0
    }
).to_event()

await event_bus.publish(event)
```

---

### **3. Event Handlers**

**Dosya:** `core/paper.py`

```python
class PaperTrader:
    async def start_event_handlers(self):
        """Event handler'ları başlat"""
        event_bus.subscribe("signal.generated", self.on_signal_generated)
        event_bus.subscribe("position.opened", self.on_position_opened)
        event_bus.subscribe("position.closed", self.on_position_closed)
    
    async def on_signal_generated(self, event):
        """
        Signal Generated Event Handler.
        Exchange'den gelen sinyali dinler ve işlem açar.
        """
        payload = event.payload
        bot_id = payload['bot_id']
        signal = payload['signal']
        
        # HOLD ise işlem yapma
        if signal == SignalType.HOLD.value:
            return
        
        # HTF filter
        # Risk kontrolü
        # Pozisyon aç
        position = self.position_manager.open_position(...)
```

---

## 🔄 Event Flow (Adım Adım)

### **1. Exchange Manager - Sinyal Üretir**

**Dosya:** `core/exchange.py`

```python
async def _process_bot_task(self, paper_engine, bot_id, df, current_price, ...):
    # Strateji sinyali üret
    strategy_signal = strategy.generate_signal(latest_candle)
    
    # EVENT-DRIVEN: SignalGeneratedEvent yayınla
    event = SignalGeneratedEvent(
        bot_id=bot_id,
        symbol=symbol,
        signal=strategy_signal,
        price=current_price,
        indicators={...}
    ).to_event()
    
    # Event Bus'a yayınla (Pub/Sub)
    await event_bus.publish(event)
```

---

### **2. Event Bus - Event'i Dağıtır**

```python
# Event Bus internal
async def _process_event(event, worker_name):
    handlers = await self._get_handlers_for_event(event.type)
    
    for handler in handlers:
        if asyncio.iscoroutinefunction(handler):
            await handler(event)
        else:
            handler(event)
```

---

### **3. PaperTrader - Event'i Dinler**

```python
async def on_signal_generated(self, event):
    payload = event.payload
    bot_id = payload['bot_id']
    signal = payload['signal']
    
    # 1. Bot çalışıyor mu kontrol et
    if not self.bot_manager.is_bot_running(bot_id):
        return
    
    # 2. HTF filter
    htf_trends = metadata.get('htf_trends', {})
    if htf_trends.get(major_htf) == 'BEAR' and signal == SignalType.LONG.value:
        return  # LONG reddedildi
    
    # 3. Risk kontrolü
    if not self.risk_engine.can_open_position(...):
        return
    
    # 4. Pozisyon aç (PositionManager'a delegate)
    position = self.position_manager.open_position(
        bot_id=bot_id,
        symbol=symbol,
        direction="LONG" if signal == 2 else "SHORT",
        entry_price=price,
        size=size,
        leverage=leverage,
        stop_loss=stop_loss,
        take_profit=take_profit
    )
```

---

### **4. PositionManager - Pozisyon Açar**

**Dosya:** `core/trading/position_manager.py`

```python
def open_position(self, bot_id, symbol, direction, entry_price, size, ...):
    # Position Value Object oluştur
    position = Position(
        bot_id=bot_id,
        symbol=symbol,
        direction=direction,
        entry_price=entry_price,
        size=size,
        leverage=leverage,
        opened_at=datetime.utcnow()
    )
    
    # Position'ı kaydet
    self.positions[bot_id] = position
    
    # Event yayınla
    event = PositionOpenedEvent(
        bot_id=bot_id,
        symbol=symbol,
        direction=direction,
        entry_price=entry_price,
        size=size
    ).to_event()
    
    await event_bus.publish(event)
    
    return position
```

---

## 📊 Event-Driven Avantajları

| Özellik | Önceki (Direct Calls) | Yeni (Event-Driven) |
|---------|----------------------|---------------------|
| **Coupling** | Tight (direct imports) | Loose (event bus) |
| **Circular Dependency** | Var (paper ↔ exchange) | Yok |
| **Testability** | Zor (mocking required) | Kolay (event replay) |
| **Scalability** | Zor (synchronous) | Kolay (async queue) |
| **Extensibility** | Kod değişikliği gerek | Yeni subscriber ekle |
| **Debugging** | Stack trace karmaşık | Event log ile trace |
| **Resilience** | Hata yayılır | Hata izole |

---

## 🧪 Örnek Kullanım

### **1. Event'e Abone Ol**

```python
from shared.events import event_bus, on_event

# Decorator ile
@on_event("position.opened")
async def handle_position_opened(event):
    print(f"Pozisyon açıldı: {event.payload}")

# Veya manuel
event_bus.subscribe("signal.generated", my_handler)
```

---

### **2. Event Yayınla**

```python
from shared.events import event_bus, Event

event = Event(
    type="bot.started",
    payload={
        'bot_id': 'bot_123',
        'symbol': 'BTC/USDT',
        'strategy_id': 'trend_master'
    },
    source="bot_manager"
)

await event_bus.publish(event)
```

---

### **3. Event Bekle (Blocking)**

```python
# Belirli bir event'i bekle
event = await event_bus.wait_for_event(
    "bot.started",
    timeout=5.0
)

print(f"Bot başlatıldı: {event.payload}")
```

---

## 🔍 Debug ve Logging

### **Event Log Örneği:**

```
2026-03-09 16:01:14 | INFO | Event Bus initialized (Singleton)
2026-03-09 16:01:14 | INFO | Position Manager initialized
2026-03-09 16:01:14 | INFO | Risk Engine initialized
2026-03-09 16:01:14 | INFO | Bot Manager initialized
2026-03-09 16:01:14 | INFO | PaperTrader (Refactored) initialized
2026-03-09 16:01:15 | INFO | Event handlers başlatıldı
2026-03-09 16:01:16 | 📤 Signal event published: bot_123 signal=2
2026-03-09 16:01:16 | 📬 Signal event received: bot_123 signal=2
2026-03-09 16:01:16 | ✅ Pozisyon açıldı: bot_123 LONG @ 50000.00
2026-03-09 16:01:16 | 📊 Pozisyon açıldı: bot_123 BTC/USDT
```

---

## ⚙️ Konfigürasyon

### **Event Bus Ayarları:**

```python
# shared/events/event_bus.py içinde
class EventBus:
    def __init__(self):
        self._max_queue_size = 10000  # Max queue size
        self._num_workers = 3  # Parallel worker sayısı
```

---

## 🚨 Sorun Giderme

### **Sorun 1: Event Handler Çağrılmıyor**

**Sebep:** Subscription eksik veya yanlış event tipi

**Çözüm:**
```python
# Subscription kontrolü
subscribers = event_bus.get_subscribers("signal.generated")
print(f"Subscribers: {subscribers}")

# Event tipi kontrolü
print(f"Event type: {event.type}")
```

---

### **Sorun 2: Circular Dependency Hatası**

**Sebep:** Module import döngüsü

**Çözüm:**
```python
# ❌ YANLIŞ
from core.paper import paper_engine

# ✅ DOĞRU
from shared.events import event_bus
# Event Bus kullan (import cycle yok)
```

---

### **Sorun 3: Event Queue Dolu**

**Sebep:** Event'ler çok hızlı yayınlanıyor, handler'lar yetişemiyor

**Çözüm:**
```python
# Worker sayısını artır
await event_bus.start(num_workers=5)

# Veya queue size'ı artır (event_bus.py içinde)
self._max_queue_size = 20000
```

---

## 📚 İlgili Dokümanlar

- **Value Objects:** `architecture/value_objects.md`
- **Position Manager:** `features/position_manager.md`
- **Risk Engine:** `features/risk_engine.md`
- **Bot Manager:** `features/bot_manager.md`

---

*Bu doküman Event-Driven Architecture'nin Mart 2026 versiyonunu açıklar.*  
*Güncellemeler için `shared/events/` ve `core/paper.py` dosyalarını kontrol edin.*
