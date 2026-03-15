"""
Check last candle timestamp
"""
import asyncio
from data.database import db_manager
from datetime import datetime

async def check():
    await db_manager.connect()
    
    result = await db_manager.get_candle_range('BTC/USDT:USDT', '1m')
    
    if result:
        last_ts = result.get('end')
        last_dt = datetime.fromtimestamp(last_ts / 1000)
        
        print(f"\nDB son mum (UTC): {last_dt.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"DB son mum (TR):  {(last_dt.timestamp() + 3*3600)}")
        
        # Turkey time
        from datetime import timedelta
        tr_time = last_dt + timedelta(hours=3)
        print(f"DB son mum (TR):  {tr_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Current time
        now_utc = datetime.utcnow()
        now_tr = now_utc + timedelta(hours=3)
        print(f"\nŞu an (UTC):      {now_utc.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Şu an (TR):       {now_tr.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Gap
        gap = now_utc - last_dt
        print(f"\nFark: {gap.total_seconds() / 60:.0f} dakika")
    else:
        print("DB boş!")

if __name__ == "__main__":
    asyncio.run(check())
