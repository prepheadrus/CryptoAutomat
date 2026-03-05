import sqlite3
import os
path = r"f:\Crypto Bot\cryptobot.db"
if not os.path.exists(path):
    print(f"File not found: {path}")
else:
    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='download_tasks'")
    row = cursor.fetchone()
    if row:
        print(row[0])
    else:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"Table 'download_tasks' not found. Existing tables: {[t[0] for t in tables]}")
    conn.close()
