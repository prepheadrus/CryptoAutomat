# 🌐 API Modularization (FastAPI)

**Son Güncelleme:** Mart 2026  
**Durum:** ✅ Production Ready  
**Kategori:** Architecture

---

## 🎯 Genel Bakış

**API Modularization**, 1,374 satırlık monolitik `api/server.py` dosyasını modern FastAPI standartlarına göre modüler hale getirme sürecidir.

### **Önceki Durum (Monolithic):**
```
┌─────────────────────────────────────────┐
│    api/server.py (1,374 satır)          │
├─────────────────────────────────────────┤
│ ❌ 33 endpoint tek dosyada              │
│ ❌ Tüm business logic iç içe            │
│ ❌ Pydantic modeller dağınık            │
│ ❌ Test edilemez                        │
│ ❌ Tight coupling                       │
└─────────────────────────────────────────┘
```

### **Şimdiki Durum (Modular):**
```
┌─────────────────────────────────────────┐
│    api/server.py (161 satır)            │
│    - Router registration                │
│    - Lifespan events                    │
│    - CORS, static files                 │
└─────────────────────────────────────────┘
            ↓ includes
┌─────────────────────────────────────────┐
│         ROUTERS (4 yeni)                │
│ bot.py │ ml.py │ strategy.py │ data.py │
└─────────────────────────────────────────┘
            ↓ uses
┌─────────────────────────────────────────┐
│         SERVICES (4 yeni)               │
│ BotService │ MLService │ DataService   │
└─────────────────────────────────────────┘
            ↓ validates
┌─────────────────────────────────────────┐
│         SCHEMAS (4 yeni)                │
│ Bot │ ML │ Strategy │ Data Schemas     │
└─────────────────────────────────────────┘
```

---

## 🏗️ Mimari Katmanlar

### **1. Schemas Layer (api/schemas/)**

**Sorumluluk:** Request/response validation (Pydantic models)

**Dosyalar:**
- `bot.py` - Bot işlemleri için schemalar
- `ml.py` - ML işlemleri için schemalar
- `strategy.py` - Strateji işlemleri için schemalar
- `data.py` - Veri işlemleri için schemalar

**Örnek:**
```python
# api/schemas/bot.py
from pydantic import BaseModel, Field
from enum import Enum

class MarketType(str, Enum):
    SPOT = "spot"
    SWAP = "swap"
    FUTURE = "future"

class BotStartRequest(BaseModel):
    symbol: str = Field(..., description="Sembol")
    strategy_id: str = Field(..., description="Strateji ID")
    timeframe: str = Field(default="1m", description="Zaman dilimi")
    market_type: MarketType = Field(default=MarketType.SWAP)
```

---

### **2. Service Layer (api/services/)**

**Sorumluluk:** Business logic implementation

**Dosyalar:**
- `bot_service.py` - Bot business logic
- `ml_service.py` - ML business logic
- `data_service.py` - Veri business logic
- `strategy_service.py` - Strateji business logic

**Örnek:**
```python
# api/services/bot_service.py
class BotService:
    def __init__(self):
        self.paper_engine = paper_engine
        self.exchange_manager = exchange_manager
    
    async def start_bot(self, request: BotStartRequest) -> Dict[str, Any]:
        # Business logic burada
        bot_id = self.paper_engine.start_bot(...)
        return {"status": "success", "bot_id": bot_id}
```

---

### **3. Router Layer (api/routers/)**

**Sorumluluk:** HTTP endpoint definitions

**Dosyalar:**
- `bot.py` - Bot endpoints (6 endpoint)
- `ml.py` - ML endpoints (5 endpoint)
- `strategy.py` - Strateji endpoints (2 endpoint)
- `data.py` - Veri endpoints (8 endpoint)

**Örnek:**
```python
# api/routers/bot.py
from fastapi import APIRouter
from api.schemas.bot import BotStartRequest
from api.services.bot_service import BotService

router = APIRouter(prefix="/api/v1/bot", tags=["Bot"])
bot_service = BotService()

@router.post("/start")
async def start_bot(request: BotStartRequest):
    return await bot_service.start_bot(request)
```

---

### **4. Server Layer (api/server.py)**

**Sorumluluk:** FastAPI app initialization, router registration

**İçerik:**
- FastAPI app init
- CORS middleware
- Lifespan events (startup/shutdown)
- Router registration
- Static files mount

**Örnek:**
```python
# api/server.py
from fastapi import FastAPI
from api.routers.bot import router as bot_router
from api.routers.ml import router as ml_router

app = FastAPI(title="CryptoAlgoBot Core API")

# Router registration
app.include_router(bot_router)
app.include_router(ml_router)

# Static files
app.mount("/", StaticFiles(directory="frontend"), name="frontend")
```

---

## 📊 Endpoint Haritası

### **Bot Endpoints (6)**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/bot/start` | Bot başlat |
| POST | `/api/v1/bot/stop` | Bot durdur |
| POST | `/api/v1/bot/resume` | Bot devam ettir |
| POST | `/api/v1/bot/remove` | Bot sil |
| GET | `/api/v1/bot/status` | Bot durumu al |
| GET | `/api/v1/bots/list` | Tüm botları listele |

---

### **ML Endpoints (5)**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ml/train` | ML model eğit |
| GET | `/api/v1/ml/status` | Eğitim durumu al |
| GET | `/api/v1/ml/training-history` | Eğitim geçmişi |
| DELETE | `/api/v1/ml/training-history` | Geçmişi sil |
| GET | `/api/v1/ml/check-model` | Model kontrol et |

---

### **Strategy Endpoints (2)**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/strategies` | Strateji listesi |
| POST | `/api/v1/strategy/select` | Strateji seç |

---

### **Data Endpoints (8)**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/data/history-status` | Geçmiş durumu |
| POST | `/api/v1/data/download-history` | Veri indir |
| POST | `/api/v1/data/stop-download` | İndirmeyi durdur |
| POST | `/api/v1/data/resume-download` | İndirmeyi devam ettir |
| GET | `/api/v1/data/active-downloads` | Aktif indirmeler |
| POST | `/api/v1/data/delete-task` | Veri sil |
| POST | `/api/v1/data/toggle-pause` | Duraklat/devam |
| GET | `/api/v1/data/symbols-with-data` | Veritabanı sembolleri |

---

## 🔧 Kullanım Örnekleri

### **1. Bot Başlatma**

**Request:**
```http
POST /api/v1/bot/start
Content-Type: application/json

{
    "symbol": "BTC/USDT:USDT",
    "strategy_id": "trend_master",
    "timeframe": "1m",
    "market_type": "future",
    "margin_type": "isolated"
}
```

**Response:**
```json
{
    "status": "success",
    "bot_id": "BTC/USDT:USDT_trend_master_1m_1",
    "message": "Bot başlatıldı: BTC/USDT:USDT_trend_master_1m_1"
}
```

---

### **2. ML Model Eğitimi**

**Request:**
```http
POST /api/v1/ml/train
Content-Type: application/json

{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "limit": 1000,
    "model_type": "xgboost"
}
```

**Response:**
```json
{
    "status": "success",
    "message": "ML modeli eğitimi başlatıldı (BTC/USDT)...",
    "model_path": "artifacts/models/xgb_model_btcusdt_1h.json"
}
```

---

### **3. Strateji Değiştirme**

**Request:**
```http
POST /api/v1/strategy/select?symbol=BTC/USDT&strategy_id=trend_master&timeframe=1m
```

**Response:**
```json
{
    "status": "success",
    "symbol": "BTC/USDT",
    "active_id": "trend_master",
    "active_timeframe": "1m",
    "market_type": "swap",
    "margin_type": "isolated"
}
```

---

## 📈 İstatistikler

| Metrik | Önce | Sonra | Değişim |
|--------|------|-------|---------|
| **server.py Satır** | 1,374 | 161 | -88% |
| **Toplam Dosya** | 4 | 19 | +15 |
| **Schemas** | 0 | 4 dosya | +510 satır |
| **Services** | 0 | 4 dosya | +575 satır |
| **Routers** | 2 | 6 dosya | +240 satır |

---

## 🎯 Avantajlar

### **1. Single Responsibility**
- Her router sadece endpoint tanımlar
- Her service sadece business logic içerir
- Her schema sadece validation yapar

### **2. Testability**
```python
# Service layer kolayca test edilebilir
async def test_bot_service():
    service = BotService()
    result = await service.start_bot(request)
    assert result["status"] == "success"
```

### **3. Maintainability**
- Değişiklikler lokalize
- Hata ayıklama kolay
- Kod okuma kolay

### **4. Scalability**
- Yeni endpoint eklemek kolay
- Service layer bağımsız genişleyebilir
- Router'lar bağımsız test edilebilir

---

## 🚨 Sorun Giderme

### **Sorun 1: Import Hatası**

**Hata:**
```
ModuleNotFoundError: No module named 'api.schemas'
```

**Çözüm:**
```bash
# __init__.py dosyalarını kontrol et
ls api/schemas/__init__.py
ls api/services/__init__.py
```

---

### **Sorun 2: Endpoint Bulunamadı**

**Hata:**
```
404 Not Found: /api/v1/bot/start
```

**Çözüm:**
```python
# server.py'de router registration kontrol et
app.include_router(bot_router)  # Bu satır var mı?
```

---

### **Sorun 3: Validation Hatası**

**Hata:**
```
422 Unprocessable Entity: field required
```

**Çözüm:**
```python
# Request body'de required field'ları kontrol et
# BotStartRequest: symbol ve strategy_id required
```

---

## 📚 İlgili Dokümanlar

- **Event-Driven Architecture:** `architecture/event_driven_architecture.md`
- **Value Objects:** `architecture/value_objects.md`
- **Position Manager:** `features/position_manager.md`
- **Risk Engine:** `features/risk_engine.md`
- **Bot Manager:** `features/bot_manager.md`

---

## 📖 Kaynaklar

### **FastAPI Dokümantasyonu:**
- [FastAPI Official Docs](https://fastapi.tiangolo.com/)
- [APIRouter](https://fastapi.tiangolo.com/tutorial/bigger-applications/#apirouter)
- [Pydantic Models](https://fastapi.tiangolo.com/tutorial/pydantic-models/)

### **Best Practices:**
- [FastAPI Project Structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [Testing](https://fastapi.tiangolo.com/tutorial/testing/)

---

*Bu doküman API Modularization'ın Mart 2026 versiyonunu açıklar.*  
*Güncellemeler için `api/` klasörünü kontrol edin.*
