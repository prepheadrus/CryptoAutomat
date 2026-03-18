import uvicorn
import asyncio
from core.logger import logger
from core.config import CONFIG

# Event Tracer import (Sistem Röntgeni - Event-Driven Architecture Diagnostic)
from core.diagnostics.event_tracer import start_event_tracer, event_tracer

# Bot Background Tasks imports
from core.exchange import exchange_manager
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
    logger.info("🚀 BOT ARKA PLAN TASK'LARI BAŞLATILIYOR...")
    logger.info("=" * 60)

    # 1. Event Bus başlat
    try:
        await event_bus.start(num_workers=5)
        logger.info("✅ Event Bus başlatıldı (5 worker)")
    except Exception as e:
        logger.error(f"❌ Event Bus başlatma hatası: {e}")
        raise

    # 2. Her sembol için poller başlat
    symbols = CONFIG.get('trading', {}).get('symbols', [])

    if not symbols:
        logger.warning("⚠️ config.yaml'da tanımlı sembol yok! Bot işlem yapmayacak.")
        logger.warning("   config.yaml → trading.symbols: ['BTC/USDT:USDT'] ekleyin")
    else:
        logger.info(f"📊 {len(symbols)} sembol için poller başlatılıyor...")

        for symbol in symbols:
            try:
                # WebSocket ticker loop (fiyat dinleme)
                asyncio.create_task(exchange_manager.watch_ticker_loop(symbol))
                logger.info(f"📡 [WSS] {symbol} için WebSocket dinleyici başlatıldı")

                # Strateji poller (sinyal üretme)
                asyncio.create_task(exchange_manager.run_strategy_poller(symbol))
                logger.info(f"🚀 [POLLER] {symbol} için strateji poller başlatıldı")

            except Exception as e:
                logger.error(f"❌ {symbol} için poller başlatma hatası: {e}")

    # 3. WFO arka plan task'ı başlat (aktifse)
    if CONFIG.get('wfo', {}).get('enabled', False):
        logger.info("🧠 [WFO] Walk-Forward Optimization aktif")

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
                    logger.info(f"🧠 [WFO] {symbol} için optimizasyon task'ı başlatıldı")
        except Exception as e:
            logger.warning(f"⚠️ WFO başlatma hatası: {e}")
            logger.warning("   Bot çalışmaya devam edecek, WFO olmadan")

    logger.info("=" * 60)
    logger.info("✅ TÜM ARKA PLAN TASK'LARI BAŞLATILDI!")
    logger.info("   Bot şimdi piyasayı dinliyor ve işlem yapıyor...")
    logger.info("=" * 60)
    logger.info("")

if __name__ == "__main__":
    try:
        if __import__('sys').platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        # Ana event loop'u al
        loop = asyncio.get_event_loop()

        # Event Tracer başlat (Event-Driven mimari diagnostik)
        logger.info("")
        logger.info("🔍 EVENT TRACER BAŞLATILIYOR...")
        logger.info("   Sistem röntgeni aktif - Tüm event'ler izleniyor")
        logger.info("")

        try:
            loop.create_task(start_event_tracer())
            logger.info("✅ Event Tracer aktif")
        except Exception as e:
            logger.warning(f"⚠️ Event Tracer başlatılamadı: {e}")

        # BOT ARKA PLAN TASK'LARINI BAŞLAT
        # Bu fonksiyon: Event Bus, WebSocket, Poller'lar, WFO başlatır
        logger.info("🚀 BOT TASK'LARI BAŞLATILIYOR...")
        loop.run_until_complete(start_background_tasks())

        # Tüm modüler sistemi, FastAPI endpoints ve arka plan Bot WebSockets dahil uvicorn ile başlatır.
        # Uvicorn, asenkron motoru çok verimli kullanır (Tek potada web + finansal işlemler).
        # Vercel Live Preview uyumluluğu için portu ortam değişkeninden de oku veya 3000'e fallback yap
        import os
        port = int(os.environ.get("PORT", 3000))

        logger.info("🌐 FastAPI Dashboard başlatılıyor...")
        logger.info(f"   Port: {port}")
        logger.info(f"   Reload: {CONFIG['bot']['environment'] == 'development'}")
        logger.info("")
        logger.info("=" * 60)
        logger.info("✅ BOT TAM OLARAK BAŞLATILDI!")
        logger.info("   Dashboard: http://localhost:" + str(port))
        logger.info("   Piyasa dinleniyor... İşlemler başlıyor...")
        logger.info("=" * 60)
        logger.info("")

        uvicorn.run(
            "api.server:app",
            host="0.0.0.0",
            port=port,
            log_level=CONFIG['bot']['log_level'].lower(),
            reload=True if CONFIG['bot']['environment'] == 'development' else False
        )

    except KeyboardInterrupt:
        logger.info("")
        logger.info("🛑 KULLANICI BOTU DURDURUYOR (CTRL+C)...")

        # Event Tracer istatistiklerini göster
        try:
            loop = asyncio.get_event_loop()
            loop.run_until_complete(event_tracer.stop())
        except Exception:
            pass

        logger.info("Kullanıcı (CTRL+C) botu ve Web Sunucusunu durdurdu.")
