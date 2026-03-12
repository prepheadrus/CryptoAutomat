import sqlite3

db_path = r"f:\Crypto Bot\cryptobot.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM trades")
print(f"Total trades: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM klines")
print(f"Total klines: {cursor.fetchone()[0]}")

conn.close()
