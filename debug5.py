import asyncio
import pandas as pd
from data.indicators import StrategyIndicators
from data.features import AdvancedFeatures
from core.exchange import ExchangeManager

async def test_na():
    exchange = ExchangeManager()
    ohlcv = await exchange.fetch_ohlcv("BTC/USDT", timeframe="1m", limit=3000)
    await exchange.close()
    
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    if 'timestamp' in df.columns:
        if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True, drop=False)
    
    import pandas_ta as ta
    df['SMA_20'] = ta.sma(df['close'], length=20)
    df['EMA_50'] = ta.ema(df['close'], length=50)
    df['EMA_200'] = ta.ema(df['close'], length=200)
    
    st = ta.supertrend(df['high'], df['low'], df['close'], length=10, multiplier=3.0)
    if st is not None: df = pd.concat([df, st], axis=1)
    
    df['RSI_14'] = ta.rsi(df['close'], length=14)
    macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
    if macd is not None: df = pd.concat([df, macd], axis=1)
    
    df['ATR_14'] = ta.atr(df['high'], df['low'], df['close'], length=14)
    bb = ta.bbands(df['close'], length=20, std=2)
    if bb is not None: df = pd.concat([df, bb], axis=1)
    
    df['OBV'] = ta.obv(df['close'], df['volume'])
    df['VWAP'] = ta.vwap(df['high'], df['low'], df['close'], df['volume'], anchor="D")
    
    df['volatility_ema'] = AdvancedFeatures.get_volatility(df['close'], span=20)
    df['target'] = AdvancedFeatures.create_target_labels(df, lookahead=5, threshold=0.002)
    
    print("Total rows:", len(df))
    for col in df.columns:
        print(f"{col}: {df[col].isna().sum()} NaNs")

if __name__ == '__main__':
    asyncio.run(test_na())
