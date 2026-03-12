import sqlite3
import os

db_path = r"f:\Crypto Bot\cryptobot.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Bakım moduna giriliyor: 'trades' tablosu sıfırlanıyor...")

try:
    # Eski tabloyu yedekle (varsa)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='trades'")
    if cursor.fetchone():
        print("Mevcut 'trades' tablosu siliniyor...")
        cursor.execute("DROP TABLE trades")
    
    # Yeni tabloyu temiz bir şema ile oluştur
    # (database.py'deki en güncel şema ile uyumlu)
    cursor.execute("""
        CREATE TABLE trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT (datetime('now','localtime')),
            closed_at TEXT,
            symbol TEXT NOT NULL,
            strategy_id TEXT,
            direction TEXT NOT NULL,
            entry_price REAL NOT NULL,
            exit_price REAL,
            size REAL NOT NULL,
            leverage INTEGER,
            pnl_usd REAL,
            pnl_percent REAL,
            reason TEXT
        )
    """)
    conn.commit()
    print("✅ 'trades' tablosu başarıyla yeniden oluşturuldu.")
    
except Exception as e:
    print(f"❌ Hata: {e}")
    conn.rollback()

conn.close()
