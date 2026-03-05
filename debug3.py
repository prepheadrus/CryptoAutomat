import asyncio
import pandas as pd
from data.indicators import StrategyIndicators
from data.features import AdvancedFeatures
from core.exchange import ExchangeManager

async def test_na():
    exchange = ExchangeManager()
    ohlcv = await exchange.fetch_ohlcv("BTC/USDT", timeframe="1m", limit=500)
    await exchange.close()
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df = StrategyIndicators.add_all_indicators(df)
    df['volatility_ema'] = AdvancedFeatures.get_volatility(df['close'], span=20)
    df['target'] = AdvancedFeatures.create_target_labels(df, lookahead=5, threshold=0.002)
    
    print("Shape before dropna:", df.shape)
    for col in df.columns:
        print(f"{col}: {df[col].isna().sum()} NaNs")

if __name__ == '__main__':
    asyncio.run(test_na())
