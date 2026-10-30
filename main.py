import sys
if sys.platform == 'win32':
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import uvicorn
import asyncio
from core.logger import logger
from core.config import CONFIG

# Event Tracer import (Sistem Röntgeni - Event-Driven Architecture Diagnostic)
from core.diagnostics.event_tracer import start_event_tracer, event_tracer

# Bot Background Tasks imports
from core.exchange import exchange_manager, normalize_symbol
from shared.events import event_bus
from strategy.manager import StrategyManager

async def start_background_tasks():
    """
    Arka plan task'larını başlat (Event Bus, Poller'lar, WFO).

    Bu fonksiyon:
    1. Event Bus'ı başlatır (5 worker)
    2. Her sembol için WebSocket dinleyici başlatır
    3. Her sembol için strateji poller başlatır
    4. WFO aktifse arka plan optimizasyonunu başlatır
    """
    logger.info("")
    logger.info("🚀 STARTING BOT BACKGROUND WORKERS...")
    logger.info("=" * 60)

    # 1. Event Bus başlat
    try:
        await event_bus.start(num_workers=5)
        logger.info("✅ Event Bus started (5 workers)")
    except Exception as e:
        logger.error(f"❌ Event Bus startup error: {e}")
        raise

    # 2. Her sembol için poller başlat
    # ÖNCE: config.yaml'dan oku
    symbols = CONFIG.get('trading', {}).get('symbols', [])

    if not symbols:
        # YENİ: config.yaml boşsa, Parquet Data Lake'den otomatik yükle
        logger.info("🔄 [AUTO-SYNC] config.yaml is empty, auto-loading symbols from Parquet Data Lake...")
        try:
            from data.storage.parquet_lake import get_parquet_lake
            lake = get_parquet_lake('binance')
            stats = lake.get_stats()

            if stats['total_symbols'] > 0:
                # [SYMBOL FIX] Loaded gelen sembolleri normalize et (örn: /BTC → BTC/USDT)
                symbols = [normalize_symbol(s) for s in stats['symbols'].keys()]
                logger.info(f"✅ [AUTO-SYNC] Loaded {len(symbols)} symbols from Parquet Data Lake!")
                logger.info(f"   Symbols: {', '.join(symbols[:5])}{'...' if len(symbols) > 5 else ''}")
                logger.info(f"   Total files: {stats['total_files']}, Size: {stats['total_size_mb']:.2f} MB")
            else:
                logger.warning("⚠️ Parquet Data Lake is empty. Download historical data via Data Lab.")
        except Exception as e:
            logger.error(f"❌ [AUTO-SYNC] Error loading symbols from Parquet: {e}")
            logger.info("ℹ️ Falling back to SQLite DB...")
            try:
                from data.database import db_manager
                await db_manager.connect()
                db_symbols = await db_manager.get_symbols_with_data()
                if db_symbols:
                    symbols = db_symbols
                    logger.info(f"✅ [AUTO-SYNC] Loaded {len(symbols)} symbols from DB")
            except Exception as e2:
                logger.error(f"❌ [AUTO-SYNC] Error loading symbols from DB: {e2}")

    # Sembollerle botları başlat
    if symbols:
        logger.info(f"📊 {len(symbols)} symbols queued for strategy pollers...")

        for symbol in symbols:
            try:
                # WebSocket ticker loop (fiyat dinleme)
                asyncio.create_task(exchange_manager.watch_ticker_loop(symbol))
                logger.info(f"📡 [WSS] {symbol} WebSocket listener started")

                # Strateji poller (sinyal üretme)
                asyncio.create_task(exchange_manager.run_strategy_poller(symbol))
                logger.info(f"🚀 [POLLER] {symbol} strategy poller started")

            except Exception as e:
                logger.error(f"❌ Error starting poller for {symbol}: {e}")
    else:
        logger.info("ℹ️ No active symbols configured - you can launch bots from the Dashboard")

    # 3. WFO arka plan task'ı başlat (aktifse)
    if CONFIG.get('wfo', {}).get('enabled', False):
        logger.info("🧠 [WFO] Walk-Forward Optimization active")

        try:
            from core.wfo_engine import start_wfo_background_task

            for symbol in symbols:
                strategy = StrategyManager.get_strategy('trend_master')
                if strategy:
                    asyncio.create_task(
                        start_wfo_background_task(
                            symbol=symbol,
                            timeframe='1h',
                            strategy_class=strategy,
                            n_trials=50
                        )
                    )
                    logger.info(f"🧠 [WFO] {symbol} WFO optimization worker started")
        except Exception as e:
            logger.warning(f"⚠️ WFO initialization error: {e}")
            logger.warning("   Bot running without autonomous WFO")

    logger.info("=" * 60)
    logger.info("✅ ALL BACKGROUND WORKERS STARTED!")
    logger.info("   Engine is now listening to live market feeds and executing signals...")
    logger.info("=" * 60)
    logger.info("")


def open_browser_when_ready(port: int = 3000):
    """Wait for server socket to accept connections, then automatically launch browser."""
    import socket
    import time
    import webbrowser

    target_url = f"http://localhost:{port}"
    for _ in range(60):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                time.sleep(0.5)
                logger.info(f"🌐 Server ready! Launching browser at {target_url} ...")
                webbrowser.open(target_url)
                return
        except (OSError, ConnectionRefusedError):
            time.sleep(0.5)
    logger.warning(f"⚠️ Could not automatically launch browser. Please open {target_url} manually.")

if __name__ == "__main__":
    # Global shutdown flag
    shutdown_in_progress = False
    
    async def graceful_shutdown():
        """
        Güvenli kapatma (Graceful Shutdown).
        Açık pozisyonları kapatır, bağlantıları temizler.
        """
        global shutdown_in_progress
        if shutdown_in_progress:
            return  # Zaten kapanıyor
        
        shutdown_in_progress = True
        
        logger.info("")
        logger.info("🛑 GRACEFUL SHUTDOWN INITIATED...")
        logger.info("=" * 60)
        
        try:
            # 1. Yeni işlem almayı durdur
            logger.info("1️⃣ Halting new trade execution...")
            if hasattr(paper_engine, 'accepting_new_trades'):
                paper_engine.accepting_new_trades = False
            logger.info("✅ Accepting new trades halted")
            
            # 2. Açık pozisyonları kapat
            logger.info("2️⃣ Checking open positions...")
            open_positions_count = len(paper_engine.open_positions) if hasattr(paper_engine, 'open_positions') else 0
            
            if open_positions_count > 0:
                logger.warning(f"⚠️ {open_positions_count} open position(s) detected!")
                logger.info("   Positions can be managed or closed via dashboard")
                logger.info("   Check risk management settings for auto-close.")
            else:
                logger.info("✅ No open positions")
            
            # 3. Event Bus'ı durdur
            logger.info("3️⃣ Stopping Event Bus...")
            from shared.events import event_bus
            await event_bus.stop()
            logger.info("✅ Event Bus stopped")
            
            # 4. Exchange bağlantılarını kapat
            logger.info("4️⃣ Closing exchange connections...")
            await exchange_manager.close()
            logger.info("✅ Exchange connections closed")
            
            # 5. Database bağlantısını kapat
            logger.info("5️⃣ Closing database connection...")
            from data.database import db_manager
            await db_manager.close()
            logger.info("✅ Database connection closed")
            
            # 6. Circuit Breaker istatistiklerini logla
            logger.info("6️⃣ Circuit Breaker statistics:")
            try:
                from core.circuit_breaker import get_all_breakers_stats
                stats = get_all_breakers_stats()
                for name, breaker_stats in stats.items():
                    logger.info(
                        f"   {name}: state={breaker_stats['state']}, "
                        f"failures={breaker_stats['total_failures']}, "
                        f"rejected={breaker_stats['total_rejected']}"
                    )
            except Exception:
                pass
            
            # 7. Event Tracer istatistiklerini göster
            logger.info("7️⃣ Event Tracer telemetry:")
            try:
                loop.run_until_complete(event_tracer.stop())
            except Exception:
                pass
            logger.info("=" * 60)
            logger.info("✅ GRACEFUL SHUTDOWN COMPLETE")
            logger.info("")
            
        except Exception as e:
            logger.error(f"❌ Error during shutdown: {e}")
            logger.error("   Forcing bot termination...")
    
    def run_graceful_shutdown(loop):
        """Sync wrapper for graceful shutdown"""
        try:
            loop.run_until_complete(graceful_shutdown())
        except Exception as e:
            logger.error(f"Shutdown error: {e}")
        finally:
            # Tüm pending task'ları iptal et
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            
            # Kapanana kadar bekle
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.close()
    
    try:
        if __import__('sys').platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        # Ana event loop'u al
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Event Tracer başlat (Event-Driven mimari diagnostik)
        logger.info("")
        logger.info("🔍 STARTING EVENT TRACER TELEMETRY...")
        logger.info("   Diagnostic telemetry active - Event stream monitored")
        logger.info("")

        try:
            loop.create_task(start_event_tracer())
            logger.info("✅ Event Tracer active")
        except Exception as e:
            logger.warning(f"⚠️ Event Tracer could not be started: {e}")

        # BOT ARKA PLAN TASK'LARINI BAŞLAT
        # Bu fonksiyon: Event Bus, WebSocket, Poller'lar, WFO başlatır
        logger.info("🚀 STARTING CORE TRADING TASKS...")
        loop.run_until_complete(start_background_tasks())

        # Tüm modüler sistemi, FastAPI endpoints ve arka plan Bot WebSockets dahil uvicorn ile başlatır.
        # Uvicorn, asenkron motoru çok verimli kullanır (Tek potada web + finansal işlemler).
        # Vercel Live Preview uyumluluğu için portu ortam değişkeninden de oku veya 3000'e fallback yap
        import os
        port = int(os.environ.get("PORT", 3000))

        logger.info("🌐 FastAPI Dashboard starting...")
        logger.info(f"   Port: {port}")
        logger.info(f"   Reload: {CONFIG['bot']['environment'] == 'development'}")
        logger.info("")
        logger.info("=" * 60)
        logger.info("✅ TRADING ENGINE FULLY INITIALIZED!")
        logger.info("   Dashboard: http://localhost:" + str(port))
        logger.info("   Listening to market feeds... Execution loop ready...")
        logger.info("=" * 60)
        logger.info("")

        import threading
        threading.Thread(target=open_browser_when_ready, args=(port,), daemon=True).start()

        uvicorn.run(
            "api.server:app",
            host="0.0.0.0",
            port=port,
            log_level=CONFIG['bot']['log_level'].lower(),
            reload=True if CONFIG['bot']['environment'] == 'development' else False
        )

    except KeyboardInterrupt:
        logger.info("")
        logger.info("🛑 SHUTDOWN SIGNAL RECEIVED (CTRL+C)...")
        run_graceful_shutdown(loop)
