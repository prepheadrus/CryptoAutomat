import sqlite3
import os

def migrate():
    db_path = "cryptobot.db" # DatabaseManager.sqlite_path
    if not os.path.exists(db_path):
        print(f"Veritabanı bulunamadı: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Mevcut sütunları kontrol et
        cursor.execute("PRAGMA table_info(klines)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "timeframe" in columns:
            print("✅ 'timeframe' sütunu zaten mevcut.")
            return

        print("🔄 Tablo şeması güncelleniyor (SQLite-safe migration)...")

        # 1. Eski tabloyu yedekle
        cursor.execute("ALTER TABLE klines RENAME TO klines_old")

        # 2. Yeni tabloyu doğru şema ile oluştur
        cursor.execute("""
            CREATE TABLE klines (
                timestamp TIMESTAMP NOT NULL,
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL DEFAULT '1m',
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL NOT NULL,
                PRIMARY KEY (timestamp, symbol, timeframe)
            );
        """)

        # 3. Eski verileri taşı (eski verilerin hepsi 1m idi)
        cursor.execute("""
            INSERT INTO klines (timestamp, symbol, timeframe, open, high, low, close, volume)
            SELECT timestamp, symbol, '1m', open, high, low, close, volume FROM klines_old
        """)

        # 4. Eski tabloyu sil
        cursor.execute("DROP TABLE klines_old")
        
        conn.commit()
        print("✅ Veritabanı başarıyla güncellendi! 'timeframe' sütunu eklendi ve birincil anahtar güncellendi.")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration sırasında hata (Muhtemelen tablo zaten güncel veya boş): {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
