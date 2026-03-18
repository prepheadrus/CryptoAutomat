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
from core.paper import paper_engine

# Router'ları import et
from api.routers.bot import router as bot_router
from api.routers.ml import router as ml_router
from api.routers.strategy import router as strategy_router
from api.routers.data import router as data_router
from api.routers.system import router as system_router
from api.routers.strategy_builder import router as strategy_builder_router
from api.routers.backtest import router as backtest_router
from api.routers.trades import router as trades_router


# ============================================================================
# LIFESPAN EVENTS
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI uygulama yaşam döngüsü."""
    # ===== STARTUP =====
    logger.info("🚀 FastAPI Sunucusu başlatılıyor...")

    # 1. Event Bus Başlat
    from shared.events import event_bus
    await event_bus.start(num_workers=5)

    # 2. PaperTrader Handler'ları Kaydet
    await paper_engine.start_event_handlers()

    # 3. Veritabanı bağlantısı
    await db_manager.connect()

    # 4. Yarım kalan indirme görevlerini geri yükle
    await exchange_manager.load_tasks_from_db()

    # 5. Bot task'larını başlat
    # ÖNCE: config.yaml'dan oku
    symbols = CONFIG.get('trading', {}).get('symbols', [])

    if not symbols:
        # YENİ: config.yaml boşsa, DB'den otomatik yükle
        logger.info("🔄 [AUTO-SYNC] config.yaml boş, DB'den semboller yükleniyor...")
        try:
            db_symbols = await db_manager.get_symbols_with_data()
            if db_symbols:
                symbols = db_symbols
                logger.info(f"✅ [AUTO-SYNC] DB'den {len(symbols)} sembol yüklendi!")
            else:
                logger.info("ℹ️ DB'de veri yok - Dashboard'dan bot başlatabilirsiniz")
        except Exception as e:
            logger.error(f"❌ [AUTO-SYNC] DB'den sembol yükleme hatası: {e}")

    tasks = []
    for symbol in symbols:
        tasks.append(asyncio.create_task(exchange_manager.watch_ticker_loop(symbol)))
        tasks.append(asyncio.create_task(exchange_manager.run_strategy_poller(symbol)))

    logger.info(f"✅ {len(tasks)} bot task'ı ve Event Engine başlatıldı")

    # ===== WFO (Walk-Forward Optimization) Başlat =====
    if CONFIG.get('wfo', {}).get('enabled', False):
        logger.info("🧠 [WFO] Otonom optimizasyon sistemi başlatılıyor...")
        try:
            from core.wfo_engine import start_wfo_background_task
            from strategy.manager import StrategyManager

            wfo_tasks = []
            for symbol in symbols:  # symbols değişkenini kullan
                strategy_id = paper_engine.active_strategies.get(symbol)
                if strategy_id:
                    strategy_instance = StrategyManager.get_strategy(strategy_id)
                    if strategy_instance:
                        timeframe = paper_engine.active_timeframes.get(symbol, '1m')
                        wfo_task = asyncio.create_task(
                            start_wfo_background_task(
                                symbol=symbol,
                                timeframe=timeframe,
                                strategy_class=strategy_instance.__class__,
                                param_grid=None,
                                optimization_metric=CONFIG['wfo'].get('optimization_metric', 'sharpe'),
                                n_trials=50
                            )
                        )
                        wfo_tasks.append(wfo_task)

            if wfo_tasks:
                logger.info(f"🎯 [WFO] {len(wfo_tasks)} sembol için otonom optimizasyon aktif")
        except Exception as e:
            logger.error(f"❌ [WFO] Başlatma hatası: {e}")
    else:
        logger.info("ℹ️ [WFO] Otonom optimizasyon devre dışı")

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ROUTERS
# ============================================================================

app.include_router(system_router)
logger.info("✅ System router eklendi")

app.include_router(bot_router)
logger.info("✅ Bot router eklendi")

app.include_router(ml_router)
logger.info("✅ ML router eklendi")

app.include_router(strategy_router)
logger.info("✅ Strategy router eklendi")

app.include_router(data_router)
logger.info("✅ Data router eklendi")

app.include_router(strategy_builder_router)
logger.info("✅ Strategy Builder router eklendi")

app.include_router(backtest_router)
logger.info("✅ Backtest router eklendi")

app.include_router(trades_router)
logger.info("✅ Trades router eklendi")

# ============================================================================
# FRONTEND (STATIC FILES)
# ============================================================================

try:
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
    logger.info("✅ Frontend dosyaları mount edildi")
except Exception as e:
    logger.warning(f"⚠️ Frontend mount hatası: {e}")

# ============================================================================
# MAIN ENTRY POINT
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

# ============================================================================
# FINAL LOG
# ============================================================================

logger.info("🎉 [MİMARİ] Faz 2 Tamamlandı: API Katmanı Modülerleştirildi (1374 satır -> ~160 satır)")
