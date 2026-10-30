"""
Manuel Flat File Oluşturucu (Superalgos Mimarisi)

Veritabanındaki 1m mumlardan TÜM timeframe'leri otomatik oluşturur
ve flat file'lara kaydeder.

Kullanım:
    python generate_flat_files.py
"""

import asyncio
import pandas as pd
from data.database import db_manager
from data.ohlcv_storage import get_storage
from data.indicators import StrategyIndicators
from core.logger import logger
import sys


async def main():
    print("=" * 70)
    print("🔧 MANUAL FLAT FILE GENERATOR (Superalgos Architecture)")
    print("=" * 70)
    print()
    
    # DB bağlantısı
    print("📊 Connecting to database...")
    await db_manager.connect()
    print("✅ Database connection successful")
    print()
    
    # Storage başlat
    print("💾 Initializing flat file storage...")
    storage = get_storage()
    print(f"📁 Folder: {storage.BASE_DIR.absolute()}")
    print()
    
    # DB'den sembolleri al
    print("🔍 Semboller bulunuyor...")
    symbols = await db_manager.get_symbols_with_data()
    
    if not symbols:
        print("❌ No symbols found in database!")
        print("   Please download data first.")
        return
    
    print(f"✅ {len(symbols)} sembol bulundu:")
    for sym in symbols:
        print(f"   - {sym}")
    print()
    
    # Her sembolü işle
    processed_count = 0
    error_count = 0
    
    for symbol in symbols:
        print("=" * 70)
        print(f"🔄 Processing {symbol}...")
        print("-" * 70)
        
        try:
            # 1m veriyi çek (TÜM VERİ - doğrudan SQL query ile)
            print("   📖 Fetching 1m candles from database (ALL DATA)...")

            # Önce toplam sayıyı al
            total_count = await db_manager.get_klines_count(symbol, '1m')
            print(f"   📊 Total {total_count} candles found")

            # Doğrudan SQL query ile tüm veriyi çek
            if db_manager.engine_type == "sqlite":
                async with db_manager.sqlite_conn.execute(
                    "SELECT timestamp, open, high, low, close, volume FROM klines WHERE symbol = ? AND timeframe = ? ORDER BY timestamp ASC",
                    (symbol, '1m')
                ) as cursor:
                    klines = await cursor.fetchall()
            else:
                # PostgreSQL
                async with db_manager.db_pool.acquire() as conn:
                    klines = await conn.fetch(
                        "SELECT timestamp, open, high, low, close, volume FROM klines WHERE symbol = $1 AND timeframe = $2 ORDER BY timestamp ASC",
                        symbol, '1m'
                    )

            if not klines or len(klines) == 0:
                print(f"   ⚠️ No data for {symbol}, skipping...")
                error_count += 1
                continue

            print(f"   ✅ Fetched {len(klines)} candles (2025-2026 all data)")
            
            # DataFrame'e çevir
            df = pd.DataFrame(klines, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # Timestamp format kontrolü (datetime veya ms)
            if df['timestamp'].dtype == 'object' or pd.api.types.is_datetime64_any_dtype(df['timestamp']):
                # datetime objesi → ms'ye çevir
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df['timestamp'] = (df['timestamp'].astype('int64') // 10**6)  # ns → ms
            elif df['timestamp'].iloc[0] > 1e12:
                # Zaten ms, bir şey yapma
                pass
            else:
                # Saniye → ms
                df['timestamp'] = df['timestamp'] * 1000

            # 1m kaydet
            print("   💾 1m flat file kaydediliyor...")
            storage.save_ohlcv(symbol, '1m', df)
            print(f"   ✅ 1m: {len(df)} candles saved")
            
            # Tüm TF'leri oluştur
            timeframes = [
                '2m', '3m', '4m', '5m', '10m', '15m', '20m', '30m', '40m', '45m',
                '1h', '2h', '3h', '4h', '6h', '8h', '12h', '24h'
            ]
            
            print("   🔄 Generating timeframes...")
            
            for tf in timeframes:
                try:
                    # Resample
                    df_tf = StrategyIndicators.resample_data(df, tf)
                    df_tf = df_tf.dropna()
                    
                    if not df_tf.empty:
                        # Kaydet
                        storage.save_ohlcv(symbol, tf, df_tf)
                        print(f"      ✅ {tf}: {len(df_tf)} candles")
                    else:
                        print(f"      ⚠️ {tf}: Empty data, skipped")
                
                except Exception as tf_error:
                    print(f"      ❌ {tf} error: {tf_error}")
                    error_count += 1
            
            processed_count += 1
            print(f"✅ {symbol} COMPLETED SUCCESSFULLY!")
            print()
            
        except Exception as e:
            print(f"❌ {symbol} error: {e}")
            print(f"   Stack trace: {e}", file=sys.stderr)
            error_count += 1
            continue
    
    # Özet
    print("=" * 70)
    print("📊 EXECUTION SUMMARY")
    print("=" * 70)
    print(f"✅ Successful: {processed_count} symbols")
    print(f"❌ Failed:     {error_count} symbols")
    print(f"📁 Folder:     {storage.BASE_DIR.absolute()}")
    print()
    
    # İstatistikler
    stats = storage.get_storage_stats()
    print(f"📊 TOTAL STATISTICS:")
    print(f"   Toplam sembol:    {stats['total_symbols']}")
    print(f"   Toplam timeframe: {stats['total_timeframes']}")
    print(f"   Total files:      {stats['total_files']}")
    print(f"   Toplam boyut:     {stats['total_size_mb']:.2f} MB")
    print()
    
    if processed_count > 0:
        print("🎉 FLAT FILE GENERATION COMPLETED SUCCESSFULLY!")
        print()
        print("NEXT STEPS:")
        print("  1. Restart application: python main.py")
        print("  2. Start bot from Dashboard")
        print("  3. Run ML Training (loads in 0.1s!)")
        print()
    else:
        print("⚠️ No symbols could be processed!")
        print("   Ensure data exists in database.")
    
    print("=" * 70)
    
    # DB kapat
    await db_manager.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ Cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
