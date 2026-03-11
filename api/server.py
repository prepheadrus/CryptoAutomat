"""
CryptoAlgoBot FastAPI Server

Modern, modüler API sunucusu.
Router'lar, servisler ve şemalar ile yapılandırılmış.

Mimari:
- api/routers/: FastAPI router'ları (endpoint'ler)
- api/services/: Business logic
- api/schemas/: Pydantic models (request/response)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import asyncio

from core.logger import logger
from core.config import CONFIG
from core.exchange import exchange_manager
from data.database import db_manager

# Router'ları import et
from api.routers.bot import router as bot_router
from api.routers.ml import router as ml_router
from api.routers.strategy import router as strategy_router
from api.routers.data import router as data_router
from api.routers.system import router as system_router
from api.routers.strategy_builder import router as strategy_builder_router
from api.routers.backtest import router as backtest_router


# ============================================================================
# LIFESPAN EVENTS
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI uygulama yaşam döngüsü.
    Startup ve shutdown event'lerini yönetir.
    """
    # ===== STARTUP =====
    logger.info("🚀 FastAPI Sunucusu başlatılıyor...")
    
    # 1. Event Bus Başlat (Pub/Sub Motoru)
    from shared.events import event_bus
    await event_bus.start(num_workers=5)
    
    # 2. PaperTrader Handler'ları Kaydet
    from core.paper import paper_engine
    await paper_engine.start_event_handlers()
    
    # Veritabanı bağlantısı
    await db_manager.connect()
    
    # Yarım kalan indirme görevlerini geri yükle
    await exchange_manager.load_tasks_from_db()
    
    # Bot task'larını başlat
    tasks = []
    for symbol in CONFIG['trading']['symbols']:
        tasks.append(asyncio.create_task(exchange_manager.watch_ticker_loop(symbol)))
        tasks.append(asyncio.create_task(exchange_manager.run_strategy_poller(symbol)))
    
    logger.info(f"✅ {len(tasks)} bot task'ı ve Event Engine başlatıldı")
    
    yield
    
    # ===== SHUTDOWN =====
    logger.info("🛑 FastAPI Sunucusu kapatılıyor...")
    
    # Event Bus Durdur
    from shared.events import event_bus
    await event_bus.stop()
    
    # Borsa bağlantısını kapat
    await exchange_manager.close()
    logger.info("✅ Borsa bağlantısı kapatıldı")
    
    # Veritabanı bağlantısını kapat
    await db_manager.close()
    logger.info("✅ Veritabanı bağlantısı kapatıldı")


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="CryptoAlgoBot Core API",
    description="Bot ile Arayüz (Dashboard) arasında güvenli ve hızlı veri köprüsü.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme için. Production'da dashboard URL'si ile değiştirin.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ROUTERS
# ============================================================================

# System (dashboard metrics, status, config)
app.include_router(system_router)
logger.info("✅ System router eklendi")

# Bot yönetimi
app.include_router(bot_router)
logger.info("✅ Bot router eklendi")

# ML işlemleri
app.include_router(ml_router)
logger.info("✅ ML router eklendi")

# Strateji yönetimi
app.include_router(strategy_router)
logger.info("✅ Strategy router eklendi")

# Veri yönetimi
app.include_router(data_router)
logger.info("✅ Data router eklendi")

# Strateji oluşturucu (No-Code)
app.include_router(strategy_builder_router)
logger.info("✅ Strategy Builder router eklendi")

# Backtest
app.include_router(backtest_router)
logger.info("✅ Backtest router eklendi")

# ============================================================================
# STATIC FILES (Frontend)
# ============================================================================

# Frontend static dosyalarını mount et
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
logger.info("✅ Frontend static dosyaları mount edildi")

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/api/v1/status")
async def get_system_status():
    """Sistem durumunu döner."""
    return {
        "status": "online",
        "environment": CONFIG['bot']['environment'],
        "exchange": CONFIG['trading']['exchange'],
        "tracking_symbols": CONFIG['trading']['symbols']
    }

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
