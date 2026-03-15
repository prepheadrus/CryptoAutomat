"""
Check DB for BTC data
"""
import asyncio
from data.database import db_manager

async def check():
    await db_manager.connect()

    # Check if any data exists
    sql = "SELECT symbol, timeframe, COUNT(*) as count FROM klines GROUP BY symbol, timeframe"

    async with db_manager.sqlite_conn.execute(sql) as cursor:
        rows = await cursor.fetchall()

        print(f"\n[INFO] DB'de {len(rows)} kayıt bulundu:\n")

        for row in rows:
            print(f"  {row[0]:20} {row[1]:5} -> {row[2]:>10} mum")

        # Total
        total = sum(row[2] for row in rows)
        print(f"\n[INFO] Toplam: {total:,} mum\n")

if __name__ == "__main__":
    asyncio.run(check())
