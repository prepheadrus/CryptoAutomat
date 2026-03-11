import sqlite3
import pandas as pd

def check_db(db_path):
    print(f"Checking {db_path}...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT symbol FROM klines;")
        symbols = cursor.fetchall()
        print(f"Symbols in {db_path}: {symbols}")
        
        cursor.execute("SELECT symbol, timeframe, COUNT(*) FROM klines GROUP BY symbol, timeframe;")
        counts = cursor.fetchall()
        print(f"Counts in {db_path}: {counts}")
        
        conn.close()
    except Exception as e:
        print(f"Error checking {db_path}: {e}")

check_db('f:/Crypto Bot/cryptobot.db')
check_db('f:/Crypto Bot/data/database.db')
