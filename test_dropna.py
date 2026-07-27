import sqlite3
import pandas as pd
from data.indicators import StrategyIndicators

conn = sqlite3.connect('cryptobot.db')
query = "SELECT timestamp, open, high, low, close, volume FROM klines WHERE symbol='BTC/USDT:USDT' AND timeframe='1m' ORDER BY timestamp DESC LIMIT 5000"
df = pd.read_sql_query(query, conn)
df = df.sort_values('timestamp')
df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
df.set_index('timestamp', inplace=True)
for col in ['open', 'high', 'low', 'close', 'volume']:
    df[col] = df[col].astype(float)

print("Before indicators:", len(df))
df = StrategyIndicators.add_all_indicators(df)
print("After indicators:", len(df))
print("NaN counts per column:")
print(df.isna().sum()[df.isna().sum() > 0])
df = df.dropna()
print("After dropna:", len(df))
