import asyncio
import pandas as pd
import pandas_ta as ta
from core.exchange import ExchangeManager
from data.indicators import StrategyIndicators

async def check_cols():
    exchange = ExchangeManager()
    ohlcv = await exchange.fetch_ohlcv("BTC/USDT", limit=100)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df = StrategyIndicators.add_all_indicators(df)
    
    print("ALL COLS:", df.columns.tolist())
    await exchange.close()

if __name__ == "__main__":
    asyncio.run(check_cols())
