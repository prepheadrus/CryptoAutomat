import sqlite3
import pandas as pd
from data.indicators import StrategyIndicators

conn = sqlite3.connect('cryptobot.db')
query = "SELECT timestamp, open, high, low, close, volume FROM klines WHERE symbol='BTC/USDT:USDT' AND timeframe='1m' ORDER BY timestamp DESC LIMIT 500"
df = pd.read_sql_query(query, conn)
df = df.sort_values('timestamp').reset_index(drop=True)

# Convert types just in case
for col in ['open', 'high', 'low', 'close', 'volume']:
    df[col] = df[col].astype(float)

df = StrategyIndicators.add_all_indicators(df)
print(df.isna().sum())
