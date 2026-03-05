import uvicorn
import asyncio
from core.logger import logger
from core.config import CONFIG

def main():
    logger.info("==========================================")
    logger.info(f"Yüksek Frekanslı CryptoAlgoBot + Dashboard")
    logger.info("==========================================")
    logger.info(f"Aktif Borsa: {CONFIG['trading']['exchange'].upper()}")
    
    # Tüm modüler sistemi, FastAPI endpoints ve arka plan Bot WebSockets dahil uvicorn ile başlatır.
    # Uvicorn, asenkron motoru çok verimli kullanır (Tek potada web + finansal işlemler).
    uvicorn.run(
        "api.server:app", 
        host="0.0.0.0", 
        port=8000, 
        log_level=CONFIG['bot']['log_level'].lower(),
        reload=True if CONFIG['bot']['environment'] == 'development' else False
    )

if __name__ == "__main__":
    try:
        if __import__('sys').platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        main()
    except KeyboardInterrupt:
        logger.info("Kullanıcı (CTRL+C) botu ve Web Sunucusunu durdurdu.")
