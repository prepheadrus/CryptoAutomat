import asyncio
import pandas as pd
from data.indicators import StrategyIndicators
from data.features import AdvancedFeatures
from core.exchange import ExchangeManager

async def test_cols():
    exchange = ExchangeManager()
    ohlcv = await exchange.fetch_ohlcv("BTC/USDT", timeframe="1m", limit=100)
    await exchange.close()
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df = StrategyIndicators.add_all_indicators(df)
    df['volatility_ema'] = AdvancedFeatures.get_volatility(df['close'], span=20)
    import json
    with open('cols.json', 'w') as f:
        json.dump(df.columns.tolist(), f)
    print("Yazıldı.")

if __name__ == '__main__':
    asyncio.run(test_cols())
