import uvicorn
import asyncio
from core.logger import logger
from core.config import CONFIG

# Event Tracer import (Sistem Röntgeni - Event-Driven Architecture Diagnostic)
from core.diagnostics.event_tracer import start_event_tracer, event_tracer

def main():
    logger.info("==========================================")
    logger.info(f"Yüksek Frekanslı CryptoAlgoBot + Dashboard")
    logger.info("==========================================")
    logger.info(f"Aktif Borsa: {CONFIG['trading']['exchange'].upper()}")

    # Event Tracer başlat (Event-Driven mimari diagnostik)
    logger.info("")
    logger.info("🔍 EVENT TRACER BAŞLATILIYOR...")
    logger.info("   Sistem röntgeni aktif - Tüm event'ler izleniyor")
    logger.info("   Renkli terminal çıktısı için bekleyin...")
    logger.info("")

    # Event tracer'ı asenkron başlat
    try:
        # Python 3.10+ için deprecation warning önle
        import warnings
        warnings.filterwarnings("ignore", category=DeprecationWarning, message="There is no current event loop")

        loop = asyncio.get_event_loop()
        loop.create_task(start_event_tracer())
        logger.info("✅ Event Tracer aktif")
    except Exception as e:
        logger.warning(f"⚠️ Event Tracer başlatılamadı: {e}")
        logger.warning("   Bot çalışmaya devam edecek, ancak event'ler loglanmayacak")

    # Tüm modüler sistemi, FastAPI endpoints ve arka plan Bot WebSockets dahil uvicorn ile başlatır.
    # Uvicorn, asenkron motoru çok verimli kullanır (Tek potada web + finansal işlemler).
    # Vercel Live Preview uyumluluğu için portu ortam değişkeninden de oku veya 3000'e fallback yap
    import os
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=port,
        log_level=CONFIG['bot']['log_level'].lower(),
        reload=True if CONFIG['bot']['environment'] == 'development' else False
    )

if __name__ == "__main__":
    try:
        if __import__('sys').platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        main()
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
