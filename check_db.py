import sqlite3
import pandas as pd

def check():
    conn = sqlite3.connect("cryptobot.db")
    try:
        df = pd.read_sql_query("SELECT symbol, timeframe, MIN(timestamp) as min_ts, MAX(timestamp) as max_ts, COUNT(*) as count FROM klines GROUP BY symbol, timeframe", conn)
        print(df)
    except Exception as e:
        print(f"Hata: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check()
