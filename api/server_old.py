"""
CryptoAlgoBot FastAPI Server

Modern, modüler API sunucusu.
Router'lar, servisler ve şemalar ile yapılandırılmış.

Mimari:
- api/routers/: FastAPI router'ları (endpoint'ler)
- api/services/: Business logic
- api/schemas/: Pydantic models (request/response)
"""
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import asyncio
from datetime import datetime

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

    # ===== WFO (Walk-Forward Optimization) Başlat =====
    # Config'de wfo.enabled == True ise arka plan optimizasyon görevlerini başlat
    if CONFIG.get('wfo', {}).get('enabled', False):
        logger.info("🧠 [WFO] Otonom optimizasyon sistemi başlatılıyor...")

        try:
            from core.wfo_engine import start_wfo_background_task
            from strategy.manager import StrategyManager

            # Her aktif sembol için WFO görevi başlat
            wfo_tasks = []
            for symbol in CONFIG['trading']['symbols']:
                # Sembol için aktif stratejiyi bul
                strategy_id = paper_engine.active_strategies.get(symbol)
                if strategy_id:
                    strategy_instance = StrategyManager.get_strategy(strategy_id)
                    if strategy_instance:
                        timeframe = paper_engine.active_timeframes.get(symbol, '1m')

                        # WFO background task başlat (param_grid=None → Auto-Grid)
                        wfo_task = asyncio.create_task(
                            start_wfo_background_task(
                                symbol=symbol,
                                timeframe=timeframe,
                                strategy_class=strategy_instance.__class__,
                                param_grid=None,  # ZERO-TOUCH: Auto-Grid otomatik oluşturur
                                data_fetcher=None,  # Varsayılan veri çekici kullanılacak
                                optimization_metric=CONFIG['wfo'].get('optimization_metric', 'sharpe'),
                                n_trials=50
                            )
                        )
                        wfo_tasks.append(wfo_task)
                        logger.info(f"✅ [WFO] {symbol} ({timeframe}) için otonom optimizasyon görevi başlatıldı")

            if wfo_tasks:
                logger.info(f"🎯 [WFO] {len(wfo_tasks)} sembol için otonom optimizasyon aktif")
            else:
                logger.warning("⚠️ [WFO] Aktif strateji bulunamadı, optimizasyon görevleri başlatılmadı")

        except Exception as e:
            logger.error(f"❌ [WFO] Başlatma hatası: {e}")
            logger.debug(f"Traceback: {e}", exc_info=True)
    else:
        logger.info("ℹ️ [WFO] Otonom optimizasyon devre dışı (config.yaml: wfo.enabled)")

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

# Trades
app.include_router(trades_router)
logger.info("✅ Trades router eklendi")

# ============================================================================
# STRATEGY CHART DATA (BOT ID & STRATEGY ID SUPPORT)
# ============================================================================

@app.get("/api/v1/strategy-chart-data")
async def get_strategy_chart_data(bot_id: str = None, strategy_id: str = None, symbol: str = None):
    """
    Belirli bir bot veya strateji'ye ait grafik verilerini döndürür.
    Hem bot_id hem de strategy_id destekler.

    Args:
        bot_id: Bot ID (opsiyonel)
        strategy_id: Strateji ID (opsiyonel)
        symbol: Sembol (opsiyonel)

    Returns:
        Grafik verisi (OHLCV + sinyaller)
    """
    # Bu endpoint strategy_service tarafından yönetilecek
    from api.services.strategy_service import StrategyService
    strategy_service = StrategyService()

    return await strategy_service.get_chart_data(
        bot_id=bot_id,
        strategy_id=strategy_id,
        symbol=symbol
    )


# ============================================================================
# FRONTEND (STATIC FILES)
# ============================================================================

# Frontend dosyalarını mount et (dashboard)
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

        df = storage.load_ohlcv(symbol, timeframe, start_date, end_date)

        if df is not None and not df.empty:
            candles = df[['timestamp', 'open', 'high', 'low', 'close', 'volume']].values.tolist()
            logger.info(f"  ✅ {len(candles)} mum flat file'dan yüklendi")
        else:
            # Flat file yoksa DB'den çek
            logger.info(f"  ⚠️ Flat file bulunamadı, DB'den çekiliyor...")
            candles = await db_manager.get_klines(symbol, timeframe, limit=1000)
            logger.info(f"  ✅ {len(candles) if candles else 0} mum DB'den bulundu")
    except Exception as e:
        logger.warning(f"  ⚠️ Flat file okuma hatası, DB'den çekiliyor: {e}")
        candles = await db_manager.get_klines(symbol, timeframe, limit=1000)
        logger.info(f"  ✅ {len(candles) if candles else 0} mum bulundu")

    # 3. Sadece bu bota ait işlemleri filtrele
    open_positions_for_bot = []
    for p in paper_engine.open_positions:
        try:
            # open_positions dict olabilir
            p_bot_id = p.get('bot_id') if isinstance(p, dict) else (p.bot_id if hasattr(p, 'bot_id') else None)

            if p_bot_id == bot_id:
                # Pozisyon objesi ise to_dict() çağır
                if hasattr(p, 'to_dict'):
                    pos_dict = p.to_dict()
                    logger.info(f"  Pozisyon to_dict: {list(pos_dict.keys())}")
                else:
                    pos_dict = p
                    logger.info(f"  Pozisyon dict: {list(pos_dict.keys())}")

                # opened_at field'ı yoksa ekle
                if 'opened_at' not in pos_dict:
                    pos_dict['opened_at'] = int(datetime.now().timestamp())
                elif isinstance(pos_dict['opened_at'], str):
                    try:
                        pos_dict['opened_at'] = int(datetime.fromisoformat(pos_dict['opened_at'].replace('Z', '+00:00')).timestamp())
                    except:
                        pass

                # Mevcut fiyatı ekle (active_bots'tan)
                bot_meta = paper_engine.active_bots.get(bot_id, {})
                pos_dict['current_price'] = bot_meta.get('last_price', pos_dict.get('entry_price', 0))

                # Unrealized PnL hesapla
                entry = pos_dict.get('entry_price', 0)
                current = pos_dict['current_price']
                size = pos_dict.get('size', 0)
                direction = pos_dict.get('direction', 'LONG')

                if entry > 0 and size > 0:
                    if direction == 'LONG':
                        pnl = (current - entry) * size
                    else:
                        pnl = (entry - current) * size
                    pos_dict['unrealized_usd'] = pnl
                    pos_dict['pnl_percent'] = (pnl / (entry * size)) * 100 if entry * size > 0 else 0

                logger.info(f"  ✅ Pozisyon eklendi: {pos_dict.get('symbol')} @ {pos_dict.get('entry_price')}")
                open_positions_for_bot.append(pos_dict)
        except Exception as e:
            logger.error(f"  ❌ Pozisyon işleme hatası: {e}")
            logger.error(f"  Pozisyon: {p}")
            import traceback
            traceback.print_exc()

    # Trade objeleri dataclass olduğu için .get() yerine direkt attribute erişimi kullan
    # trade_history hem liste hem de TradeHistory objesi olabilir
    if hasattr(paper_engine.trade_history, 'trades'):
        # TradeHistory objesi
        trades_list = paper_engine.trade_history.trades
    else:
        # Direkt liste
        trades_list = paper_engine.trade_history

    closed_trades_for_bot = [t for t in trades_list if hasattr(t, 'bot_id') and t.bot_id == bot_id]
    logger.info(f"  ✅ {len(open_positions_for_bot)} açık pozisyon, {len(closed_trades_for_bot)} kapalı işlem")

    # Format candles
    formatted_candles = _format_candles(candles)

    return {
        "status": "success",
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": formatted_candles,
        "open_positions": open_positions_for_bot,
        "trades": closed_trades_for_bot,
        "bot_id": bot_id
    }


async def _get_chart_data_by_strategy_id(strategy_id: str, symbol_filter: str = None):
    """Strateji ID bazlı grafik verisi"""
    from core.logger import logger

    logger.info(f"📊 Strateji chart data isteniyor: strategy_id={strategy_id}, symbol={symbol_filter}")

    # 1. Bu stratejiye ait tüm botları bul
    matching_bots = []
    for bot_id, bot_info in paper_engine.active_bots.items():
        if bot_info.get('strategy_id') == strategy_id:
            logger.info(f"  ✅ Aktif bot bulundu: {bot_id} -> {bot_info}")
            matching_bots.append(bot_info)

    # 2. Eğer aktif bot yoksa, geçmiş işlemlerden bul
    if not matching_bots:
        logger.info(f"  ⚠️ Aktif bot yok, geçmiş işlemlere bakılıyor...")
        # trade_history Trade objeleri, open_positions dict olabilir
        all_trades = list(paper_engine.trade_history.trades if hasattr(paper_engine.trade_history, 'trades') else paper_engine.trade_history) + list(paper_engine.open_positions)
        for t in all_trades:
            # Trade objesi için attribute, dict için .get()
            t_strategy_id = t.strategy_id if hasattr(t, 'strategy_id') else t.get('strategy_id')
            t_bot_id = t.bot_id if hasattr(t, 'bot_id') else t.get('bot_id', '')
            if t_strategy_id == strategy_id or (t_bot_id and strategy_id in t_bot_id):
                logger.info(f"  ✅ Geçmiş işlem bulundu: {t_bot_id}")
                if t not in matching_bots:
                    matching_bots.append(t)

    if not matching_bots:
        logger.error(f"  ❌ Strateji bulunamadı: {strategy_id}")
        logger.error(f"  Aktif botlar: {list(paper_engine.active_bots.keys())}")
        logger.error(f"  Trade history count: {len(paper_engine.trade_history)}")
        logger.error(f"  Open positions count: {len(paper_engine.open_positions)}")
        raise HTTPException(status_code=404, detail=f"Strateji bulunamadı: {strategy_id}")

    # 3. Sembol filtreleme
    if symbol_filter:
        matching_bots = [b for b in matching_bots if b.get('symbol') == symbol_filter]

    if not matching_bots:
        raise HTTPException(status_code=404, detail=f"Bu sembol için strateji bulunamadı: {symbol_filter}")

    # İlk bot'un sembol ve timeframe'ini kullan
    bot_info = matching_bots[0]
    symbol = bot_info.get('symbol')
    timeframe = bot_info.get('timeframe', '1h')

    # 4. Mumları flat file'dan çek (HIZLI!)
    try:
        from data.ohlcv_storage import get_storage
        from datetime import datetime, timedelta

        storage = get_storage()
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=10)

        df = storage.load_ohlcv(symbol, timeframe, start_date, end_date)

        if df is not None and not df.empty:
            candles = df[['timestamp', 'open', 'high', 'low', 'close', 'volume']].values.tolist()
            logger.info(f"  ✅ {len(candles)} mum flat file'dan yüklendi")
        else:
            candles = await db_manager.get_klines(symbol, timeframe, limit=1000)
    except Exception as e:
        logger.warning(f"  ⚠️ Flat file okuma hatası: {e}")
        candles = await db_manager.get_klines(symbol, timeframe, limit=1000)

    # 5. Bu stratejiye ait tüm işlemleri topla
    open_positions_list = []
    closed_trades_list = []

    for bot in matching_bots:
        bid = bot.get('bot_id') if isinstance(bot, dict) else (bot.bot_id if hasattr(bot, 'bot_id') else None)
        if bid:
            # open_positions dict olabilir
            open_positions_list.extend([p for p in paper_engine.open_positions if (isinstance(p, dict) and p.get('bot_id') == bid) or (hasattr(p, 'bot_id') and p.bot_id == bid)])
            # trade_history Trade objeleri içerir
            trades_list = paper_engine.trade_history.trades if hasattr(paper_engine.trade_history, 'trades') else paper_engine.trade_history
            closed_trades_list.extend([t for t in trades_list if (hasattr(t, 'bot_id') and t.bot_id == bid) or (isinstance(t, dict) and t.get('bot_id') == bid)])

    # Remove duplicates by id
    seen_ids = set()
    unique_open = []
    unique_closed = []
    for p in open_positions_list:
        # open_positions dict olabilir
        pid = p.get('id') if isinstance(p, dict) else (p.id if hasattr(p, 'id') else p.get('bot_id') if isinstance(p, dict) else p.bot_id)
        if pid not in seen_ids:
            seen_ids.add(pid)
            unique_open.append(p)

    seen_ids = set()
    for t in closed_trades_list:
        # closed_trades Trade objeleri veya dict olabilir
        tid = t.id if hasattr(t, 'id') else (t.get('id') if isinstance(t, dict) else t.bot_id if hasattr(t, 'bot_id') else t.get('bot_id'))
        if tid not in seen_ids:
            seen_ids.add(tid)
            unique_closed.append(t)

    formatted_candles = _format_candles(candles)

    return {
        "status": "success",
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": formatted_candles,
        "open_positions": unique_open,
        "trades": unique_closed,
        "strategy_id": strategy_id
    }


def _format_candles(candles):
    """Mum verilerini Lightweight Charts formatına dönüştür"""
    formatted = []
    if not candles:
        return formatted

    for c in candles:
        # DB tuple veya dict dönebilir, her ikisini de destekle
        if isinstance(c, tuple):
            # Tuple format: (timestamp, open, high, low, close, ...)
            if len(c) < 5:
                continue
            ts, open_p, high_p, low_p, close_p = c[:5]
        elif isinstance(c, dict):
            # Dict format
            ts = c.get('timestamp')
            open_p = c.get('open', 0)
            high_p = c.get('high', 0)
            low_p = c.get('low', 0)
            close_p = c.get('close', 0)
        else:
            continue

        if ts is None:
            continue

        if isinstance(ts, str):
            try:
                ts = pd.to_datetime(ts)
            except:
                continue

        if hasattr(ts, 'timestamp'):
            ts_int = int(ts.timestamp())
        elif isinstance(ts, (int, float)):
            ts_int = int(ts)
        else:
            continue

        formatted.append({
            "time": ts_int,
            "open": float(open_p),
            "high": float(high_p),
            "low": float(low_p),
            "close": float(close_p)
        })

    # ascending order (Lightweight Charts beklediği format)
    formatted.sort(key=lambda x: x['time'])
    return formatted

# ============================================================================
# STATIC FILES (Frontend)
# ============================================================================

# Frontend static dosyalarını mount et
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
logger.info("✅ Frontend static dosyaları mount edildi")

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
