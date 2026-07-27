import sqlite3
conn = sqlite3.connect('cryptobot.db')
cur = conn.cursor()
cur.execute("SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM klines WHERE symbol='BTC/USDT:USDT' AND timeframe='1m'")
print(cur.fetchall())
