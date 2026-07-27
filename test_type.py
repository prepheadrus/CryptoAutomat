import sqlite3
import pandas as pd

conn = sqlite3.connect('cryptobot.db')
cur = conn.cursor()
cur.execute("SELECT timestamp, open, high, low, close, volume FROM klines WHERE symbol='BTC/USDT:USDT' AND timeframe='1m' LIMIT 1")
rows = cur.fetchall()
df = pd.DataFrame(rows, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
val = df['timestamp'].iloc[0]
print("Value:", repr(val))
print("Type:", type(val))
print("Is str?", isinstance(val, str))
