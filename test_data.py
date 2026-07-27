import asyncio
from datetime import datetime, timedelta
import pytz
from api.services.data_service import DataService
from core.logger import logger
import logging
logger.setLevel(logging.DEBUG)

async def main():
    service = DataService()
    end_date = datetime.now(tz=pytz.UTC)
    start_date = end_date - timedelta(minutes=25000)
    
    df = await service.get_cached_or_fetch_data("BTC/USDT:USDT", "5m", start_date, end_date)
    if df is not None:
        print(f"Success! DF len: {len(df)}")
    else:
        print("Failed! DF is None")

asyncio.run(main())
