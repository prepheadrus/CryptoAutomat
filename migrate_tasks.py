import sqlite3
import os

path = r"f:\Crypto Bot\cryptobot.db"
conn = sqlite3.connect(path)
cursor = conn.cursor()

# 1. Eski verileri yedeklemek için mevcut tabloyu oku
cursor.execute("SELECT * FROM download_tasks")
rows = cursor.fetchall()
# Sütun isimlerini al
cursor.execute("PRAGMA table_info(download_tasks)")
cols = [c[1] for c in cursor.fetchall()]

print(f"Mevcut {len(rows)} görev bulundu. Migrasyon başlıyor...")

# 2. Eski tabloyu sil (veya adını değiştir)
cursor.execute("DROP TABLE download_tasks")

# 3. Yeni tabloyu oluştur (Composite PK ile)
cursor.execute("""
    CREATE TABLE download_tasks (
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        start_date TEXT NOT NULL,
        market_type TEXT NOT NULL,
        status TEXT NOT NULL,
        current_ts BIGINT,
        target_start_ms BIGINT,
        PRIMARY KEY (symbol, market_type)
    )
""")

# 4. Verileri geri yükle ama TEMİZLEYEREK (BTC/USDT_spot -> BTC/USDT)
inserted_keys = set()
for row in rows:
    data = dict(zip(cols, row))
    
    # Sembolü temizle
    clean_symbol = data['symbol'].split('_')[0].strip()
    # Market tipini normalize et
    m_type = data['market_type'].lower()
    if m_type in ['swap', 'perp', 'future']: m_type = 'future'
    else: m_type = 'spot'
    
    key = (clean_symbol, m_type)
    if key in inserted_keys:
        print(f"Atlanıyor (Mükerrer): {key}")
        continue
        
    cursor.execute("""
        INSERT INTO download_tasks (symbol, timeframe, start_date, market_type, status, current_ts, target_start_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (clean_symbol, data['timeframe'], data['start_date'], m_type, data['status'], data['current_ts'], data['target_start_ms']))
    inserted_keys.add(key)

conn.commit()
print("Migrasyon başarıyla tamamlandı.")
conn.close()
