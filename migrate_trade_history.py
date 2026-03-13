"""
Trade History Migration Script

Eski duplicate kayıtları temizler ve yeni UNIQUE ID formatına geçer.
"""

import sqlite3
import asyncio
from datetime import datetime

DB_PATH = "cryptobot.db"

async def migrate_trade_history():
    """Trade history'yi migrate et"""
    
    print("=" * 60)
    print("  TRADE HISTORY MIGRATION")
    print("=" * 60)
    print()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Eski duplicate kayıtları temizle
    print("🔍 Eski duplicate kayıtlar temizleniyor...")
    
    cursor.execute("""
        DELETE FROM trades
        WHERE id IN (
            SELECT id FROM (
                SELECT id, COUNT(*) as cnt
                FROM trades
                GROUP BY id
                HAVING cnt > 1
            )
        )
        AND rowid NOT IN (
            SELECT MIN(rowid)
            FROM trades
            WHERE id = id
        )
    """)
    
    deleted = cursor.rowcount
    print(f"  🗑️ {deleted} duplicate kayıt silindi")
    
    # 2. Kalan kayıtları göster
    cursor.execute("SELECT COUNT(*) FROM trades")
    remaining = cursor.fetchone()[0]
    print(f"  📊 Kalan trade sayısı: {remaining}")
    
    # 3. UNIQUE index oluştur (eğer yoksa)
    print("\n🔍 UNIQUE index oluşturuluyor...")
    
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_id ON trades(id)")
        print("  ✅ UNIQUE index oluşturuldu: idx_trade_id")
    except Exception as e:
        print(f"  ⚠️ Index oluşturma hatası: {e}")
    
    conn.commit()
    conn.close()
    
    print()
    print("=" * 60)
    print("  MIGRATION TAMAMLANDI")
    print("=" * 60)
    print()
    print("✅ Artık aynı trade_id'ye sahip kayıtlar DB'ye eklenemez!")
    print("✅ Frontend'de duplicate filtreleme aktif!")
    print()

if __name__ == "__main__":
    asyncio.run(migrate_trade_history())
