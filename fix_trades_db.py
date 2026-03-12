"""
Trade History'den Duplicate Kayıtları Temizle

Kullanım:
    python fix_trades_db.py
"""

import sqlite3
from datetime import datetime

DB_PATH = "cryptobot.db"

def fix_duplicate_trades():
    """Veritabanından duplicate trade kayıtlarını temizle"""

    print("Trade history duplicate temizligi baslatiliyor...")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Tüm trade'leri çek
    cursor.execute("""
        SELECT id, timestamp, closed_at, symbol, strategy_id, direction,
               entry_price, exit_price, size, leverage, pnl_usd, pnl_percent, reason
        FROM trades
        ORDER BY closed_at DESC, id DESC
    """)
    trades = cursor.fetchall()

    print(f"Toplam trade sayisi: {len(trades)}")

    # Duplicate tespiti
    seen = set()
    duplicates = []

    for trade in trades:
        # Unique key: (symbol, strategy_id, entry_price, exit_price, closed_at, pnl_usd)
        symbol = trade[3]     # symbol
        strategy_id = trade[8]  # strategy_id
        entry = trade[6]      # entry_price
        exit_p = trade[7]     # exit_price
        closed_at = trade[2]  # closed_at
        pnl_usd = trade[10]   # pnl_usd

        key = (symbol, strategy_id, entry, exit_p, closed_at, pnl_usd)

        if key in seen:
            duplicates.append(trade[0])  # id
            print(f"  Duplicate bulundu: ID={trade[0]}, Symbol={symbol}, PnL=${trade[10]:.2f}")
        else:
            seen.add(key)

    if not duplicates:
        print("Duplicate bulunamadi!")
        conn.close()
        return

    print(f"\n{len(duplicates)} duplicate kayıt silinecek...")
    confirm = input("Devam etmek istiyor musunuz? (yes/no): ")

    if confirm.lower() != 'yes':
        print("Islem iptal edildi.")
        conn.close()
        return

    # Duplicate'lari sil
    for dup_id in duplicates:
        cursor.execute("DELETE FROM trades WHERE id = ?", (dup_id,))

    conn.commit()

    # Kalan trade sayisini kontrol et
    cursor.execute("SELECT COUNT(*) FROM trades")
    count = cursor.fetchone()
    print(f"\nTemizlik tamamlandi!")
    print(f"Kalan trade sayisi: {count[0]}")
    print(f"Silinen duplicate sayisi: {len(duplicates)}")

    conn.close()

if __name__ == "__main__":
    fix_duplicate_trades()
