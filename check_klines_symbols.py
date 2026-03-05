import sqlite3
import os
path = r"f:\Crypto Bot\cryptobot.db"
conn = sqlite3.connect(path)
cursor = conn.cursor()
cursor.execute("SELECT DISTINCT symbol FROM klines")
symbols = [row[0] for row in cursor.fetchall()]
print(f"Distinct symbols in klines ({len(symbols)}):")
for s in symbols:
    print(f"  - '{s}'")
conn.close()
