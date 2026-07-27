import asyncio
from api.schemas.ml import MLTrainRequest
from api.services.ml_service import MLService
from data.database import db_manager
import logging
from core.logger import logger

logger.setLevel(logging.DEBUG)

async def test():
    # CONNECT DB!
    await db_manager.connect()
    
    req = MLTrainRequest(
        symbol="BTC/USDT:USDT",
        timeframe="5m",
        limit=5000,
        tp_multiplier=2.0,
        sl_multiplier=2.0
    )
    svc = MLService()
    res = await svc.train_model(req)
    print("Result:", res)

asyncio.run(test())
