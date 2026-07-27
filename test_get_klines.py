import asyncio
from core.bot.bot_manager import BotManager

async def test():
    db = BotManager().db_manager
    rows = await db.get_klines('BTC/USDT:USDT', '1m', limit=25000)
    print("Found rows:", len(rows) if rows else 0)

asyncio.run(test())
